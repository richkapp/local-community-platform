type BugReportPayload = {
  visitorId?: unknown;
  name?: unknown;
  email?: unknown;
  description?: unknown;
  pageUrl?: unknown;
  website?: unknown;
};

type CorsHeaders = Record<string, string>;

function trustedOrigins(redirectTo: string) {
  const origins = new Set<string>(['http://localhost:4321', 'http://127.0.0.1:4321']);
  try { origins.add(new URL(redirectTo).origin); } catch { /* configuration is validated below */ }
  return origins;
}

function corsFor(request: Request, redirectTo: string): CorsHeaders | null {
  const origin = request.headers.get('origin');
  const allowed = trustedOrigins(redirectTo);
  if (!origin || !allowed.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
}

function json(body: Record<string, unknown>, status: number, cors: CorsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

function validUuid(value: unknown) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function optionalText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function validPageUrl(value: string, allowedOrigins: Set<string>) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && allowedOrigins.has(parsed.origin);
  } catch {
    return false;
  }
}

async function hashIp(request: Request, secret: string) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function publicError(message: string) {
  if (/rate limit/i.test(message)) return { status: 429, error: 'You have sent several reports recently. Please try again later.' };
  if (/email/i.test(message)) return { status: 400, error: 'Enter a valid email address or leave it blank.' };
  if (/name|description|page url|visitor|invalid report/i.test(message)) return { status: 400, error: 'Check the report details and try again.' };
  return { status: 500, error: 'The bug report could not be sent. Please try again.' };
}

async function apiRequest<T>(supabaseUrl: string, path: string, body: Record<string, unknown>, serviceRoleKey: string) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let result: unknown = null;
  try { result = text ? JSON.parse(text) : null; } catch { result = { message: text }; }
  if (!response.ok) {
    const message = typeof result === 'object' && result && 'message' in result
      ? String((result as { message?: unknown }).message || '')
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return result as T;
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('BRAGA_SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('BRAGA_SUPABASE_SERVICE_ROLE_KEY') || '';
  const redirectTo = Deno.env.get('INVITE_REDIRECT_URL') || '';
  if (!supabaseUrl || !serviceRoleKey || !redirectTo) {
    return new Response(JSON.stringify({ error: 'Bug reporting is not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const cors = corsFor(request, redirectTo);
  if (!cors) return new Response(JSON.stringify({ error: 'Origin not allowed.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, cors);

  const declaredLength = Number(request.headers.get('content-length') || '0');
  if (declaredLength > 16_000) return json({ error: 'The report is too large.' }, 413, cors);

  let rawBody: string;
  try { rawBody = await request.text(); } catch { return json({ error: 'Invalid request.' }, 400, cors); }
  if (rawBody.length > 16_000) return json({ error: 'The report is too large.' }, 413, cors);

  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch { return json({ error: 'Invalid request.' }, 400, cors); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return json({ error: 'Invalid request.' }, 400, cors);
  }
  const payload = parsed as BugReportPayload;

  const name = optionalText(payload.name);
  const email = optionalText(payload.email).toLowerCase();
  const description = optionalText(payload.description);
  const pageUrl = optionalText(payload.pageUrl);
  const website = optionalText(payload.website);

  if (!validUuid(payload.visitorId)) return json({ error: 'Invalid visitor session.' }, 400, cors);
  if (name.length > 100) return json({ error: 'Name must be 100 characters or fewer.' }, 400, cors);
  if (email && (email.length > 254 || !/^[^\s@?&#:]+@(?:[a-z0-9-]+\.)+[a-z0-9-]{2,63}$/i.test(email))) return json({ error: 'Enter a valid email address or leave it blank.' }, 400, cors);
  if (description.length < 20 || description.length > 5000) return json({ error: 'Describe the bug in 20 to 5,000 characters.' }, 400, cors);
  if (pageUrl.length > 2048 || !validPageUrl(pageUrl, trustedOrigins(redirectTo))) {
    return json({ error: 'The reported page is not part of this community site.' }, 400, cors);
  }

  try {
    const reportId = await apiRequest<string>(
      supabaseUrl,
      '/rest/v1/rpc/submit_bug_report',
      {
        p_visitor_id: payload.visitorId,
        p_name: name || null,
        p_email: email || null,
        p_description: description,
        p_page_url: pageUrl || null,
        p_request_ip_hash: await hashIp(request, serviceRoleKey),
        p_website: website
      },
      serviceRoleKey
    );
    return json({ ok: true, reportId }, 201, cors);
  } catch (caught) {
    const safe = publicError(caught instanceof Error ? caught.message : '');
    return json({ error: safe.error }, safe.status, cors);
  }
});
