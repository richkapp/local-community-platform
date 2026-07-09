const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type InviteRequest = {
  email?: string;
  code?: string;
};

type Invite = {
  id: string;
  code: string;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  revoked_at: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeCode(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function supabaseRequest<T>(path: string, init: RequestInit, serviceRoleKey: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('BRAGA_SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured');

  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {})
    }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(typeof body?.message === 'string' ? body.message : `Supabase request failed: ${response.status}`);
  }

  return body as T;
}

async function sendMagicLink(email: string, code: string, redirectTo: string, anonKey: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('BRAGA_SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured');

  const response = await fetch(`${supabaseUrl}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      create_user: true,
      data: { invite_code: code, community: 'Braga AI Builders' },
      gotrue_meta_security: {}
    })
  });

  if (!response.ok) {
    const text = await response.text();
    let body: { message?: string } = {};
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
    throw new Error(body.message || `Auth request failed: ${response.status}`);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('BRAGA_SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('BRAGA_SUPABASE_SERVICE_ROLE_KEY');
  const redirectTo = Deno.env.get('INVITE_REDIRECT_URL');

  if (!anonKey || !serviceRoleKey || !redirectTo) {
    return json({ error: 'Invite service is not configured' }, 500);
  }

  let payload: InviteRequest;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const email = normalizeEmail(payload.email);
  const code = normalizeCode(payload.code);

  if (!email || !email.includes('@')) {
    return json({ error: 'Enter a valid email address' }, 400);
  }

  if (!code || !/^[a-z0-9][a-z0-9-]{3,80}$/.test(code)) {
    return json({ error: 'Invite link is invalid' }, 400);
  }

  let invite: Invite | null = null;
  try {
    const rows = await supabaseRequest<Invite[]>(
      `/rest/v1/invites?code=eq.${encodeURIComponent(code)}&select=id,code,max_uses,uses_count,expires_at,revoked_at`,
      { method: 'GET' },
      serviceRoleKey
    );
    invite = rows[0] ?? null;
  } catch {
    return json({ error: 'Could not validate invite' }, 500);
  }

  if (!invite || invite.revoked_at) {
    return json({ error: 'Invite link is not active' }, 403);
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return json({ error: 'Invite link has expired' }, 403);
  }

  if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) {
    return json({ error: 'Invite link has reached its limit' }, 403);
  }

  try {
    await supabaseRequest(
      '/rest/v1/invite_redemptions',
      {
        method: 'POST',
        body: JSON.stringify({
          invite_id: invite.id,
          email,
          request_ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          user_agent: request.headers.get('user-agent')
        })
      },
      serviceRoleKey
    );
  } catch {
    return json({ error: 'Could not record invite request' }, 500);
  }

  try {
    await sendMagicLink(email, code, redirectTo, anonKey);
  } catch {
    return json({ error: 'Could not send sign-in email' }, 500);
  }

  await supabaseRequest(
    `/rest/v1/invites?id=eq.${invite.id}`,
    { method: 'PATCH', body: JSON.stringify({ uses_count: invite.uses_count + 1 }) },
    serviceRoleKey
  ).catch(() => null);

  return json({ ok: true, message: 'Check your email for your Braga AI Builders sign-in link.' });
});
