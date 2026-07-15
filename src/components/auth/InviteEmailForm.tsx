import { useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { requestMagicLink } from '@/lib/magicLink';
import { communityConfig } from '@/config/community';

type Props = { mode: 'invite'; code: string } | { mode: 'signin'; code?: never };

export default function InviteEmailForm({ code, mode }: Props) {
  const [email, setEmail] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

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
      await requestMagicLink(mode === 'signin'
        ? { email, context: 'signin', emailConsent: true }
        : { email, code, emailConsent: true });

      setStatus('success');
      setMessage(mode === 'signin'
        ? `If this email belongs to a ${communityConfig.name} member, the sign-in link can take a minute to arrive.`
        : `Check your email for your ${communityConfig.name} invitation link. It can take a minute to arrive.`);
    } catch (caught) {
      console.error('[invite-request]', caught);
      setStatus('error');
      const text = caught instanceof Error ? caught.message : '';
      setMessage(/invite|email|wait|try again|agree|member/i.test(text) ? text : 'The sign-in link could not be sent. Please try again.');
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
        <span>I agree to receive a one-time magic-link email sent through Supabase. My email address will never be used for marketing.</span>
      </label>
      <p className="text-xs leading-5 text-braga-300">Use of this site is subject to our <a className="font-semibold text-limewash hover:underline" href="/terms">Terms and Conditions</a>. See the <a className="font-semibold text-limewash hover:underline" href="/privacy">Privacy Policy</a> for how account data is handled.</p>
      <button className="btn-primary w-full" disabled={!emailConsent || status === 'loading' || status === 'success'}>
        {status === 'loading' ? 'Sending link…' : status === 'success' ? 'Link sent' : 'Email me a magic link'}
      </button>
      {message && <p className={status === 'error' ? 'error-message' : 'status-message'} role={status === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</p>}
      <p className="text-xs leading-5 text-braga-200">
        {mode === 'signin'
          ? 'This form signs in existing members only. New members need an invitation URL shared by a member or organizer.'
          : 'This invitation creates one new member account. Existing members can also use it to sign in without consuming the invitation.'}
      </p>
    </form>
  );
}
