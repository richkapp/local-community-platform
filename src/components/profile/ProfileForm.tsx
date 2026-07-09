import { useEffect, useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { fetchMyProfile, updateMyProfile } from '@/lib/profile';
import type { Profile } from '@/lib/types';

const emptyProfile: Partial<Profile> = {
  handle: '',
  display_name: '',
  bio: '',
  website_url: '',
  linkedin_url: '',
  github_url: '',
  avatar_url: '',
  is_public: true
};

export default function ProfileForm() {
  const [profile, setProfile] = useState<Partial<Profile>>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMyProfile()
      .then((data) => setProfile(data))
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  function setField<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const saved = await updateMyProfile({
        handle: profile.handle || null,
        display_name: profile.display_name || 'New builder',
        bio: profile.bio || '',
        website_url: profile.website_url || null,
        linkedin_url: profile.linkedin_url || null,
        github_url: profile.github_url || null,
        avatar_url: profile.avatar_url || null,
        is_public: Boolean(profile.is_public)
      });
      setProfile(saved);
      setMessage('Profile saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="card p-6 text-braga-100">Loading profile...</p>;

  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="display_name">Display name</label>
          <input id="display_name" className="input mt-2" value={profile.display_name ?? ''} onChange={(event) => setField('display_name', event.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="handle">Handle</label>
          <input id="handle" className="input mt-2" value={profile.handle ?? ''} onChange={(event) => setField('handle', event.target.value.toLowerCase())} placeholder="ana-builder" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="bio">Bio</label>
        <textarea id="bio" className="input mt-2 min-h-32" value={profile.bio ?? ''} onChange={(event) => setField('bio', event.target.value)} />
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <input className="input" placeholder="Website URL" value={profile.website_url ?? ''} onChange={(event) => setField('website_url', event.target.value)} />
        <input className="input" placeholder="LinkedIn URL" value={profile.linkedin_url ?? ''} onChange={(event) => setField('linkedin_url', event.target.value)} />
        <input className="input" placeholder="GitHub URL" value={profile.github_url ?? ''} onChange={(event) => setField('github_url', event.target.value)} />
      </div>
      <label className="flex items-center gap-3 text-sm text-braga-100">
        <input type="checkbox" checked={Boolean(profile.is_public)} onChange={(event) => setField('is_public', event.target.checked)} />
        Show my profile in the member directory
      </label>
      <button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
      {message && <p className="text-sm text-limewash">{message}</p>}
    </form>
  );
}
