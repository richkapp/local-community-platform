import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import ProfileCard from './ProfileCard';

export default function MemberDirectory() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, handle, display_name, bio, avatar_url, website_url, linkedin_url, github_url, role, is_public, created_at, updated_at')
      .eq('is_public', true)
      .order('display_name')
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setProfiles((data ?? []) as Profile[]);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="card p-6 text-braga-100">Loading members...</p>;
  if (error) return <p className="card p-6 text-red-300">{error}</p>;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {profiles.map((profile) => <ProfileCard key={profile.id} profile={profile} />)}
      {profiles.length === 0 && <p className="card p-6 text-slate-300">No public profiles yet.</p>}
    </div>
  );
}
