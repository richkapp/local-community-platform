import { useState } from 'react';
import { cancelRegistration } from '@/lib/events';
import { toUserMessage } from '@/lib/errors';
import type { Registration } from '@/lib/types';

type Props = {
  eventId: string;
  signedIn: boolean;
  status: Registration['status'] | null;
  onChanged?: () => void | Promise<void>;
};

export default function RegistrationStatus({ eventId, signedIn, status, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function cancel() {
    setBusy(true);
    setError('');
    try {
      await cancelRegistration(eventId);
      await onChanged?.();
    } catch (caught) {
      setError(toUserMessage('event-cancellation', caught));
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) return <p className="status-message">Sign in with your private invite to register.</p>;
  if (!status || status === 'cancelled') return <p className="status-message">You are not registered yet.</p>;

  return (
    <div className="status-message space-y-3" role="status">
      <p>Your registration status: <strong className="text-white">{status}</strong></p>
      <button type="button" className="text-sm font-semibold text-red-200 hover:text-white" onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel registration'}</button>
      {error && <p className="error-message" role="alert">{error}</p>}
    </div>
  );
}
