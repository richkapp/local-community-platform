import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toUserMessage } from '@/lib/errors';
import { attachPublicAuthors } from '@/lib/ideas';
import { ripCategoryLabel, ripTagLabel } from '@/lib/rips';
import type { Idea } from '@/lib/types';
import UpvoteButton from './UpvoteButton';
import PostAuthorPreview from './PostAuthorPreview';

type Props = { slug: string };
type VoteCountRow = { upvote_count: number };

export default function IdeaDetail({ slug }: Props) {
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data: rawData, error: queryError } = await supabase
          .rpc('list_visible_ideas')
          .eq('slug', slug)
          .maybeSingle();
        if (queryError) throw queryError;
        const data = rawData as Idea | null;
        if (!data) {
          setIdea(null);
          return;
        }

        const [{ data: counts, error: countError }, { data: userData }] = await Promise.all([
          supabase.from('idea_vote_counts').select('upvote_count').eq('idea_id', data.id).maybeSingle(),
          supabase.auth.getUser()
        ]);
        if (countError) throw countError;

        let hasVoted = false;
        if (userData.user) {
          const { data: vote, error: voteError } = await supabase
            .from('idea_votes')
            .select('idea_id')
            .eq('idea_id', data.id)
            .eq('user_id', userData.user.id)
            .maybeSingle();
          if (voteError) throw voteError;
          hasVoted = Boolean(vote);
        }

        const [withAuthor] = await attachPublicAuthors([data as Idea]);
        setIdea({
          ...withAuthor,
          upvote_count: ((counts ?? null) as VoteCountRow | null)?.upvote_count ?? 0,
          viewer_has_voted: hasVoted
        });
      } catch (caught) {
        setError(toUserMessage('idea-detail', caught));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [slug]);

  if (loading) return <p className="card p-6 text-braga-100" role="status">Loading post…</p>;
  if (error) return <p className="error-message" role="alert">{error}</p>;
  if (!idea) return <div className="card p-6"><h1 className="text-2xl font-semibold">Post not found</h1><a href="/ideas" className="mt-4 inline-flex text-limewash">Back to posts</a></div>;

  return (
    <article className="card flex gap-5 p-6">
      <UpvoteButton ideaId={idea.id} initialCount={idea.upvote_count ?? 0} initialVoted={idea.viewer_has_voted ?? false} disabled={idea.status === 'closed'} />
      <div className="min-w-0 max-w-3xl">
        <div className="flex flex-wrap gap-2"><span className="rounded-full border border-limewash/30 bg-limewash/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-limewash">{ripCategoryLabel(idea.category)}</span>{idea.tags.map((tag) => <span key={tag} className="rounded-full border border-violet-300/25 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-200">{ripTagLabel(tag)}</span>)}</div>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-braga-300">{idea.month_key}</p>
        <h1 className="mt-3 break-words text-4xl font-black text-white">{idea.title}</h1>
        <p className="mt-5 whitespace-pre-wrap break-words leading-8 text-braga-100">{idea.body}</p>
        <div className="mt-6 flex items-center gap-2 text-sm text-braga-200"><span>Shared by</span><PostAuthorPreview profile={idea.profiles} /></div>
      </div>
    </article>
  );
}
