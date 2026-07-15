import { useEffect, useId, useState } from 'react';
import { LuArrowUp, LuGhost, LuReply, LuUser } from 'react-icons/lu';
import type { FormSubmitEvent } from '@/lib/dom';
import { toUserMessage } from '@/lib/errors';
import type { PostCommentNode } from '@/lib/postComments';

export type CommentAccess = 'loading' | 'signed-out' | 'inactive' | 'active';

function CommentAuthorIdentity({ comment }: { comment: PostCommentNode }) {
  const profile = comment.profiles;
  const identity = profile ? (
    <>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-limewash/10 text-limewash" aria-hidden="true"><LuUser className="h-4 w-4" /></span>
      <span className="font-bold text-white">{profile.display_name}</span>
    </>
  ) : comment.is_anonymous ? (
    <>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/10 text-violet-200" aria-hidden="true"><LuGhost className="h-4 w-4" /></span>
      <span className="font-bold text-white">Anonymous</span>
    </>
  ) : (
    <>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-braga-300" aria-hidden="true"><LuUser className="h-4 w-4" /></span>
      <span className="font-bold text-white">Former member</span>
    </>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-braga-300">
      {profile?.handle
        ? <a className="inline-flex items-center gap-2 hover:text-limewash" href={`/members/${encodeURIComponent(profile.handle)}`}>{identity}</a>
        : <span className="inline-flex items-center gap-2">{identity}</span>}
      <span aria-hidden="true">•</span>
      <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</time>
    </div>
  );
}

type CommentFormProps = {
  label: string;
  anonymousKind: 'comment' | 'reply';
  allowAnonymous: boolean;
  onSubmit: (body: string, postAnonymously: boolean) => Promise<void>;
  onCancel: () => void;
};

export function CommentForm({ label, anonymousKind, allowAnonymous, onSubmit, onCancel }: CommentFormProps) {
  const fieldId = useId();
  const [body, setBody] = useState('');
  const [postAnonymously, setPostAnonymously] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!allowAnonymous) setPostAnonymously(false);
  }, [allowAnonymous]);

  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit(body, postAnonymously);
      setBody('');
      setPostAnonymously(false);
    } catch (caught) {
      setError(toUserMessage('idea-comment-create', caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="overflow-hidden rounded-2xl border border-braga-300/35 bg-ink-950/25 focus-within:border-braga-200/70" onSubmit={submit}>
      <label className="sr-only" htmlFor={fieldId}>{label}</label>
      <textarea
        id={fieldId}
        className="min-h-28 w-full resize-y bg-transparent px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-braga-300"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={1500}
        placeholder={anonymousKind === 'reply' ? 'Write a reply' : 'Join the conversation'}
        required
        autoFocus
      />
      <div className="flex flex-col gap-3 border-t border-white/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <label className={`flex min-h-11 items-center gap-2 text-sm ${allowAnonymous ? 'cursor-pointer text-braga-100' : 'cursor-not-allowed text-braga-300'}`}>
            <input
              type="checkbox"
              className="h-4 w-4 accent-limewash disabled:cursor-not-allowed disabled:opacity-50"
              checked={postAnonymously}
              onChange={(event) => setPostAnonymously(event.target.checked)}
              disabled={!allowAnonymous}
            />
            Post anon?
          </label>
          {!allowAnonymous && <p className="text-xs leading-5 text-braga-300">Anonymous {anonymousKind === 'reply' ? 'replies' : 'comments'} are disabled.</p>}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="min-h-11 rounded-full px-4 text-sm font-bold text-braga-100 transition hover:bg-white/5 hover:text-white" disabled={saving} onClick={onCancel}>Cancel</button>
          <button type="submit" className="min-h-11 rounded-full bg-limewash px-5 text-sm font-black text-ink-950 transition hover:bg-limewash/90 disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || body.trim().length === 0}>
            {saving ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
      {error && <p className="error-message m-3" role="alert">{error}</p>}
    </form>
  );
}

type CommentCardProps = {
  comment: PostCommentNode;
  depth: number;
  access: CommentAccess;
  replyingTo: string | null;
  votingId: string | null;
  onReply: (commentId: string | null) => void;
  onCreateReply: (parentId: string, body: string, postAnonymously: boolean) => Promise<void>;
  onVote: (commentId: string) => Promise<void>;
  allowAnonymousReplies: boolean;
};

export function CommentCard({ comment, depth, access, replyingTo, votingId, onReply, onCreateReply, onVote, allowAnonymousReplies }: CommentCardProps) {
  const authorName = comment.profiles?.display_name ?? (comment.is_anonymous ? 'Anonymous' : 'Former member');
  const voteLabel = `${comment.viewer_has_upvoted ? 'Remove upvote from' : 'Upvote'} comment by ${authorName}`;

  return (
    <li>
      <article className="py-3">
        <CommentAuthorIdentity comment={comment} />
        <p className="ml-10 mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-braga-100">{comment.body}</p>
        <footer className="ml-9 mt-1 flex flex-wrap items-center gap-1">
          <button
            type="button"
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-limewash/70 ${comment.viewer_has_upvoted ? 'text-limewash' : 'text-braga-300 hover:bg-white/5 hover:text-white'}`}
            disabled={access !== 'active' || votingId !== null}
            aria-pressed={comment.viewer_has_upvoted}
            aria-label={voteLabel}
            title={access === 'active' ? voteLabel : 'Sign in with an active member account to upvote comments'}
            onClick={() => void onVote(comment.id)}
          >
            <LuArrowUp className="h-4 w-4" aria-hidden="true" />
            {comment.upvote_count}
          </button>
          {access === 'active' && <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold text-braga-300 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-limewash/70"
            aria-expanded={replyingTo === comment.id}
            onClick={() => onReply(replyingTo === comment.id ? null : comment.id)}
          >
            <LuReply className="h-4 w-4" aria-hidden="true" />
            Reply
          </button>}
        </footer>
      </article>

      {replyingTo === comment.id && <div className="mb-2 ml-10">
        <CommentForm
          label={`Reply to ${authorName}`}
          anonymousKind="reply"
          allowAnonymous={allowAnonymousReplies}
          onCancel={() => onReply(null)}
          onSubmit={(body, postAnonymously) => onCreateReply(comment.id, body, postAnonymously)}
        />
      </div>}

      {comment.replies.length > 0 && <ol
        className={`space-y-0 border-l border-braga-300/25 ${depth <= 3 ? 'pl-2 sm:ml-5 sm:pl-4' : 'pl-0 sm:ml-0 sm:pl-0'}`}
      >
        {comment.replies.map((reply) => <CommentCard
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          access={access}
          replyingTo={replyingTo}
          votingId={votingId}
          onReply={onReply}
          onCreateReply={onCreateReply}
          onVote={onVote}
          allowAnonymousReplies={allowAnonymousReplies}
        />)}
      </ol>}
    </li>
  );
}
