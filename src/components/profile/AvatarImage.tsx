import { useEffect, useState } from 'react';
import { resolveAvatarUrl } from '@/lib/avatar';

type AvatarProfile = {
  display_name: string;
  avatar_url?: string | null;
  avatar_path?: string | null;
  avatar_updated_at?: string | null;
  updated_at?: string | null;
};

type Props = {
  profile: AvatarProfile;
  imageClassName: string;
  fallbackClassName: string;
  previewUrl?: string | null;
  loading?: 'eager' | 'lazy';
};

export default function AvatarImage({ profile, imageClassName, fallbackClassName, previewUrl, loading = 'lazy' }: Props) {
  const source = previewUrl ?? resolveAvatarUrl(profile);
  const [failedSource, setFailedSource] = useState<string | null>(null);

  useEffect(() => {
    setFailedSource(null);
  }, [source]);

  if (source && source !== failedSource) {
    return <img src={source} alt="" className={imageClassName} loading={loading} onError={() => setFailedSource(source)} />;
  }

  const initials = profile.display_name.trim().slice(0, 2).toUpperCase() || 'BA';
  return <span className={fallbackClassName} aria-hidden="true">{initials}</span>;
}
