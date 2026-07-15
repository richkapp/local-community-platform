import { useEffect, useState } from 'react';
import { LuGhost, LuUserRound } from 'react-icons/lu';
import { resolveAvatarUrl } from '@/lib/avatar';
import { formatCommunityDate } from '@/lib/communityDate';
import type { PublicProfile } from '@/lib/types';
import PostAuthorPreview from './PostAuthorPreview';

function formatPostDate(value: string) {
  return formatCommunityDate(value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export default function PostAuthorIdentity({ profile, createdAt }: { profile: PublicProfile | null | undefined; createdAt: string }) {
  const source = profile ? resolveAvatarUrl(profile) : null;
  const [failedSource, setFailedSource] = useState<string | null>(null);

  useEffect(() => {
    setFailedSource(null);
  }, [source]);

  const image = source && source !== failedSource
    ? <img src={source} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" onError={() => setFailedSource(source)} />
    : profile
      ? <span className="grid h-8 w-8 place-items-center rounded-full border border-limewash/35 bg-limewash/10 text-limewash" aria-hidden="true"><LuUserRound className="h-4 w-4" /></span>
      : <span className="grid h-8 w-8 place-items-center rounded-full border border-dashed border-violet-300/50 bg-violet-500/15 text-violet-200" aria-hidden="true"><LuGhost className="h-4 w-4" /></span>;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0">{image}</span>
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <div className="min-w-0 truncate"><PostAuthorPreview profile={profile} variant="header" /></div>
        <span className="shrink-0 text-white/30" aria-hidden="true">•</span>
        <time dateTime={createdAt} className="shrink-0 text-braga-300">{formatPostDate(createdAt)}</time>
      </div>
    </div>
  );
}
