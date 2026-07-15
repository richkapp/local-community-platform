import { useSiteSession } from './useSiteSession';

export function useAuthUser() {
  const { user, authLoading } = useSiteSession();
  return { user, loading: authLoading };
}
