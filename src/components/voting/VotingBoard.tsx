import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { toUserMessage } from '@/lib/errors';
import type { CommunityVote, CommunityVoteOption, VotingFeatureAccess } from '@/lib/types';
import { calculateVotePercentage, canViewCommunityVoting, getVotingFeatureAccess, listCommunityVotes, submitCommunityBallot } from '@/lib/voting';
import { communityConfig } from '@/config/community';
import { formatCommunityDate } from '@/lib/communityDate';

export type VotingBoardOperations = {
  access: typeof getVotingFeatureAccess;
  list: typeof listCommunityVotes;
  submit: typeof submitCommunityBallot;
};

const defaultOperations: VotingBoardOperations = {
  access: getVotingFeatureAccess,
  list: listCommunityVotes,
  submit: submitCommunityBallot
};

function formatClosingTime(value: string) {
  return formatCommunityDate(value);
}

function OptionResults({ option, total }: { option: CommunityVoteOption; total: number }) {
  const percentage = calculateVotePercentage(option.ballot_count, total);
  const voters = option.named_voters ?? [];
  return (
    <div className="rounded-2xl border border-braga-300/20 bg-ink-950/35 p-4">
      <div className="flex items-start justify-between gap-4">
        <p className="font-semibold text-white">{option.label}</p>
        <p className="shrink-0 text-sm font-bold text-limewash">{option.ballot_count} · {percentage}%</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div className="h-full rounded-full bg-limewash transition-[width] duration-300" style={{ width: `${percentage}%` }} />
      </div>
      {voters.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label={`Named voters for ${option.label}`}>
          {voters.map((voter, index) => (
            <span key={`${voter.display_name}-${index}`} className="rounded-full border border-violet-300/25 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-100">
              {voter.display_name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function VoteAccessMessage({ isClosed, votingEnabled }: { isClosed: boolean; votingEnabled: boolean }) {
  if (isClosed) return <p className="text-sm text-braga-200">Voting has closed. These are the final results.</p>;
  if (!votingEnabled) return <p className="text-sm text-braga-200">Voting is currently off. Organizers can still review these results.</p>;
  return <p className="text-sm text-braga-100"><a className="font-bold text-limewash hover:underline" href="/signin">Sign in with your member account</a> to cast a vote.</p>;
}

function VoteCard({ vote, votingEnabled, onSaved, submitBallot }: { vote: CommunityVote; votingEnabled: boolean; onSaved: () => Promise<void>; submitBallot: typeof submitCommunityBallot }) {
  const [selectedOption, setSelectedOption] = useState(vote.viewer_option_id ?? '');
  const [anonymous, setAnonymous] = useState(vote.viewer_is_anonymous ?? false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedOption(vote.viewer_option_id ?? '');
    setAnonymous(vote.viewer_is_anonymous ?? false);
  }, [vote.viewer_is_anonymous, vote.viewer_option_id]);

  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    if (!selectedOption) return;
    setBusy(true); setMessage(''); setError('');
    try {
      await submitBallot(vote.id, selectedOption, anonymous);
      setMessage(vote.viewer_option_id ? 'Your vote was updated.' : 'Your vote was counted.');
      await onSaved();
    } catch (caught) {
      setError(toUserMessage('voting-ballot', caught));
      await onSaved().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const isClosed = vote.status === 'closed';
  return (
    <article className="card space-y-6 p-5 sm:p-7">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${isClosed ? 'border border-braga-300/30 text-braga-200' : 'bg-limewash text-ink-950'}`}>
            {isClosed ? 'Closed' : 'Open'}
          </span>
          <span className="text-xs text-braga-300">{isClosed ? 'Closed' : 'Closes'} {formatClosingTime(vote.closes_at)} · {communityConfig.timeZoneLabel}</span>
        </div>
        <h2 className="mt-4 text-2xl font-black text-white">{vote.title}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-braga-100">{vote.description}</p>
      </header>

      <section aria-label={`${isClosed ? 'Final' : 'Live'} results for ${vote.title}`}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-braga-300">{isClosed ? 'Final results' : 'Live results'}</h3>
          <p className="text-sm text-braga-200">{vote.ballot_count} vote{vote.ballot_count === 1 ? '' : 's'} cast</p>
        </div>
        <div className="space-y-3">
          {vote.options.map((option) => <OptionResults key={option.id} option={option} total={vote.ballot_count} />)}
        </div>
      </section>

      {vote.viewer_can_vote ? (
        <form className="space-y-4 border-t border-white/10 pt-5" onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy}>
            <legend className="font-bold text-white">Choose one option</legend>
            <div className="mt-3 grid gap-2">
              {vote.options.map((option) => (
                <label key={option.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${selectedOption === option.id ? 'border-limewash bg-limewash/10 text-white' : 'border-braga-300/25 text-braga-100 hover:border-limewash/60'}`}>
                  <input type="radio" name={`vote-${vote.id}`} value={option.id} checked={selectedOption === option.id} onChange={() => setSelectedOption(option.id)} className="h-4 w-4 accent-limewash" required />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-braga-300/20 px-4 py-3 text-sm text-braga-100">
            <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="mt-0.5 h-4 w-4 accent-limewash" disabled={busy} />
            <span><strong className="text-white">Vote anonymously</strong><br />When unchecked, your member name appears publicly beneath your choice.</span>
          </label>
          <button type="submit" className="btn-primary w-full" disabled={busy || !selectedOption}>
            {busy ? 'Saving vote…' : vote.viewer_option_id ? 'Update my vote' : 'Submit my vote'}
          </button>
          {message && <p className="status-message" role="status">{message}</p>}
          {error && <p className="error-message" role="alert">{error}</p>}
        </form>
      ) : (
        <div className="border-t border-white/10 pt-5">
          <VoteAccessMessage isClosed={isClosed} votingEnabled={votingEnabled} />
        </div>
      )}
    </article>
  );
}

export default function VotingBoard({ operations = defaultOperations }: { operations?: VotingBoardOperations }) {
  const [votes, setVotes] = useState<CommunityVote[]>([]);
  const [featureAccess, setFeatureAccess] = useState<VotingFeatureAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadSequence = useRef(0);

  const load = useCallback(async (showLoading = true) => {
    const sequence = ++loadSequence.current;
    if (showLoading) setLoading(true);
    setError('');
    try {
      const rows = await operations.list();
      // Read access last so a concurrent disable cannot commit stale enabled state with empty results.
      const access = await operations.access();
      if (sequence === loadSequence.current) {
        setFeatureAccess(access);
        setVotes(canViewCommunityVoting(access) ? rows : []);
      }
    } catch (caught) {
      if (sequence === loadSequence.current) setError(toUserMessage('voting-list', caught));
    } finally {
      if (showLoading && sequence === loadSequence.current) setLoading(false);
    }
  }, [operations]);

  const refresh = useCallback(() => load(false), [load]);

  useEffect(() => {
    void load();
    return () => { loadSequence.current += 1; };
  }, [load]);

  const canViewVoting = canViewCommunityVoting(featureAccess);
  const isAdmin = Boolean(featureAccess?.viewer_is_admin);

  useEffect(() => {
    if (!featureAccess) return;
    document.title = `${canViewVoting ? 'Voting' : 'Page not found'} · ${communityConfig.name}`;
  }, [canViewVoting, featureAccess]);

  if (loading) return <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8"><p className="card p-6 text-braga-100" role="status">Checking page access…</p></section>;
  if (error) return <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8"><p className="error-message" role="alert">{error}</p></section>;
  if (!featureAccess || !canViewVoting) return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <div className="card p-8 sm:p-12">
        <h1 className="text-3xl font-black text-white">Page not found</h1>
        <p className="mt-4 text-braga-100">The page you requested is not available.</p>
        <a className="btn-primary mt-7" href="/">Back home</a>
      </div>
    </section>
  );

  const openVotes = votes.filter((vote) => vote.status === 'published');
  const closedVotes = votes.filter((vote) => vote.status === 'closed');

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-limewash">Community decisions</p>
      <h1 className="mt-3 text-4xl font-black text-white">Voting</h1>
      <p className="mt-4 max-w-3xl text-braga-100">See what the {communityConfig.name} community is deciding, follow live results, and sign in to cast your vote.</p>
      {!featureAccess.is_enabled && isAdmin && (
        <aside className="mt-6 rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
          Voting is off. Only organizers can view this page until you turn public visibility back on.
        </aside>
      )}
      <div className="mt-8 space-y-10">
      <section aria-labelledby="open-votes-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><h2 id="open-votes-title" className="text-2xl font-black text-white">Open votes</h2><p className="mt-2 text-sm text-braga-200">Results are live. Signed-in members can change their choice until each deadline.</p></div>
          {isAdmin && <a className="btn-primary" href="/admin/voting">Create a new poll</a>}
        </div>
        <div className="space-y-5">
          {openVotes.map((vote) => <VoteCard key={vote.id} vote={vote} votingEnabled={featureAccess.is_enabled} onSaved={refresh} submitBallot={operations.submit} />)}
          {openVotes.length === 0 && <p className="card p-6 text-braga-100">No votes are open right now.</p>}
        </div>
      </section>

      {closedVotes.length > 0 && (
        <section aria-labelledby="closed-votes-title">
          <div className="mb-5"><h2 id="closed-votes-title" className="text-2xl font-black text-white">Closed votes</h2><p className="mt-2 text-sm text-braga-200">The community's completed decisions and final results.</p></div>
          <div className="space-y-5">{closedVotes.map((vote) => <VoteCard key={vote.id} vote={vote} votingEnabled={featureAccess.is_enabled} onSaved={refresh} submitBallot={operations.submit} />)}</div>
        </section>
      )}
      </div>
    </section>
  );
}
