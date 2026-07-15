import { supabase } from '@/lib/supabase';
import { isAnonymousUser } from '@/lib/anonymous';
import { useSiteSession } from './useSiteSession';

export default function AuthStatus() {
  const { user, authLoading: loading, isAdmin } = useSiteSession();

  if (loading) {
    return <span className="text-sm text-braga-200" role="status">Checking account…</span>;
  }

  if (!user) {
    return <a className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-limewash hover:text-limewash" href="/signin">Sign In</a>;
  }

  if (isAnonymousUser(user)) {
    return <a className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-limewash hover:text-limewash" href="/signin">Sign In</a>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {isAdmin && <a className="nav-link" href="/admin">Admin</a>}
      <a className="nav-link" href="/settings">Dashboard</a>
      <button
        className="rounded-full border border-white/20 px-4 py-2 font-semibold text-white transition hover:border-limewash hover:text-limewash"
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.href = '/';
        }}
      >
        Sign out
      </button>
    </div>
  );
}
