import { useState } from 'react';
import { toggleUpvote } from '@/lib/ideas';
import { hasAnonymousVote } from '@/lib/anonymous';
import { toUserMessage } from '@/lib/errors';

type Props = {
  ideaId: string;
  initialCount: number;
  initialVoted?: boolean;
  disabled?: boolean;
};

export default function UpvoteButton({ ideaId, initialCount, initialVoted = false, disabled = false }: Props) {
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(() => initialVoted || hasAnonymousVote(ideaId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function click() {
    setBusy(true);
    setError('');
    try {
      const next = await toggleUpvote(ideaId, voted);
      setVoted(next);
      setCount((current) => current + (next === voted ? 0 : next ? 1 : -1));
    } catch (caught) {
      setError(toUserMessage('idea-vote', caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <button
        type="button"
        className={voted ? 'btn-primary' : 'btn-secondary'}
        disabled={busy || disabled}
        onClick={click}
        aria-pressed={voted}
        aria-label={`${voted ? 'Remove upvote from' : 'Upvote'} idea, ${count} ${count === 1 ? 'upvote' : 'upvotes'}`}
      >
        ↑ {count}
      </button>
      {error && <p className="max-w-32 text-center text-xs text-red-200" role="alert">{error}</p>}
    </div>
  );
}
