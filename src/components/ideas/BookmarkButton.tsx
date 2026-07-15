import { useEffect, useState } from 'react';
import { LuBookmark } from 'react-icons/lu';
import { setIdeaBookmark } from '@/lib/ideas';
import { toUserMessage } from '@/lib/errors';

export type BookmarkAccess = 'active' | 'signed-out' | 'inactive';

type Props = {
  ideaId: string;
  title: string;
  initialBookmarked?: boolean;
  access: BookmarkAccess;
  onChange?: (bookmarked: boolean) => void;
};

const controlClass = 'inline-flex h-11 w-11 items-center justify-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-limewash/70';

export default function BookmarkButton({ ideaId, title, initialBookmarked = false, access, onChange }: Props) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setBookmarked(initialBookmarked), [initialBookmarked]);

  if (access === 'signed-out') {
    return (
      <a
        href="/signin"
        className={`${controlClass} border-braga-300/30 text-braga-200 hover:border-limewash/70 hover:text-limewash`}
        aria-label={`Sign in to bookmark ${title}`}
        title="Sign in to bookmark"
      >
        <LuBookmark className="h-4 w-4" aria-hidden="true" />
      </a>
    );
  }

  if (access === 'inactive') {
    return (
      <button
        type="button"
        className={`${controlClass} cursor-not-allowed border-braga-300/20 text-braga-300/60`}
        aria-label={`Member access required to bookmark ${title}`}
        title="Member access is not active"
        disabled
      >
        <LuBookmark className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  async function setBookmark() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const next = await setIdeaBookmark(ideaId, !bookmarked);
      setBookmarked(next);
      onChange?.(next);
    } catch (caught) {
      setError(toUserMessage('idea-bookmark', caught));
    } finally {
      setSaving(false);
    }
  }

  const label = bookmarked ? `Remove ${title} from bookmarks` : `Bookmark ${title}`;
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className={`${controlClass} ${bookmarked ? 'border-limewash/60 bg-limewash/15 text-limewash' : 'border-braga-300/30 text-braga-200 hover:border-limewash/70 hover:text-limewash'}`}
        onClick={() => void setBookmark()}
        disabled={saving}
        aria-label={label}
        aria-pressed={bookmarked}
        title={bookmarked ? 'Remove bookmark' : 'Bookmark post'}
      >
        <LuBookmark className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
      {error && <span className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-red-300/30 bg-ink-950 px-3 py-2 text-left text-xs font-medium normal-case leading-5 text-red-100 shadow-xl" role="alert">{error}</span>}
    </span>
  );
}
