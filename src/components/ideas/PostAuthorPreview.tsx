import type { IconType } from 'react-icons';
import { FaGithub, FaLinkedinIn, FaXTwitter } from 'react-icons/fa6';
import { LuGlobe } from 'react-icons/lu';
import type { PublicProfile } from '@/lib/types';
import { isHttpUrl } from '@/lib/profile';
import AvatarImage from '@/components/profile/AvatarImage';

type SocialLink = { label: string; href: string; Icon: IconType };

export default function PostAuthorPreview({ profile, variant = 'meta' }: { profile: PublicProfile | null | undefined; variant?: 'meta' | 'header' }) {
  if (!profile?.handle) return <span className={variant === 'header' ? 'font-bold text-white' : undefined}>{profile?.display_name ?? 'Anonymous'}</span>;

  const profileHref = `/members/${profile.handle}`;
  const links = [
    { label: 'Website', href: profile.website_url, Icon: LuGlobe },
    { label: 'LinkedIn', href: profile.linkedin_url, Icon: FaLinkedinIn },
    { label: 'GitHub', href: profile.github_url, Icon: FaGithub },
    { label: 'X', href: profile.x_url, Icon: FaXTwitter }
  ].filter((entry): entry is SocialLink => Boolean(entry.href && isHttpUrl(entry.href)));

  return (
    <span className="group relative inline-flex normal-case tracking-normal">
      <a href={profileHref} className={`${variant === 'header' ? 'font-bold text-white' : 'font-bold uppercase tracking-[0.16em] text-braga-300'} underline-offset-4 transition hover:text-limewash hover:underline focus-visible:text-limewash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limewash/70`} aria-label={`View ${profile.display_name}'s member profile`}>
        {profile.display_name}
      </a>
      <span className="pointer-events-none invisible absolute bottom-full left-0 z-50 hidden w-72 pb-3 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 sm:block">
        <span className="block rounded-2xl border border-braga-300/25 bg-ink-900 p-4 text-left shadow-2xl shadow-black/40">
          <span className="flex items-center gap-3">
            <AvatarImage profile={profile} imageClassName="h-12 w-12 shrink-0 rounded-xl object-cover" fallbackClassName="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-limewash font-black text-ink-950" />
            <span className="min-w-0">
              <a href={profileHref} className="block truncate text-base font-bold text-white hover:text-limewash">{profile.display_name}</a>
              <span className="block truncate text-xs text-limewash">@{profile.handle}</span>
            </span>
          </span>
          <span className="mt-3 block line-clamp-3 text-sm leading-6 text-braga-100">{profile.bio || 'Sharing and learning with the local community.'}</span>
          {links.length > 0 && (
            <span className="mt-4 flex gap-2" aria-label={`${profile.display_name}'s links`}>
              {links.map(({ label, href, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer noopener" aria-label={`${profile.display_name} on ${label}`} title={label} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-braga-300/25 bg-white/[0.03] text-braga-100 transition hover:border-limewash/70 hover:bg-limewash/10 hover:text-limewash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limewash">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}
