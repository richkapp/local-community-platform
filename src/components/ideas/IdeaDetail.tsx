import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Idea } from '@/lib/types';
import UpvoteButton from './UpvoteButton';

type Props = { slug: string };

export default function IdeaDetail({ slug }: Props) {
  const [idea, setIdea] = useState<Idea | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('ideas')
      .select('*, profiles(handle, display_name, avatar_url), idea_vote_counts(upvote_count)')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setIdea(data as Idea | null);
      });
  }, [slug]);

  if (error) return <p className="card p-6 text-red-300">{error}</p>;
  if (!idea) return <p className="card p-6 text-braga-100">Loading idea...</p>;

  return (
    <article className="card flex gap-5 p-6">
      <UpvoteButton ideaId={idea.id} initialCount={idea.idea_vote_counts?.[0]?.upvote_count ?? 0} />
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-braga-300">{idea.month_key}</p>
        <h1 className="mt-3 text-4xl font-black text-white">{idea.title}</h1>
        <p className="mt-5 whitespace-pre-wrap leading-8 text-slate-200">{idea.body}</p>
        <p className="mt-6 text-sm text-slate-400">Suggested by {idea.profiles?.display_name ?? 'a Braga builder'}</p>
      </div>
    </article>
  );
}
