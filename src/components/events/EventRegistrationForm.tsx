import { useEffect, useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { registerForEvent } from '@/lib/events';
import { toUserMessage } from '@/lib/errors';
import AuthRequired from '@/components/auth/AuthRequired';
import { useAuthUser } from '@/components/auth/useAuthUser';
import { isAnonymousUser } from '@/lib/anonymous';

type Props = {
  eventId: string;
  disabledReason?: string;
  onRegistered?: () => void | Promise<void>;
};

export default function EventRegistrationForm({ eventId, disabledReason = '', onRegistered }: Props) {
  const { user, loading } = useAuthUser();
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState(disabledReason);
  const blocked = Boolean(disabledReason) || status === 'saved';

  useEffect(() => {
    if (status === 'idle') setMessage(disabledReason);
  }, [disabledReason, status]);

  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    if (blocked) return;
    setStatus('saving');
    setMessage('');
    try {
      await registerForEvent(eventId, note);
      setStatus('saved');
      setMessage('You are registered. See you there.');
      await onRegistered?.();
    } catch (error) {
      setStatus('error');
      setMessage(toUserMessage('event-registration', error));
    }
  }

  if (loading) return <div className="card p-6 text-braga-100" role="status">Checking member access…</div>;
  if (!user || isAnonymousUser(user)) return <AuthRequired title="Join the community to register" message="Ideas work without an account. Use a private invite to register for events." />;

  return (
    <form onSubmit={submit} className="card space-y-4 p-6" aria-busy={status === 'saving'}>
      <h2 className="text-xl font-bold text-white">Register</h2>
      <div>
        <label className="label" htmlFor={`registration-note-${eventId}`}>Optional note for organizers</label>
        <textarea id={`registration-note-${eventId}`} className="input mt-2 min-h-24" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} disabled={blocked} />
      </div>
      <button type="submit" className="btn-primary" disabled={status === 'saving' || blocked}>{status === 'saving' ? 'Registering…' : 'Register for this event'}</button>
      {message && <p className={status === 'error' ? 'error-message' : 'status-message'} role={status === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</p>}
    </form>
  );
}
