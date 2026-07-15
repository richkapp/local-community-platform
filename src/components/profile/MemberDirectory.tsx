import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toUserMessage } from '@/lib/errors';
import { isAnonymousUser } from '@/lib/anonymous';
import { useAuthUser } from '@/components/auth/useAuthUser';
import type { PublicProfile } from '@/lib/types';
import ProfileCard from './ProfileCard';
import { communityConfig } from '@/config/community';

export default function MemberDirectory() {
  const { user, loading: authLoading } = useAuthUser();
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { data, error: queryError } = await supabase
          .from('public_profiles')
          .select('handle, display_name, bio, avatar_url, avatar_path, avatar_updated_at, website_url, linkedin_url, github_url, x_url')
          .order('display_name');
        if (queryError) throw queryError;
        setProfiles((data as PublicProfile[] | null) ?? []);
      } catch (caught) {
        setError(toUserMessage('member-directory', caught));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (loading) return <p className="text-braga-100" role="status">Loading members…</p>;
  if (error) return <p className="error-message" role="alert">{error}</p>;

  const showMemberCta = !authLoading && (!user || isAnonymousUser(user));

  return (
    <div className="space-y-6">
      {showMemberCta && <a className="btn-primary inline-flex" href={communityConfig.whatsappUrl} target="_blank" rel="noreferrer noopener">Join WhatsApp Community</a>}
      {profiles.length ? <div className="grid gap-5 md:grid-cols-2">{profiles.map((profile) => <ProfileCard key={profile.handle ?? profile.display_name} profile={profile} />)}</div> : <div className="card p-6 text-braga-100">No public member profiles yet.</div>}
    </div>
  );
}
