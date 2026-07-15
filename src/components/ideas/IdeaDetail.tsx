import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toUserMessage } from '@/lib/errors';
import { attachPublicAuthors, getMyPostRelationships } from '@/lib/ideas';
import { isAnonymousUser } from '@/lib/anonymous';
import { getCurrentMemberRole } from '@/lib/admin';
import { ripCategoryLabel, ripTagLabel } from '@/lib/rips';
import type { Idea } from '@/lib/types';
import UpvoteButton from './UpvoteButton';
import PostAuthorPreview from './PostAuthorPreview';
import BookmarkButton, { type BookmarkAccess } from './BookmarkButton';
import PostComments from './PostComments';
import SharePostButton from './SharePostButton';
import { usePostTagCatalog } from './usePostTagCatalog';

type Props = { slug: string };
type VoteCountRow = { upvote_count: number };

export default function IdeaDetail({ slug }: Props) {
  const { tags: tagCatalog } = usePostTagCatalog();
  const tagLabels = useMemo(() => new Map(tagCatalog.map((tag) => [tag.slug, tag.label])), [tagCatalog]);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [bookmarkAccess, setBookmarkAccess] = useState<BookmarkAccess>('signed-out');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      setBookmarkAccess('signed-out');
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
        let hasBookmarked = false;
        const accountUser = userData.user && !isAnonymousUser(userData.user) ? userData.user : null;
        if (accountUser) {
          const { data: vote, error: voteError } = await supabase
            .from('idea_votes')
            .select('idea_id')
            .eq('idea_id', data.id)
            .eq('user_id', accountUser.id)
            .maybeSingle();
          if (voteError) throw voteError;
          hasVoted = Boolean(vote);

          const memberRole = await getCurrentMemberRole();
          if (memberRole) {
            const relationships = await getMyPostRelationships(data.id);
            hasBookmarked = relationships.some((relationship) => relationship.idea_id === data.id && relationship.viewer_has_bookmarked);
            setBookmarkAccess('active');
          } else {
            setBookmarkAccess('inactive');
          }
        }

        const [withAuthor] = await attachPublicAuthors([data as Idea]);
        setIdea({
          ...withAuthor,
          upvote_count: ((counts ?? null) as VoteCountRow | null)?.upvote_count ?? 0,
          viewer_has_voted: hasVoted,
          viewer_has_bookmarked: hasBookmarked
        });
      } catch (caught) {
        setError(toUserMessage('idea-detail', caught));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [slug]);

  useEffect(() => {
    if (!idea || window.location.hash !== '#comments') return;
    window.requestAnimationFrame(() => {
      document.getElementById('comments')?.scrollIntoView({ block: 'start' });
    });
  }, [idea?.id]);

  if (loading) return <p className="card p-6 text-braga-100" role="status">Loading post…</p>;
  if (error) return <p className="error-message" role="alert">{error}</p>;
  if (!idea) return <div className="card p-6"><h1 className="text-2xl font-semibold">Post not found</h1><a href="/posts" className="mt-4 inline-flex text-limewash">Back to posts</a></div>;

  return (
    <div className="space-y-8">
      <article className="card relative flex flex-col gap-4 p-5 sm:flex-row sm:gap-5 sm:p-6">
        <UpvoteButton ideaId={idea.id} initialCount={idea.upvote_count ?? 0} initialVoted={idea.viewer_has_voted ?? false} disabled={idea.status === 'closed'} />
        <div className="min-w-0 max-w-3xl pr-0 sm:pr-28">
          <div className="flex flex-wrap gap-2"><span className="rounded-full border border-limewash/30 bg-limewash/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-limewash">{ripCategoryLabel(idea.category)}</span>{idea.tags.map((tag) => <span key={tag} className="rounded-full border border-violet-300/25 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-200">{tagLabels.get(tag) ?? ripTagLabel(tag)}</span>)}</div>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-braga-300">{idea.month_key}</p>
          <h1 className="mt-3 break-words text-4xl font-black text-white">{idea.title}</h1>
          <p className="mt-5 whitespace-pre-wrap break-words leading-8 text-braga-100">{idea.body}</p>
          <div className="mt-6 flex items-center gap-2 text-sm text-braga-200"><span>Shared by</span><PostAuthorPreview profile={idea.profiles} /></div>
          {bookmarkAccess === 'inactive' && <p className="mt-4 rounded-xl border border-braga-300/20 bg-braga-950/45 px-4 py-3 text-sm leading-6 text-braga-100">Bookmarking is unavailable because this account’s community membership is not active. Contact an organizer if that looks wrong.</p>}
        </div>
        <div className="absolute right-4 top-4 flex gap-2">
          <BookmarkButton ideaId={idea.id} title={idea.title} initialBookmarked={idea.viewer_has_bookmarked} access={bookmarkAccess} onChange={(bookmarked) => setIdea((current) => current ? { ...current, viewer_has_bookmarked: bookmarked } : current)} />
          <SharePostButton slug={idea.slug} title={idea.title} />
        </div>
      </article>
      <PostComments ideaId={idea.id} />
    </div>
  );
}
