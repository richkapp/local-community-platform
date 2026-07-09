import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Event } from '@/lib/types';
import EventRegistrationForm from './EventRegistrationForm';
import RegistrationStatus from './RegistrationStatus';

type Props = { slug: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value));
}

export default function EventDetail({ slug }: Props) {
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('events')
      .select('*, event_registration_counts(registration_count)')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setEvent(data as Event | null);
      });
  }, [slug]);

  if (error) return <p className="card p-6 text-red-300">{error}</p>;
  if (!event) return <p className="card p-6 text-braga-100">Loading event...</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <article className="card p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-braga-300">{formatDate(event.starts_at)}</p>
        <h1 className="mt-4 text-4xl font-black text-white">{event.title}</h1>
        <p className="mt-5 whitespace-pre-wrap leading-8 text-slate-200">{event.description}</p>
        <div className="mt-6 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
          <p>Location: {event.location_name ?? 'TBA'}</p>
          <p>Registered: {event.event_registration_counts?.[0]?.registration_count ?? 0}{event.capacity ? ` / ${event.capacity}` : ''}</p>
        </div>
      </article>
      <aside className="space-y-4">
        <RegistrationStatus eventId={event.id} />
        <EventRegistrationForm eventId={event.id} />
      </aside>
    </div>
  );
}
