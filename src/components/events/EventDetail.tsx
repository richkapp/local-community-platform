import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toUserMessage } from '@/lib/errors';
import { formatCommunityDate } from '@/lib/communityDate';
import type { Event } from '@/lib/types';

type Props = { slug: string };

function formatDate(start: string, end: string | null) {
  const format = (value: string) => formatCommunityDate(value, { dateStyle: 'full', timeStyle: 'short' });
  return end ? `${format(start)} – ${format(end)}` : format(start);
}

export default function EventDetail({ slug }: Props) {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (queryError) setError(toUserMessage('event-detail', queryError));
        else setEvent((data as Event | null) ?? null);
        setLoading(false);
      });
  }, [slug]);

  if (loading) return <p className="card p-6 text-braga-100" role="status">Loading event…</p>;
  if (error) return <p className="error-message" role="alert">{error}</p>;
  if (!event) return <div className="card p-6"><h1 className="text-2xl font-semibold">Event not found</h1><a href="/events" className="mt-4 inline-flex text-limewash">Back to events</a></div>;

  return (
    <article className="card overflow-hidden">
      {event.image_url && <img src={event.image_url} alt="" className="max-h-[560px] w-full object-cover" />}
      <div className="p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-braga-300">{formatDate(event.starts_at, event.ends_at)}</p>
        <h1 className="mt-4 break-words text-4xl font-black text-white">{event.title}</h1>
        {event.location_name && <p className="mt-4 text-sm text-braga-200">{event.location_name}</p>}
        <p className="mt-6 whitespace-pre-wrap break-words leading-8 text-braga-100">{event.description}</p>
        {event.external_url && (
          <a className="btn-primary mt-8 inline-flex" href={event.external_url} target="_blank" rel="noreferrer noopener">RSVP on Luma ↗</a>
        )}
      </div>
    </article>
  );
}
