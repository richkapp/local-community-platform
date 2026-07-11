import { useMemo, useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase';
import { communityConfig } from '@/config/community';

type Props = { code: string };

export default function InviteEmailForm({ code }: Props) {
  const [email, setEmail] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const endpoint = useMemo(() => `${supabaseUrl}/functions/v1/request-invite-magic-link`, []);

  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    setMessage('');
    if (!emailConsent) {
      setStatus('error');
      setMessage('Please agree to receive the one-time magic-link email.');
      return;
    }
    setStatus('loading');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code, emailConsent: true })
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Could not send the sign-in link.');

      setStatus('success');
      setMessage(`Check your email for your ${communityConfig.name} sign-in link. It can take a minute to arrive.`);
    } catch (caught) {
      console.error('[invite-request]', caught);
      setStatus('error');
      const text = caught instanceof Error ? caught.message : '';
      setMessage(/invite|email|wait|try again|agree/i.test(text) ? text : 'The sign-in link could not be sent. Please try again.');
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6" aria-busy={status === 'loading'}>
      <div>
        <label className="label" htmlFor="email">Email address</label>
        <input id="email" className="input mt-2" type="email" value={email} placeholder="you@example.com" onChange={(event) => setEmail(event.target.value)} autoComplete="email" required disabled={status === 'success'} />
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-braga-300/20 bg-white/[0.025] p-4 text-sm leading-6 text-braga-100">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-limewash" checked={emailConsent} onChange={(event) => setEmailConsent(event.target.checked)} required disabled={status === 'loading' || status === 'success'} />
        <span>I agree to receive a one-time login or signup link sent through Supabase. My email address will never be used for marketing.</span>
      </label>
      <button className="btn-primary w-full" disabled={!emailConsent || status === 'loading' || status === 'success'}>
        {status === 'loading' ? 'Sending link…' : status === 'success' ? 'Link sent' : 'Email me a magic link'}
      </button>
      {message && <p className={status === 'error' ? 'error-message' : 'status-message'} role={status === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</p>}
      <p className="text-xs leading-5 text-braga-200">No password and no separate signup. The same one-time magic link creates your account or signs you back in.</p>
    </form>
  );
}
