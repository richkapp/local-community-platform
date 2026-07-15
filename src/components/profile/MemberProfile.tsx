import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toUserMessage } from '@/lib/errors';
import type { PublicProfile } from '@/lib/types';
import ProfileCard from './ProfileCard';

export default function MemberProfile({ handle }: { handle: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { data, error: queryError } = await supabase
          .from('public_profiles')
          .select('handle, display_name, bio, avatar_url, avatar_path, avatar_updated_at, website_url, linkedin_url, github_url, x_url')
          .eq('handle', handle)
          .maybeSingle<PublicProfile>();
        if (queryError) throw queryError;
        if (!data) setNotFound(true);
        else setProfile(data);
      } catch (caught) {
        setError(toUserMessage('member-profile', caught));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [handle]);

  if (loading) return <p className="text-braga-100" role="status">Loading member…</p>;
  if (error) return <p className="error-message" role="alert">{error}</p>;
  if (notFound || !profile) return <div className="card p-6"><h1 className="text-2xl font-semibold">Member not found</h1><a href="/members" className="mt-4 inline-flex text-limewash">Back to members</a></div>;

  return <div className="max-w-2xl"><ProfileCard profile={profile} /></div>;
}
