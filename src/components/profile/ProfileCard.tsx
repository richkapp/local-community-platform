import type { IconType } from 'react-icons';
import { FaGithub, FaLinkedinIn, FaXTwitter } from 'react-icons/fa6';
import { LuGlobe } from 'react-icons/lu';
import type { PublicProfile } from '@/lib/types';
import { isHttpUrl } from '@/lib/profile';
import AvatarImage from './AvatarImage';

type SocialLink = { label: string; href: string; Icon: IconType };

export default function ProfileCard({ profile }: { profile: PublicProfile }) {
  const links = [
    { label: 'Website', href: profile.website_url, Icon: LuGlobe },
    { label: 'LinkedIn', href: profile.linkedin_url, Icon: FaLinkedinIn },
    { label: 'GitHub', href: profile.github_url, Icon: FaGithub },
    { label: 'X', href: profile.x_url, Icon: FaXTwitter }
  ].filter((entry): entry is SocialLink => Boolean(entry.href && isHttpUrl(entry.href)));

  const name = (
    <>
      <h2 className="text-xl font-semibold text-white">{profile.display_name}</h2>
      {profile.handle && <p className="text-sm text-limewash">@{profile.handle}</p>}
    </>
  );

  return (
    <article className="card h-full p-6">
      <div className="flex items-center gap-4">
        <AvatarImage profile={profile} imageClassName="h-14 w-14 shrink-0 rounded-2xl object-cover" fallbackClassName="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-limewash font-bold text-ink-950" />
        <div>{profile.handle ? <a href={`/members/${profile.handle}`} className="group hover:text-limewash">{name}</a> : name}</div>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-braga-100">{profile.bio || 'Sharing and learning with the local community.'}</p>
      {links.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Social links">
          {links.map(({ label, href, Icon }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer noopener" aria-label={label} title={label} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-braga-300/25 bg-white/[0.03] text-braga-100 transition hover:-translate-y-0.5 hover:border-limewash/70 hover:bg-limewash/10 hover:text-limewash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limewash">
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
