import { supabaseAnonKey, supabaseUrl } from './supabase';

export type MagicLinkPayload = (
  | { context: 'signin'; next?: '/ideas'; code?: never }
  | { code: string; context?: never; next?: never }
) & {
  email: string;
  emailConsent: true;
};

type MagicLinkResponse = {
  error?: string;
  message?: string;
};

export async function requestMagicLink(payload: MagicLinkPayload) {
  const response = await fetch(`${supabaseUrl}/functions/v1/request-invite-magic-link`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...payload, email: payload.email.trim().toLowerCase() })
  });
  const body = await response.json().catch(() => ({})) as MagicLinkResponse;
  if (!response.ok) throw new Error(body.error || 'Could not send the sign-in link.');
  return body;
}
