import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toUserMessage } from '@/lib/errors';

const otpTypes = new Set(['email', 'invite', 'magiclink', 'signup', 'recovery']);

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
        const returnToIdeas = url.searchParams.get('next') === '/ideas';

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

        // Remove credentials before navigating so they never remain in browser
        // history, screenshots, analytics, or copied URLs.
        window.history.replaceState({}, document.title, '/auth/confirm');
        window.location.replace(returnToIdeas ? '/ideas?restoreIdea=1' : '/settings');
      } catch (caught) {
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
