import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toUserMessage } from '@/lib/errors';

const otpTypes = new Set(['email', 'invite', 'magiclink', 'signup', 'recovery']);

async function claimPendingInvite() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const user = userData.user;
  const inviteCode = user?.user_metadata?.invite_code;
  const inviteFlow = user?.user_metadata?.invite_flow;
  if (!user || inviteFlow !== 'rolling_v1' || typeof inviteCode !== 'string' || !inviteCode) return;

  const recentlyCreated = Date.now() - new Date(user.created_at).getTime() < 5 * 60_000;
  if (!recentlyCreated) return;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.rpc('claim_my_pending_invite');
    if (error) throw error;
    if (data) return;
    if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 300));
  }
}

export default function AuthCallback() {
  const [message, setMessage] = useState('Confirming your session…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    async function confirm() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const tokenHash = url.searchParams.get('token_hash');
        const queryType = url.searchParams.get('type') ?? '';
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        const returnToPosts = url.searchParams.get('next') === '/ideas';

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && otpTypes.has(queryType)) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: queryType as 'email' | 'invite' | 'magiclink' | 'signup' | 'recovery'
          });
          if (error) throw error;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error('No sign-in token found.');
        }

        // Remove credentials before any follow-up request so they never remain in
        // browser history, screenshots, analytics, or copied URLs.
        window.history.replaceState(window.history.state, document.title, '/auth/confirm');

        try {
          await claimPendingInvite();
        } catch (claimError) {
          console.error('[invite-claim-backup]', claimError);
        }

        window.location.replace(returnToPosts ? '/posts?restoreIdea=1' : '/settings');
      } catch (caught) {
        window.history.replaceState(window.history.state, document.title, '/auth/confirm');
        setFailed(true);
        setMessage(toUserMessage('auth-callback', caught));
      }
    }

    void confirm();
  }, []);

  return (
    <div className={failed ? 'error-message' : 'card p-6 text-braga-100'} role={failed ? 'alert' : 'status'} aria-live="polite">
      <p>{message}</p>
      {failed && <a href="/signin" className="mt-4 inline-flex font-semibold text-limewash">Request a new magic link</a>}
    </div>
  );
}
