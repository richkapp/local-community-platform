import { useCallback, useEffect, useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { createEvent, listAdminEvents, updateEventStatus } from '@/lib/admin';
import { toUserMessage } from '@/lib/errors';
import { slugWithRandomSuffix } from '@/lib/slug';
import type { Event } from '@/lib/types';

export default function EventManager() {
  const [events, setEvents] = useState<Event[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [location, setLocation] = useState('');
  const [eventUrl, setEventUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setEvents(await listAdminEvents()); }
    catch (caught) { setError(toUserMessage('admin-load', caught)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormSubmitEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await createEvent({
        slug: slugWithRandomSuffix(title, 8),
        title: title.trim(),
        description: description.trim(),
        starts_at: new Date(startsAt).toISOString(),
        location_name: location.trim() || null,
        external_url: eventUrl.trim(),
        status: 'published'
      });
      setTitle(''); setDescription(''); setStartsAt(''); setLocation(''); setEventUrl('');
      setMessage('Event published.'); await load();
    } catch (caught) { setError(toUserMessage('admin-save', caught)); }
    finally { setBusy(false); }
  }

  async function changeStatus(id: string, status: Event['status']) {
    if (status === 'cancelled' && !window.confirm('Cancel this event? It will disappear from the public event list.')) return;
    setError('');
    try { await updateEventStatus(id, status); setMessage(`Event marked ${status}.`); await load(); }
    catch (caught) { setError(toUserMessage('admin-save', caught)); }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card grid gap-4 p-6 md:grid-cols-2" aria-busy={busy}>
        <div className="md:col-span-2"><h2 className="text-xl font-bold text-white">Add an event</h2><p className="mt-2 text-sm text-braga-200">Add the basics and the public event link. The card is published immediately.</p></div>
        <div><label className="label" htmlFor="event-title">Event name</label><input id="event-title" className="input mt-2" value={title} onChange={(event) => setTitle(event.target.value)} minLength={4} maxLength={140} required /></div>
        <div><label className="label" htmlFor="event-start">Date and time</label><input id="event-start" className="input mt-2" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></div>
        <div className="md:col-span-2"><label className="label" htmlFor="event-description">Description</label><textarea id="event-description" className="input mt-2 min-h-32" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={4000} required /></div>
        <div><label className="label" htmlFor="event-location">Location</label><input id="event-location" className="input mt-2" value={location} onChange={(event) => setLocation(event.target.value)} maxLength={160} required /></div>
        <div><label className="label" htmlFor="event-url">Event link</label><input id="event-url" className="input mt-2" type="url" value={eventUrl} onChange={(event) => setEventUrl(event.target.value)} placeholder="https://luma.com/…" required /></div>
        <button type="submit" className="btn-primary md:col-span-2" disabled={busy}>{busy ? 'Publishing…' : 'Publish event'}</button>
      </form>

      {message && <p className="status-message" role="status">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="space-y-3">
        <h2 className="text-xl font-bold text-white">Events</h2>
        {events.map((event) => (
          <article key={event.id} className="card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div><p className="font-semibold text-white">{event.title}</p><p className="mt-1 text-xs text-braga-200">{new Date(event.starts_at).toLocaleString()} · {event.status}</p></div>
            <div className="flex flex-wrap gap-2">
              {event.external_url && <a className="btn-secondary" href={event.external_url} target="_blank" rel="noreferrer noopener">See event ↗</a>}
              {event.status !== 'published' && event.status !== 'cancelled' && <button type="button" className="btn-primary" onClick={() => changeStatus(event.id, 'published')}>Publish</button>}
              {event.status === 'published' && <button type="button" className="btn-secondary" onClick={() => changeStatus(event.id, 'draft')}>Unpublish</button>}
              {event.status !== 'cancelled' && <button type="button" className="rounded-full border border-red-300/30 px-4 py-2 text-sm font-semibold text-red-200" onClick={() => changeStatus(event.id, 'cancelled')}>Cancel</button>}
            </div>
          </article>
        ))}
        {!events.length && <p className="card p-6 text-braga-100">No events yet.</p>}
      </div>
    </div>
  );
}
