import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Event } from '@/lib/types';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function EventList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('events')
      .select('*, event_registration_counts(registration_count)')
      .in('status', ['published', 'completed'])
      .order('starts_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setEvents((data ?? []) as Event[]);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="card p-6 text-braga-100">Loading events...</p>;
  if (error) return <p className="card p-6 text-red-300">{error}</p>;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {events.map((event) => (
        <article key={event.id} className="card p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-braga-300">{formatDate(event.starts_at)}</p>
          <a href={`/events/${event.slug}`} className="mt-3 block text-2xl font-black text-white hover:text-braga-200">{event.title}</a>
          <p className="mt-3 leading-7 text-slate-300">{event.description}</p>
          <p className="mt-4 text-sm text-slate-400">{event.event_registration_counts?.[0]?.registration_count ?? 0} registered · {event.location_name ?? 'Location TBA'}</p>
        </article>
      ))}
      {events.length === 0 && <p className="card p-6 text-slate-300">No events published yet.</p>}
    </div>
  );
}
