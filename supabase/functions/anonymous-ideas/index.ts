type IdeaPayload =
  | { action: 'create'; visitorId: string; title: string; body: string; slug: string; monthKey: string; category: string; tags: string[] }
  | { action: 'toggle-vote'; visitorId: string; ideaId: string };

type CorsHeaders = Record<string, string>;

function trustedOrigins(redirectTo: string) {
  const origins = new Set<string>(['http://localhost:4321', 'http://127.0.0.1:4321']);
  try { origins.add(new URL(redirectTo).origin); } catch { /* validated below */ }
  return origins;
}

function corsFor(request: Request, redirectTo: string): CorsHeaders | null {
  const origin = request.headers.get('origin');
  const allowed = trustedOrigins(redirectTo);
  if (origin && !allowed.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin && allowed.has(origin) ? origin : new URL(redirectTo).origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
}

function json(body: Record<string, unknown>, status: number, cors: CorsHeaders) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function validUuid(value: unknown) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function hashIp(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function publicError(message: string) {
  if (/rate limit/i.test(message)) return { status: 429, error: 'Please slow down and try again shortly.' };
  if (/not open/i.test(message)) return { status: 409, error: 'This post is not open for voting.' };
  if (/invalid idea|slug|month|category|tags/i.test(message)) return { status: 400, error: 'Check the post details and try again.' };
  return { status: 500, error: 'Posts are temporarily unavailable. Please try again.' };
}

async function rpc<T>(url: string, serviceRoleKey: string, name: string, body: Record<string, unknown>) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'message' in data ? String((data as { message?: unknown }).message || '') : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('BRAGA_SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('BRAGA_SUPABASE_SERVICE_ROLE_KEY') || '';
  const redirectTo = Deno.env.get('INVITE_REDIRECT_URL') || '';
  if (!supabaseUrl || !serviceRoleKey || !redirectTo) return new Response(JSON.stringify({ error: 'Ideas service is not configured.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const cors = corsFor(request, redirectTo);
  if (!cors) return new Response(JSON.stringify({ error: 'Origin not allowed.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, cors);

  let payload: IdeaPayload;
  try { payload = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400, cors); }
  if (!payload || !validUuid(payload.visitorId)) return json({ error: 'Invalid visitor session.' }, 400, cors);

  try {
    const requestIpHash = await hashIp(request);
    if (payload.action === 'create') {
      if (typeof payload.title !== 'string' || typeof payload.body !== 'string' || typeof payload.slug !== 'string' || typeof payload.monthKey !== 'string' || typeof payload.category !== 'string' || !Array.isArray(payload.tags)) return json({ error: 'Invalid post.' }, 400, cors);
      const idea = await rpc<Record<string, unknown>>(supabaseUrl, serviceRoleKey, 'post_anonymous_idea', {
        p_visitor_id: payload.visitorId,
        p_title: payload.title,
        p_body: payload.body,
        p_slug: payload.slug,
        p_month_key: payload.monthKey,
        p_category: payload.category,
        p_tags: payload.tags,
        p_request_ip_hash: requestIpHash
      });
      return json({ idea }, 201, cors);
    }
    if (payload.action === 'toggle-vote') {
      if (!validUuid(payload.ideaId)) return json({ error: 'Invalid idea.' }, 400, cors);
      const rows = await rpc<Array<{ voted: boolean; upvote_count: number }>>(supabaseUrl, serviceRoleKey, 'toggle_anonymous_idea_vote', {
        p_visitor_id: payload.visitorId,
        p_idea_id: payload.ideaId,
        p_request_ip_hash: requestIpHash
      });
      return json({ vote: rows[0] ?? null }, 200, cors);
    }
    return json({ error: 'Unknown ideas action.' }, 400, cors);
  } catch (caught) {
    const safe = publicError(caught instanceof Error ? caught.message : '');
    return json({ error: safe.error }, safe.status, cors);
  }
});
