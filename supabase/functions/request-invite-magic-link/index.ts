type InviteRequest = {
  email?: string;
  code?: string;
  context?: 'signin';
  next?: '/ideas';
  emailConsent?: boolean;
};

type ReservedInvite = {
  redemption_id: string;
  code: string;
  email: string;
};

type CorsHeaders = Record<string, string>;

function trustedOrigins(redirectTo: string) {
  const origins = new Set<string>(['http://localhost:4321', 'http://127.0.0.1:4321']);
  try {
    origins.add(new URL(redirectTo).origin);
  } catch {
    // Configuration validation below returns a server error.
  }
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
    'Vary': 'Origin'
  };
}

function json(body: Record<string, unknown>, status: number, cors: CorsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeCode(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function publicInviteError(message: string) {
  if (/wait|too many|rate/i.test(message)) return { status: 429, error: 'Please wait before requesting another sign-in link.' };
  if (/invalid email/i.test(message)) return { status: 400, error: 'Enter a valid email address.' };
  if (/invalid|active|expired|exhausted|limit|revoked|suspended/i.test(message)) return { status: 403, error: 'This invite cannot be used. Ask a member or organizer for a current private link.' };
  return { status: 500, error: 'The sign-in link could not be sent. Please try again.' };
}

async function apiRequest<T>(supabaseUrl: string, path: string, init: RequestInit, key: string) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {})
    }
  });

  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body ? String((body as { message?: unknown }).message ?? '') : `Request failed: ${response.status}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body as T;
}

async function sendExistingMemberLink(
  supabaseUrl: string,
  email: string,
  redirectTo: string,
  anonKey: string
) {
  await apiRequest(
    supabaseUrl,
    `/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`,
    { method: 'POST', body: JSON.stringify({ email, create_user: false, gotrue_meta_security: {} }) },
    anonKey
  );
}

async function sendInvitedLink(
  supabaseUrl: string,
  email: string,
  code: string,
  redemptionId: string,
  redirectTo: string,
  anonKey: string,
  serviceRoleKey: string,
  communityName: string
) {
  try {
    await apiRequest(
      supabaseUrl,
      `/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          data: { invite_code: code, invite_flow: 'rolling_v1', community: communityName, SignupSource: 'invite' }
        })
      },
      serviceRoleKey
    );
    return true;
  } catch (caught) {
    const status = (caught as Error & { status?: number }).status;
    const message = caught instanceof Error ? caught.message : '';
    const existingUser = [400, 422].includes(status ?? 0) && /already|registered|exists/i.test(message);
    if (!existingUser) throw caught;
  }

  const unconfirmedAccount = await apiRequest<boolean>(
    supabaseUrl,
    '/rest/v1/rpc/prepare_existing_invite_user',
    { method: 'POST', body: JSON.stringify({ target_redemption_id: redemptionId }) },
    serviceRoleKey
  );
  await sendExistingMemberLink(supabaseUrl, email, redirectTo, anonKey);
  return unconfirmedAccount;
}

async function markInviteDelivery(
  supabaseUrl: string,
  serviceRoleKey: string,
  redemptionId: string,
  newAccountCreated: boolean
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await apiRequest(
        supabaseUrl,
        '/rest/v1/rpc/mark_invite_delivery',
        {
          method: 'POST',
          body: JSON.stringify({
            target_redemption_id: redemptionId,
            new_account_created: newAccountCreated
          })
        },
        serviceRoleKey
      );
      return;
    } catch (caught) {
      lastError = caught;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastError;
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('BRAGA_SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('BRAGA_SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('BRAGA_SUPABASE_SERVICE_ROLE_KEY') || '';
  const redirectTo = Deno.env.get('INVITE_REDIRECT_URL') || '';
  const communityName = Deno.env.get('COMMUNITY_NAME') || 'Local Community';

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !redirectTo) {
    return new Response(JSON.stringify({ error: 'Invite service is not configured.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const cors = corsFor(request, redirectTo);
  if (!cors) return new Response(JSON.stringify({ error: 'Origin not allowed.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, cors);

  let payload: InviteRequest;
  try { payload = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400, cors); }

  const email = normalizeEmail(payload.email);
  if (payload.emailConsent !== true) return json({ error: 'You must agree to receive the one-time magic-link email.' }, 400, cors);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400, cors);

  const deliveryRedirect = new URL(redirectTo);
  if (payload.next === '/ideas') {
    deliveryRedirect.searchParams.set('next', '/ideas');
  }

  if (payload.context === 'signin') {
    try {
      await sendExistingMemberLink(supabaseUrl, email, deliveryRedirect.toString(), anonKey);
    } catch (caught) {
      console.error('Existing-member magic-link request failed', caught);
    }
    return json({ ok: true, message: 'If that email belongs to a member, a sign-in link is on its way.' }, 200, cors);
  }

  const code = normalizeCode(payload.code);
  if (!code || !/^[a-z0-9][a-z0-9-]{3,80}$/.test(code)) return json({ error: 'This invite link is invalid.' }, 400, cors);

  let reserved: ReservedInvite;
  try {
    const rows = await apiRequest<ReservedInvite[]>(
      supabaseUrl,
      '/rest/v1/rpc/reserve_invite_for_email',
      {
        method: 'POST',
        body: JSON.stringify({
          invite_code: code,
          invite_email: email,
          request_ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          request_user_agent: request.headers.get('user-agent') || null
        })
      },
      serviceRoleKey
    );
    if (!rows?.[0]) throw new Error('Invite reservation failed.');
    reserved = rows[0];
  } catch (caught) {
    const safe = publicInviteError(caught instanceof Error ? caught.message : '');
    return json({ error: safe.error }, safe.status, cors);
  }

  try {
    // Arm the claim before GoTrue can confirm a new Auth user.
    await markInviteDelivery(supabaseUrl, serviceRoleKey, reserved.redemption_id, true);
    const newAccountCreated = await sendInvitedLink(
      supabaseUrl,
      reserved.email,
      reserved.code,
      reserved.redemption_id,
      deliveryRedirect.toString(),
      anonKey,
      serviceRoleKey,
      communityName
    );
    if (!newAccountCreated) {
      await markInviteDelivery(supabaseUrl, serviceRoleKey, reserved.redemption_id, false);
    }
  } catch (caught) {
    console.error('Invite email request failed', caught);
    const status = (caught as Error & { status?: number }).status;
    const definitelyRejected = typeof status === 'number' && status >= 400 && status < 500;
    if (definitelyRejected) {
      try {
        await apiRequest(
          supabaseUrl,
          '/rest/v1/rpc/fail_invite_redemption',
          { method: 'POST', body: JSON.stringify({ target_redemption_id: reserved.redemption_id }) },
          serviceRoleKey
        );
      } catch (rollbackError) {
        console.error('Invite reservation cleanup failed', rollbackError);
      }
    } else {
      console.error('Invite delivery outcome is ambiguous; keeping the pending claim until expiry.');
    }
    return json({ error: 'The sign-in link could not be sent. Please try again.' }, 500, cors);
  }

  return json({ ok: true, message: `Check your email for your one-time ${communityName} link.` }, 200, cors);
});
