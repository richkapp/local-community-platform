import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const [message, setMessage] = useState('Confirming your session...');

  useEffect(() => {
    async function confirm() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const tokenHash = url.searchParams.get('token_hash');
      const type = url.searchParams.get('type') as 'email' | 'invite' | null;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
        window.location.href = '/settings';
        return;
      }

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) {
          setMessage(error.message);
          return;
        }
        window.location.href = '/settings';
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        window.location.href = '/settings';
      } else {
        setMessage('No sign-in token found. Open the latest magic link from your email.');
      }
    }

    confirm();
  }, []);

  return <p className="card p-6 text-braga-100">{message}</p>;
}
