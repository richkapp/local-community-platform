import { useSyncExternalStore } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getVotingFeatureAccess, shouldShowVotingLink } from '@/lib/voting';
import { isAnonymousUser } from '@/lib/anonymous';

type SiteSessionState = {
  user: User | null;
  authLoading: boolean;
  isAdmin: boolean;
  adminLoading: boolean;
  votingVisible: boolean;
  votingLoading: boolean;
};

type VisibilityEvent = CustomEvent<{ is_enabled?: boolean }>;

type Listener = () => void;

const serverSnapshot: SiteSessionState = {
  user: null,
  authLoading: true,
  isAdmin: false,
  adminLoading: true,
  votingVisible: false,
  votingLoading: true
};

let snapshot = serverSnapshot;
let started = false;
let adminRequestSequence = 0;
let votingRequestSequence = 0;
let resolvedAdminUserId: string | null | undefined;
let pendingAdminUserId: string | null | undefined;
const listeners = new Set<Listener>();

function publish(next: Partial<SiteSessionState>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

async function loadUser() {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user ?? null;
    publish({ user, authLoading: false });
    void loadAdmin(user);
  } catch {
    publish({ user: null, authLoading: false, isAdmin: false, adminLoading: false });
  }
}

async function loadAdmin(user: User | null) {
  const userId = user && !isAnonymousUser(user) ? user.id : null;
  if (pendingAdminUserId === userId || resolvedAdminUserId === userId) return;

  const requestId = ++adminRequestSequence;
  if (!userId) {
    resolvedAdminUserId = null;
    pendingAdminUserId = undefined;
    publish({ isAdmin: false, adminLoading: false });
    return;
  }

  pendingAdminUserId = userId;
  publish({ adminLoading: true });
  try {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) throw error;
    if (requestId === adminRequestSequence) {
      resolvedAdminUserId = userId;
      pendingAdminUserId = undefined;
      publish({ isAdmin: Boolean(data), adminLoading: false });
    }
  } catch {
    if (requestId === adminRequestSequence) {
      resolvedAdminUserId = userId;
      pendingAdminUserId = undefined;
      publish({ isAdmin: false, adminLoading: false });
    }
  }
}

async function loadVotingVisibility() {
  const requestId = ++votingRequestSequence;
  try {
    const access = await getVotingFeatureAccess();
    if (requestId === votingRequestSequence) publish({ votingVisible: shouldShowVotingLink(access), votingLoading: false });
  } catch {
    if (requestId === votingRequestSequence) publish({ votingVisible: false, votingLoading: false });
  }
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;

  void loadUser();
  void loadVotingVisibility();

  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    publish({ user, authLoading: false });
    void loadAdmin(user);
  });

  window.addEventListener('community:voting-visibility-changed', (event) => {
    const enabled = (event as VisibilityEvent).detail?.is_enabled;
    if (typeof enabled === 'boolean') {
      votingRequestSequence += 1;
      publish({ votingVisible: enabled, votingLoading: false });
      return;
    }
    void loadVotingVisibility();
  });
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

export function useSiteSession() {
  return useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);
}
