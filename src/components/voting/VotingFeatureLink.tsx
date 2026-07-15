import { useSiteSession } from '@/components/auth/useSiteSession';

export default function VotingFeatureLink({ className }: { className: string }) {
  const { votingVisible } = useSiteSession();

  if (!votingVisible) return null;
  return <a className={className} href="/voting">Voting</a>;
}
