import type { Profile } from '@/lib/types';

type Props = {
  profile: Pick<Profile, 'handle' | 'display_name' | 'bio' | 'avatar_url' | 'website_url' | 'linkedin_url' | 'github_url'>;
};

export default function ProfileCard({ profile }: Props) {
  return (
    <article className="card p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-braga-400 font-bold text-ink-950">
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : profile.display_name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h3 className="font-bold text-white">{profile.display_name}</h3>
          {profile.handle && <p className="text-sm text-braga-200">@{profile.handle}</p>}
          <p className="mt-3 text-sm leading-6 text-slate-300">{profile.bio || 'Building with AI in Braga.'}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-braga-200">
            {profile.website_url && <a href={profile.website_url}>Website</a>}
            {profile.linkedin_url && <a href={profile.linkedin_url}>LinkedIn</a>}
            {profile.github_url && <a href={profile.github_url}>GitHub</a>}
          </div>
        </div>
      </div>
    </article>
  );
}
