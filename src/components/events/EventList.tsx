import { useCallback, useEffect, useState } from 'react';
import { LuPencil } from 'react-icons/lu';
import type { FormSubmitEvent } from '@/lib/dom';
import { updateEvent } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { toUserMessage } from '@/lib/errors';
import type { Event } from '@/lib/types';
import { useSiteSession } from '@/components/auth/useSiteSession';
import { communityDateKey, formatCommunityDate } from '@/lib/communityDate';

function formatDate(value: string) {
  return formatCommunityDate(value);
}

function toLocalInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function EventEditor({ event, onClose, onSaved }: { event: Event; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [startsAt, setStartsAt] = useState(toLocalInput(event.starts_at));
  const [location, setLocation] = useState(event.location_name ?? '');
  const [eventUrl, setEventUrl] = useState(event.external_url ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(formEvent: FormSubmitEvent) {
    formEvent.preventDefault(); setSaving(true); setError('');
    try {
      await updateEvent(event.id, {
        title: title.trim(), description: description.trim(), starts_at: new Date(startsAt).toISOString(),
        location_name: location.trim() || null, external_url: eventUrl.trim()
      });
      onSaved();
    } catch (caught) { setError(toUserMessage('admin-save', caught)); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(click) => { if (click.target === click.currentTarget) onClose(); }}>
      <form onSubmit={submit} className="card max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto p-6" role="dialog" aria-modal="true" aria-labelledby="edit-event-title">
        <div className="flex items-start justify-between gap-4"><div><h2 id="edit-event-title" className="text-2xl font-black text-white">Edit event</h2><p className="mt-1 text-sm text-braga-200">Changes update the public card immediately.</p></div><button type="button" className="text-sm text-braga-200 hover:text-white" onClick={onClose}>Close</button></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label" htmlFor="edit-event-name">Event name</label><input id="edit-event-name" className="input mt-2" value={title} onChange={(change) => setTitle(change.target.value)} minLength={4} maxLength={140} required /></div>
          <div><label className="label" htmlFor="edit-event-date">Date and time</label><input id="edit-event-date" className="input mt-2" type="datetime-local" value={startsAt} onChange={(change) => setStartsAt(change.target.value)} required /></div>
          <div className="md:col-span-2"><label className="label" htmlFor="edit-event-description">Description</label><textarea id="edit-event-description" className="input mt-2 min-h-32" value={description} onChange={(change) => setDescription(change.target.value)} minLength={10} maxLength={4000} required /></div>
          <div><label className="label" htmlFor="edit-event-location">Location</label><input id="edit-event-location" className="input mt-2" value={location} onChange={(change) => setLocation(change.target.value)} maxLength={160} required /></div>
          <div><label className="label" htmlFor="edit-event-link">Event link</label><input id="edit-event-link" className="input mt-2" type="url" value={eventUrl} onChange={(change) => setEventUrl(change.target.value)} required /></div>
        </div>
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        {error && <p className="error-message" role="alert">{error}</p>}
      </form>
    </div>
  );
}

function EventCard({ event, isAdmin, onEdit }: { event: Event; isAdmin: boolean; onEdit: () => void }) {
  return (
    <article className="card relative overflow-hidden">
      {event.image_url && <img src={event.image_url} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />}
      {isAdmin && <button type="button" onClick={onEdit} aria-label={`Edit ${event.title}`} title="Edit event" className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-braga-300/30 bg-ink-950/85 text-braga-100 shadow-lg transition hover:-translate-y-0.5 hover:border-limewash/70 hover:text-limewash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limewash"><LuPencil className="h-4 w-4" aria-hidden="true" /></button>}
      <div className="p-6">
        <p className={`text-xs uppercase tracking-[0.2em] text-braga-300 ${isAdmin && !event.image_url ? 'pr-12' : ''}`}>{formatDate(event.starts_at)}</p>
        <h3 className="mt-3 text-2xl font-black text-white">{event.title}</h3>
        <p className="mt-3 line-clamp-4 leading-7 text-braga-100">{event.description}</p>
        <p className="mt-4 text-sm text-braga-200">{event.location_name ?? 'Location TBA'}</p>
        {event.external_url && <a className="btn-secondary mt-6 inline-flex" href={event.external_url} target="_blank" rel="noreferrer noopener">See event ↗</a>}
      </div>
    </article>
  );
}

export default function EventList() {
  const { isAdmin } = useSiteSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [editing, setEditing] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('events')
        .select('*')
        .in('status', ['published', 'completed'])
        .order('starts_at', { ascending: true });
      if (queryError) throw queryError;
      setEvents((data ?? []) as Event[]);
    } catch (caught) { setError(toUserMessage('events-list', caught)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);


  if (loading) return <p className="card p-6 text-braga-100" role="status">Loading events…</p>;
  if (error) return <p className="error-message" role="alert">{error}</p>;

  const today = communityDateKey(new Date());
  const upcoming = events.filter((event) => communityDateKey(event.starts_at) >= today);
  const past = events.filter((event) => communityDateKey(event.starts_at) < today).reverse();

  return (
    <div className="space-y-12">
      <section aria-labelledby="upcoming-events"><h2 id="upcoming-events" className="mb-5 text-2xl font-black text-white">Upcoming events</h2>{upcoming.length ? <div className="grid gap-5 md:grid-cols-2">{upcoming.map((event) => <EventCard key={event.id} event={event} isAdmin={isAdmin} onEdit={() => setEditing(event)} />)}</div> : <p className="card p-6 text-braga-100">No upcoming events yet.</p>}</section>
      {past.length > 0 && <section aria-labelledby="past-events"><h2 id="past-events" className="mb-5 text-2xl font-black text-white">Past events</h2><div className="grid gap-5 md:grid-cols-2">{past.map((event) => <EventCard key={event.id} event={event} isAdmin={isAdmin} onEdit={() => setEditing(event)} />)}</div></section>}
      {editing && <EventEditor event={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </div>
  );
}
