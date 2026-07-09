import { useState } from 'react';
import { toggleUpvote } from '@/lib/ideas';

type Props = {
  ideaId: string;
  initialCount: number;
  initialVoted?: boolean;
};

export default function UpvoteButton({ ideaId, initialCount, initialVoted = false }: Props) {
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(initialVoted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function click() {
    setBusy(true);
    setError('');
    try {
      const next = await toggleUpvote(ideaId, voted);
      setVoted(next);
      setCount((current) => current + (next ? 1 : -1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update vote.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button className={voted ? 'btn-primary' : 'btn-secondary'} disabled={busy} onClick={click} aria-label="Upvote idea">
        ↑ {count}
      </button>
      {error && <p className="max-w-32 text-center text-xs text-red-300">{error}</p>}
    </div>
  );
}
