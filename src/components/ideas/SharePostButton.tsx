import { useEffect, useRef, useState } from 'react';
import { LuForward } from 'react-icons/lu';
import { sharePost } from '@/lib/postSharing';

type Props = {
  slug: string;
  title: string;
};

type ShareStatus = 'idle' | 'shared' | 'copied' | 'error';

export default function SharePostButton({ slug, title }: Props) {
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [busy, setBusy] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  function showStatus(next: Exclude<ShareStatus, 'idle'>) {
    setStatus(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setStatus('idle'), 2200);
  }

  async function share() {
    if (busy) return;
    setBusy(true);

    try {
      const outcome = await sharePost({ client: navigator, origin: window.location.origin, slug });
      if (outcome === 'shared') showStatus('shared');
      if (outcome === 'copied') showStatus('copied');
    } catch {
      showStatus('error');
    } finally {
      setBusy(false);
    }
  }

  const message = status === 'shared'
    ? 'Shared'
    : status === 'copied'
      ? 'Link copied'
      : status === 'error'
        ? 'Could not share'
        : '';

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-braga-300/30 text-braga-100 transition hover:border-violet-300/60 hover:text-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-300/60 disabled:cursor-wait disabled:opacity-60"
        onClick={() => void share()}
        disabled={busy}
        aria-label={`Share ${title}`}
        title="Share post"
      >
        <LuForward className="h-4 w-4" aria-hidden="true" />
      </button>
      {message && <span className={`absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold shadow-xl ${status === 'error' ? 'border-red-300/30 bg-ink-950 text-red-100' : 'border-limewash/30 bg-ink-950 text-limewash'}`} role="status">{message}</span>}
    </span>
  );
}
