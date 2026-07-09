import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export default function AuthStatus() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!user) {
    return <a href="/join/braga-whatsapp" className="btn-primary">Join with invite</a>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-braga-100">
      <span>{user.email}</span>
      <button className="btn-secondary" onClick={() => supabase.auth.signOut().then(() => window.location.reload())}>Sign out</button>
    </div>
  );
}
