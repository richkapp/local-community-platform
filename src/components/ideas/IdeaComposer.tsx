import { useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { createIdea } from '@/lib/ideas';

export default function IdeaComposer() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    setStatus('saving');
    setMessage('');
    try {
      await createIdea(title, body);
      setTitle('');
      setBody('');
      setStatus('saved');
      setMessage('Idea posted. Refreshing...');
      window.location.reload();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Could not post idea.');
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h2 className="text-xl font-bold text-white">Suggest an activity</h2>
      <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Build night: AI agents for local businesses" minLength={4} maxLength={120} required />
      <textarea className="input min-h-32" value={body} onChange={(event) => setBody(event.target.value)} placeholder="What should we do, why would it help the group, and what would people leave with?" minLength={10} maxLength={2000} required />
      <button className="btn-primary" disabled={status === 'saving'}>{status === 'saving' ? 'Posting...' : 'Post idea'}</button>
      {message && <p className={status === 'error' ? 'text-sm text-red-300' : 'text-sm text-limewash'}>{message}</p>}
    </form>
  );
}
