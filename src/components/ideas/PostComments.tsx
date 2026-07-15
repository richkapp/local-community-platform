import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentMemberRole } from '@/lib/admin';
import { isAnonymousUser } from '@/lib/anonymous';
import { toUserMessage } from '@/lib/errors';
import {
  buildPostCommentTree,
  createIdeaComment,
  listIdeaComments,
  toggleIdeaCommentUpvote
} from '@/lib/postComments';
import type { PostComment } from '@/lib/types';
import {
  getPostParticipationSettings,
  lockedPostParticipationSettings,
  type PostParticipationSettings
} from '@/lib/postParticipation';
import { useAuthUser } from '@/components/auth/useAuthUser';
import { CommentCard, CommentForm, type CommentAccess } from './PostCommentControls';

export default function PostComments({ ideaId }: { ideaId: string }) {
  const { user, loading: authLoading } = useAuthUser();
  const accountUserId = user && !isAnonymousUser(user) ? user.id : null;
  const [comments, setComments] = useState<PostComment[]>([]);
  const [access, setAccess] = useState<CommentAccess>('loading');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [participation, setParticipation] = useState<PostParticipationSettings>(lockedPostParticipationSettings);
  const [participationError, setParticipationError] = useState('');
  const loadSequence = useRef(0);
  const accessSequence = useRef(0);
  const voteSequence = useRef(0);
  const composerTriggerRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async (withLoading = true) => {
    const sequence = ++loadSequence.current;
    if (withLoading) setLoading(true);
    setError('');
    try {
      const nextComments = await listIdeaComments(ideaId);
      if (sequence === loadSequence.current) setComments(nextComments);
    } catch (caught) {
      if (sequence === loadSequence.current) setError(toUserMessage('idea-comments', caught));
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [ideaId, accountUserId]);

  useEffect(() => {
    if (authLoading) return;
    void load();
    return () => { loadSequence.current += 1; };
  }, [authLoading, load]);

  useEffect(() => {
    const sequence = ++accessSequence.current;
    if (authLoading) {
      setAccess('loading');
      return;
    }
    if (!accountUserId) {
      setAccess('signed-out');
      return;
    }
    setAccess('loading');
    getCurrentMemberRole()
      .then((role) => { if (sequence === accessSequence.current) setAccess(role ? 'active' : 'inactive'); })
      .catch(() => { if (sequence === accessSequence.current) setAccess('inactive'); });
    return () => { accessSequence.current += 1; };
  }, [accountUserId, authLoading]);

  useEffect(() => () => {
    voteSequence.current += 1;
  }, [accountUserId, ideaId]);

  useEffect(() => {
    let current = true;
    getPostParticipationSettings()
      .then((settings) => {
        if (!current) return;
        setParticipation(settings);
        setParticipationError('');
      })
      .catch(() => {
        if (!current) return;
        setParticipation(lockedPostParticipationSettings);
        setParticipationError('Anonymous comment settings could not be loaded.');
      });
    return () => { current = false; };
  }, [ideaId]);

  const tree = useMemo(() => buildPostCommentTree(comments), [comments]);

  function closeTopLevelComposer() {
    setComposerOpen(false);
    window.requestAnimationFrame(() => composerTriggerRef.current?.focus());
  }

  async function create(parentId: string | null, body: string, postAnonymously: boolean) {
    await createIdeaComment({ ideaId, parentId, body, postAnonymously });
    setReplyingTo(null);
    if (parentId === null) closeTopLevelComposer();
    await load(false);
  }

  async function vote(commentId: string) {
    const sequence = ++voteSequence.current;
    setVotingId(commentId);
    setError('');
    try {
      const result = await toggleIdeaCommentUpvote(commentId);
      if (sequence !== voteSequence.current) return;
      setComments((current) => current.map((comment) => comment.id === commentId
        ? { ...comment, upvote_count: result.upvote_count, viewer_has_upvoted: result.viewer_has_upvoted }
        : comment));
    } catch (caught) {
      if (sequence === voteSequence.current) setError(toUserMessage('idea-comment-vote', caught));
    } finally {
      if (sequence === voteSequence.current) setVotingId(null);
    }
  }

  return (
    <section id="comments" className="scroll-mt-28 border-t border-white/10 pt-6" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="text-lg font-black text-white">Comments <span className="font-semibold text-braga-300">({comments.length})</span></h2>

      <div className="mt-4">
        {access === 'active' && (composerOpen
          ? <CommentForm
              label="Leave a Comment"
              anonymousKind="comment"
              allowAnonymous={participation.allow_anonymous_comments}
              onCancel={closeTopLevelComposer}
              onSubmit={(body, postAnonymously) => create(null, body, postAnonymously)}
            />
          : <button ref={composerTriggerRef} type="button" className="min-h-11 w-full rounded-full border border-braga-300/35 px-4 text-left text-sm text-braga-300 transition hover:border-braga-200 hover:text-white" onClick={() => setComposerOpen(true)}>Leave a Comment</button>)}
        {access === 'signed-out' && <a className="flex min-h-11 w-full items-center rounded-full border border-braga-300/35 px-4 text-sm text-braga-300 transition hover:border-braga-200 hover:text-white" href="/signin">Leave a Comment <span className="ml-2 text-xs text-braga-300">— sign in required</span></a>}
        {access === 'inactive' && <button type="button" className="min-h-11 w-full cursor-not-allowed rounded-full border border-braga-300/20 px-4 text-left text-sm text-braga-300" disabled>Commenting is unavailable for this account</button>}
        {access === 'loading' && <p className="text-sm text-braga-300" role="status">Checking comment access…</p>}
      </div>

      {error && <p className="error-message mt-4" role="alert">{error}</p>}
      {participationError && access === 'active' && <p className="mt-4 text-xs leading-5 text-amber-100" role="status">{participationError}</p>}
      {loading
        ? <p className="mt-5 text-sm text-braga-300" role="status">Loading comments…</p>
        : tree.length > 0
          ? <ol className="mt-4 space-y-0">{tree.map((comment) => <CommentCard
              key={comment.id}
              comment={comment}
              depth={1}
              access={access}
              replyingTo={replyingTo}
              votingId={votingId}
              onReply={setReplyingTo}
              onCreateReply={(parentId, body, postAnonymously) => create(parentId, body, postAnonymously)}
              onVote={vote}
              allowAnonymousReplies={participation.allow_anonymous_replies}
            />)}</ol>
          : <p className="mt-5 text-sm text-braga-300">No comments yet.</p>}
    </section>
  );
}
