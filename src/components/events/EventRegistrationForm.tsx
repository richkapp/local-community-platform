import { useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { registerForEvent } from '@/lib/events';

type Props = { eventId: string };

export default function EventRegistrationForm({ eventId }: Props) {
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    setStatus('saving');
    setMessage('');
    try {
      await registerForEvent(eventId, note);
      setStatus('saved');
      setMessage('You are registered. See you there.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Could not register.');
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h2 className="text-xl font-bold text-white">Register</h2>
      <textarea className="input min-h-24" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note for organizers" />
      <button className="btn-primary" disabled={status === 'saving'}>{status === 'saving' ? 'Registering...' : 'Register for this event'}</button>
      {message && <p className={status === 'error' ? 'text-sm text-red-300' : 'text-sm text-limewash'}>{message}</p>}
      <p className="text-xs text-slate-500">You need to be signed in through an invite link before registering.</p>
    </form>
  );
}
