import { useEffect, useRef, useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { fetchMyProfile, updateMyProfile } from '@/lib/profile';
import { mergeSavedProfileWithAvatar } from '@/lib/profileDraft';
import { toUserMessage } from '@/lib/errors';
import type { EditableProfile, EditableProfileRecord } from '@/lib/types';
import type { AvatarState } from '@/lib/avatar';
import { communityConfig } from '@/config/community';
import AuthRequired from '@/components/auth/AuthRequired';
import { useAuthUser } from '@/components/auth/useAuthUser';
import { isAnonymousUser } from '@/lib/anonymous';
import { FaGithub, FaLinkedinIn, FaXTwitter } from 'react-icons/fa6';
import { LuEye, LuGlobe } from 'react-icons/lu';
import AvatarUploader from './AvatarUploader';

const emptyProfile: Partial<EditableProfileRecord> = {
  handle: '',
  display_name: '',
  bio: '',
  website_url: '',
  linkedin_url: '',
  github_url: '',
  x_url: '',
  avatar_url: '',
  avatar_path: null,
  is_public: false
};

export default function ProfileForm() {
  const { user, loading: authLoading } = useAuthUser();
  const userId = user?.id ?? null;
  const userIsAnonymous = isAnonymousUser(user);
  const profileIdentity = userId && !userIsAnonymous ? userId : null;
  const identityGenerationRef = useRef(0);
  const avatarRevisionRef = useRef(0);
  const [profile, setProfile] = useState<Partial<EditableProfileRecord>>(emptyProfile);
  const [profileOwnerId, setProfileOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const generation = identityGenerationRef.current + 1;
    identityGenerationRef.current = generation;
    avatarRevisionRef.current = 0;
    const isCurrentIdentity = () => active && identityGenerationRef.current === generation;
    if (authLoading) return;
    if (!profileIdentity) {
      setProfile(emptyProfile);
      setProfileOwnerId(null);
      setSaving(false);
      setMessage('');
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setProfile(emptyProfile);
    setProfileOwnerId(null);
    setSaving(false);
    setMessage('');
    setError('');
    fetchMyProfile()
      .then((data) => {
        if (isCurrentIdentity() && data.id === profileIdentity) {
          setProfile(data);
          setProfileOwnerId(profileIdentity);
        }
      })
      .catch((caught) => {
        if (isCurrentIdentity()) {
          setProfileOwnerId(profileIdentity);
          setError(toUserMessage('profile-load', caught));
        }
      })
      .finally(() => {
        if (isCurrentIdentity()) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, profileIdentity]);

  function setField<K extends keyof EditableProfile>(key: K, value: EditableProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function applyAvatar(identity: string, generation: number, avatar: AvatarState) {
    if (identity !== profileIdentity || generation !== identityGenerationRef.current) return;
    avatarRevisionRef.current += 1;
    setProfile((current) => ({
      ...current,
      avatar_path: avatar.avatar_path,
      avatar_url: avatar.avatar_url,
      updated_at: avatar.avatar_updated_at ?? current.updated_at
    }));
  }

  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    const submittingIdentity = profileOwnerId;
    if (!submittingIdentity || submittingIdentity !== profileIdentity) return;
    const submittingGeneration = identityGenerationRef.current;
    const submittingAvatarRevision = avatarRevisionRef.current;
    const isCurrentIdentity = () => identityGenerationRef.current === submittingGeneration;

    setSaving(true);
    setMessage('');
    setError('');
    try {
      const saved = await updateMyProfile(submittingIdentity, {
        handle: profile.handle?.trim().toLowerCase() || null,
        display_name: profile.display_name?.trim() || 'New builder',
        bio: profile.bio?.trim() || '',
        website_url: profile.website_url || null,
        linkedin_url: profile.linkedin_url || null,
        github_url: profile.github_url || null,
        x_url: profile.x_url || null,
        is_public: Boolean(profile.is_public)
      });
      if (!isCurrentIdentity() || saved.id !== submittingIdentity) return;
      setProfile((current) => mergeSavedProfileWithAvatar(
        saved,
        current,
        avatarRevisionRef.current !== submittingAvatarRevision
      ));
      setMessage('Profile saved.');
    } catch (caught) {
      if (isCurrentIdentity()) setError(toUserMessage('profile-save', caught));
    } finally {
      if (isCurrentIdentity()) setSaving(false);
    }
  }

  if (authLoading) return <p className="card p-6 text-braga-100" role="status">Loading profile…</p>;
  if (!profileIdentity) return <AuthRequired title="Join the community to create a member profile" message="Ideas work without an account. Use a private invite when you want a member profile or event access." />;
  if (loading || profileOwnerId !== profileIdentity) return <p className="card p-6 text-braga-100" role="status">Loading profile…</p>;
  if (error && !profile.display_name) return <p className="error-message" role="alert">{error}</p>;

  return (
    <form onSubmit={submit} className="card space-y-5 p-6" aria-busy={saving}>
      <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-violet-400/50 bg-violet-500/15 p-5 text-violet-50 shadow-[0_0_30px_rgba(139,92,246,0.08)] transition hover:border-violet-300/80 hover:bg-violet-500/20">
        <input className="mt-1 h-5 w-5 shrink-0 accent-violet-500" type="checkbox" checked={Boolean(profile.is_public)} onChange={(event) => setField('is_public', event.target.checked)} />
        <LuEye className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" aria-hidden="true" />
        <span>
          <strong className="block text-base text-white">Show my profile in the member directory</strong>
          <span className="mt-1 block text-sm leading-6 text-violet-100/80">Turn this on so other {communityConfig.name} members can find your profile and social links.</span>
        </span>
      </label>
      <AvatarUploader
        expectedUserId={profileIdentity}
        identityGeneration={identityGenerationRef.current}
        profile={{
          display_name: profile.display_name || 'New builder',
          avatar_url: profile.avatar_url,
          avatar_path: profile.avatar_path,
          updated_at: profile.updated_at
        }}
        onAvatarChange={applyAvatar}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="display_name">Display name</label>
          <input id="display_name" className="input mt-2" value={profile.display_name ?? ''} onChange={(event) => setField('display_name', event.target.value)} maxLength={80} required />
        </div>
        <div>
          <label className="label" htmlFor="handle">Handle</label>
          <input id="handle" className="input mt-2" value={profile.handle ?? ''} onChange={(event) => setField('handle', event.target.value.toLowerCase())} pattern="[a-z0-9](?:[a-z0-9]|-){2,39}" maxLength={40} placeholder="ana-builder" />
          <p className="mt-2 text-xs text-braga-200">3–40 lowercase letters, numbers, or hyphens.</p>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="bio">Bio</label>
        <textarea id="bio" className="input mt-2 min-h-32" value={profile.bio ?? ''} onChange={(event) => setField('bio', event.target.value)} maxLength={600} />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="label flex items-center gap-2" htmlFor="website_url"><LuGlobe aria-hidden="true" /> Website URL</label>
          <input id="website_url" type="url" className="input mt-2" value={profile.website_url ?? ''} onChange={(event) => setField('website_url', event.target.value)} placeholder="https://example.com" />
        </div>
        <div>
          <label className="label flex items-center gap-2" htmlFor="linkedin_url"><FaLinkedinIn aria-hidden="true" /> LinkedIn URL</label>
          <input id="linkedin_url" type="url" className="input mt-2" value={profile.linkedin_url ?? ''} onChange={(event) => setField('linkedin_url', event.target.value)} placeholder="https://linkedin.com/in/…" />
        </div>
        <div>
          <label className="label flex items-center gap-2" htmlFor="github_url"><FaGithub aria-hidden="true" /> GitHub URL</label>
          <input id="github_url" type="url" className="input mt-2" value={profile.github_url ?? ''} onChange={(event) => setField('github_url', event.target.value)} placeholder="https://github.com/…" />
        </div>
        <div>
          <label className="label flex items-center gap-2" htmlFor="x_url"><FaXTwitter aria-hidden="true" /> X URL</label>
          <input id="x_url" type="url" className="input mt-2" value={profile.x_url ?? ''} onChange={(event) => setField('x_url', event.target.value)} placeholder="https://x.com/…" />
        </div>
      </div>
      <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
      {message && <p className="status-message" role="status" aria-live="polite">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
    </form>
  );
}
