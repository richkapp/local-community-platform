import { useMemo, useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { supabaseUrl } from '@/lib/supabase';

type Props = {
  code: string;
};

export default function InviteEmailForm({ code }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const endpoint = useMemo(() => `${supabaseUrl}/functions/v1/request-invite-magic-link`, []);

  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not send sign-in link.');

      setStatus('success');
      setMessage(body.message || 'Check your email for your sign-in link.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      <div>
        <label className="label" htmlFor="email">Email address</label>
        <input
          id="email"
          className="input mt-2"
          type="email"
          value={email}
          placeholder="you@example.com"
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <button className="btn-primary w-full" disabled={status === 'loading'}>
        {status === 'loading' ? 'Sending link...' : 'Email me a magic link'}
      </button>
      {message && (
        <p className={status === 'error' ? 'text-sm text-red-300' : 'text-sm text-limewash'}>{message}</p>
      )}
      <p className="text-xs text-slate-500">Invite code: <span className="font-mono text-slate-300">{code}</span></p>
    </form>
  );
}
