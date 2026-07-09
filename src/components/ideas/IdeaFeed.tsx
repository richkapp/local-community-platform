import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Idea } from '@/lib/types';
import UpvoteButton from './UpvoteButton';

function voteCount(idea: Idea) {
  return idea.idea_vote_counts?.[0]?.upvote_count ?? 0;
}

export default function IdeaFeed() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('ideas')
      .select('*, profiles(handle, display_name, avatar_url), idea_vote_counts(upvote_count)')
      .neq('status', 'hidden')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setIdeas((data ?? []) as Idea[]);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="card p-6 text-braga-100">Loading ideas...</p>;
  if (error) return <p className="card p-6 text-red-300">{error}</p>;

  return (
    <div className="space-y-4">
      {ideas.map((idea) => (
        <article key={idea.id} className="card flex gap-4 p-5">
          <UpvoteButton ideaId={idea.id} initialCount={voteCount(idea)} />
          <div>
            <a href={`/ideas/${idea.slug}`} className="text-xl font-bold text-white hover:text-braga-200">{idea.title}</a>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{idea.body}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-braga-300">{idea.month_key} · {idea.profiles?.display_name ?? 'Builder'}</p>
          </div>
        </article>
      ))}
      {ideas.length === 0 && <p className="card p-6 text-slate-300">No ideas yet. Be the first to suggest one.</p>}
    </div>
  );
}
