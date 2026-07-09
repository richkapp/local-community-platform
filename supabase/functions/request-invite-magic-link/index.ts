import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type InviteRequest = {
  email?: string;
  code?: string;
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const redirectTo = Deno.env.get('INVITE_REDIRECT_URL');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !redirectTo) {
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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: invite, error: inviteError } = await admin
    .from('invites')
    .select('id, code, max_uses, uses_count, expires_at, revoked_at')
    .eq('code', code)
    .maybeSingle();

  if (inviteError) {
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

  const { error: redemptionError } = await admin.from('invite_redemptions').insert({
    invite_id: invite.id,
    email,
    request_ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    user_agent: request.headers.get('user-agent')
  });

  if (redemptionError) {
    return json({ error: 'Could not record invite request' }, 500);
  }

  const inviteResult = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { invite_code: code, community: 'Braga AI Builders' }
  });

  if (inviteResult.error) {
    const message = inviteResult.error.message.toLowerCase();
    if (!message.includes('already') && !message.includes('registered')) {
      return json({ error: 'Could not send invite email' }, 500);
    }

    const { error: otpError } = await publicClient.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo }
    });

    if (otpError) {
      return json({ error: 'Could not send sign-in email' }, 500);
    }
  }

  await admin
    .from('invites')
    .update({ uses_count: invite.uses_count + 1 })
    .eq('id', invite.id);

  return json({ ok: true, message: 'Check your email for your Braga AI Builders sign-in link.' });
});
