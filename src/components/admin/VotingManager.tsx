import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { toUserMessage } from '@/lib/errors';
import type { AdminCommunityVote } from '@/lib/types';
import { communityConfig } from '@/config/community';
import { formatCommunityDate } from '@/lib/communityDate';
import {
  closeCommunityVote,
  createCommunityVote,
  deleteCommunityVote,
  getVotingFeatureAccess,
  listAdminCommunityVotes,
  normalizeCommunityVoteInput,
  setVotingFeatureEnabled,
  updateCommunityVote,
  type CommunityVoteInput,
  type NormalizedCommunityVoteInput
} from '@/lib/voting';

const blankOptions = () => ['', ''];

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return formatCommunityDate(value);
}

export default function VotingManager() {
  const [votes, setVotes] = useState<AdminCommunityVote[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<AdminCommunityVote['status']>('draft');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [options, setOptions] = useState<string[]>(blankOptions);
  const [previewValue, setPreviewValue] = useState<NormalizedCommunityVoteInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [votingEnabled, setVotingEnabled] = useState<boolean | null>(null);
  const [visibilityMessage, setVisibilityMessage] = useState('');
  const [visibilityError, setVisibilityError] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const loadSequence = useRef(0);
  const visibilitySequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const visibilityAtStart = visibilitySequence.current;
    setLoading(true); setError('');
    try {
      const [rows, access] = await Promise.all([
        listAdminCommunityVotes(),
        getVotingFeatureAccess()
      ]);
      if (sequence === loadSequence.current) {
        setVotes(rows);
        if (visibilityAtStart === visibilitySequence.current) setVotingEnabled(access.is_enabled);
      }
    } catch (caught) {
      if (sequence === loadSequence.current) setError(toUserMessage('admin-load', caught));
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      loadSequence.current += 1;
      visibilitySequence.current += 1;
    };
  }, [load]);

  function currentInput(): CommunityVoteInput {
    return { title, description, closesAt, options };
  }

  function resetForm() {
    setEditingId(null);
    setEditingStatus('draft');
    setTitle('');
    setDescription('');
    setClosesAt('');
    setOptions(blankOptions());
    setPreviewValue(null);
  }

  function edit(vote: AdminCommunityVote) {
    setEditingId(vote.id);
    setEditingStatus(vote.status);
    setTitle(vote.title);
    setDescription(vote.description);
    setClosesAt(toLocalDateTime(vote.closes_at));
    setOptions([...vote.options].sort((left, right) => left.position - right.position).map((option) => option.label));
    setPreviewValue(null);
    setMessage(''); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? value : option));
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
  }

  function moveOption(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= options.length) return;
    setOptions((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function preview(event: FormSubmitEvent) {
    event.preventDefault(); setError(''); setMessage('');
    try {
      setPreviewValue(normalizeCommunityVoteInput(currentInput()));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : toUserMessage('voting-admin', caught));
    }
  }

  async function persist(publish: boolean) {
    try {
      normalizeCommunityVoteInput(currentInput());
    } catch (caught) {
      setPreviewValue(null);
      setError(caught instanceof Error ? caught.message : 'Check the vote details and try again.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      if (editingId) await updateCommunityVote(editingId, currentInput(), publish);
      else await createCommunityVote(currentInput(), publish);
      setMessage(publish ? 'Vote published.' : editingId ? 'Vote changes saved.' : 'Draft saved.');
      resetForm();
      await load();
    } catch (caught) {
      setError(toUserMessage('voting-admin', caught));
    } finally {
      setBusy(false);
    }
  }

  async function close(vote: AdminCommunityVote) {
    if (!window.confirm(`Close “${vote.title}” now? It cannot be reopened.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await closeCommunityVote(vote.id);
      setMessage('Vote closed.');
      if (editingId === vote.id) resetForm();
      await load();
    } catch (caught) {
      setError(toUserMessage('voting-admin', caught));
    } finally {
      setBusy(false);
    }
  }

  async function remove(vote: AdminCommunityVote) {
    if (!window.confirm(`Delete “${vote.title}”? This is allowed only because it has no ballots.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await deleteCommunityVote(vote.id);
      setMessage('Vote deleted.');
      if (editingId === vote.id) resetForm();
      await load();
    } catch (caught) {
      setError(toUserMessage('voting-admin', caught));
    } finally {
      setBusy(false);
    }
  }

  async function toggleVotingVisibility() {
    if (votingEnabled === null || loading || busy) return;
    const nextEnabled = !votingEnabled;
    const sequence = ++visibilitySequence.current;
    setVisibilityBusy(true); setVisibilityMessage(''); setVisibilityError('');
    try {
      const saved = await setVotingFeatureEnabled(nextEnabled);
      if (sequence === visibilitySequence.current) {
        setVotingEnabled(saved);
        setVisibilityMessage(saved
          ? 'Voting is on. Members can see the links and public Voting page.'
          : 'Voting is off. Links are hidden and only organizers can open the Voting page.');
      }
    } catch (caught) {
      if (sequence === visibilitySequence.current) setVisibilityError(toUserMessage('voting-admin', caught));
    } finally {
      if (sequence === visibilitySequence.current) {
        visibilitySequence.current += 1;
        setVisibilityBusy(false);
      }
    }
  }

  return (
    <div className="space-y-7">
      <section className="card grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6" aria-labelledby="voting-visibility-title" aria-busy={visibilityBusy}>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-limewash">Public visibility</p>
          <h2 id="voting-visibility-title" className="mt-2 text-xl font-bold text-white">Voting is {votingEnabled === null ? 'loading' : votingEnabled ? 'on' : 'off'}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-braga-200">
            {votingEnabled === null
              ? 'Checking the current visibility setting…'
              : votingEnabled
                ? 'Members can see Voting in the menu and footer and open the public page.'
                : 'Voting links are hidden. Only organizers can open the page and manage existing votes.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(votingEnabled)}
          aria-label="Voting public visibility"
          className={`relative inline-flex h-12 w-24 shrink-0 items-center rounded-full border p-1 transition ${votingEnabled ? 'border-limewash bg-limewash/20' : 'border-braga-300/40 bg-ink-950/60'}`}
          onClick={() => void toggleVotingVisibility()}
          disabled={visibilityBusy || loading || busy || votingEnabled === null}
        >
          <span className={`grid h-9 w-9 place-items-center rounded-full text-xs font-black uppercase transition-transform ${votingEnabled ? 'translate-x-11 bg-limewash text-ink-950' : 'translate-x-0 bg-braga-300 text-ink-950'}`} aria-hidden="true">
            {votingEnabled ? 'On' : 'Off'}
          </span>
        </button>
        {visibilityMessage && <p className="status-message sm:col-span-2" role="status">{visibilityMessage}</p>}
        {visibilityError && <p className="error-message sm:col-span-2" role="alert">{visibilityError}</p>}
      </section>

      <form onSubmit={preview} className="card space-y-5 p-5 sm:p-6" aria-busy={busy}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold text-white">{editingId ? 'Edit vote' : 'Create a vote'}</h2><p className="mt-2 text-sm text-braga-200">Draft it, preview the public card, then publish. Content locks after the first ballot.</p></div>
          {editingId && <button type="button" className="btn-secondary" onClick={resetForm} disabled={busy}>Cancel edit</button>}
        </div>

        {!previewValue ? <>
          <div><label className="label" htmlFor="vote-title">Title</label><input id="vote-title" className="input mt-2" value={title} onChange={(event) => setTitle(event.target.value)} minLength={4} maxLength={140} required /></div>
          <div><label className="label" htmlFor="vote-description">Description</label><textarea id="vote-description" className="input mt-2 min-h-32" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={4000} required /></div>
          <div><label className="label" htmlFor="vote-closes">Closing date and time</label><input id="vote-closes" className="input mt-2" type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} required /><p className="mt-2 text-xs text-braga-300">Enter this in your device’s local time. It is displayed publicly in {communityConfig.timeZoneLabel}. Admins may close earlier.</p></div>

          <fieldset>
            <legend className="label">Options</legend>
            <p className="mt-1 text-xs text-braga-300">Add between 2 and 10 distinct options. Their order here is their public order.</p>
            <div className="mt-3 space-y-3">
              {options.map((option, index) => (
                <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="sr-only" htmlFor={`vote-option-${index}`}>Option {index + 1}</label>
                  <input id={`vote-option-${index}`} className="input min-w-0 flex-1" value={option} onChange={(event) => updateOption(index, event.target.value)} placeholder={`Option ${index + 1}`} maxLength={180} required />
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary min-w-11 px-3" onClick={() => moveOption(index, -1)} disabled={busy || index === 0} aria-label={`Move option ${index + 1} up`}>↑</button>
                    <button type="button" className="btn-secondary min-w-11 px-3" onClick={() => moveOption(index, 1)} disabled={busy || index === options.length - 1} aria-label={`Move option ${index + 1} down`}>↓</button>
                    <button type="button" className="rounded-full border border-red-300/30 px-4 py-2 text-sm font-semibold text-red-200 disabled:opacity-40" onClick={() => removeOption(index)} disabled={busy || options.length <= 2} aria-label={`Remove option ${index + 1}`}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
            {options.length < 10 && <button type="button" className="btn-secondary mt-3" onClick={() => setOptions((current) => [...current, ''])} disabled={busy}>Add option</button>}
          </fieldset>

          <div className="flex flex-col gap-3 sm:flex-row">
            {(editingStatus === 'draft' || !editingId) && <button type="button" className="btn-secondary flex-1" onClick={() => void persist(false)} disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button>}
            {editingStatus === 'published' && <button type="button" className="btn-secondary flex-1" onClick={() => void persist(false)} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>}
            <button type="submit" className="btn-primary flex-1" disabled={busy}>Preview vote</button>
          </div>
        </> : <section className="rounded-2xl border border-limewash/35 bg-ink-950/45 p-5" aria-labelledby="vote-preview-title">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-limewash">Public preview</p>
          <h3 id="vote-preview-title" className="mt-3 text-2xl font-black text-white">{previewValue.title}</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-braga-100">{previewValue.description}</p>
          <p className="mt-3 text-xs text-braga-300">Closes {formatDate(previewValue.closesAt)} · {communityConfig.timeZoneLabel}</p>
          <ol className="mt-5 space-y-2">{previewValue.options.map((option) => <li key={option} className="rounded-xl border border-braga-300/20 px-4 py-3 text-sm text-white">{option}</li>)}</ol>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" className="btn-secondary flex-1" onClick={() => setPreviewValue(null)} disabled={busy}>Back to edit</button><button type="button" className="btn-primary flex-1" onClick={() => void persist(true)} disabled={busy}>{busy ? 'Publishing…' : editingStatus === 'published' ? 'Save published changes' : 'Publish vote'}</button></div>
        </section>}
      </form>

      {message && <p className="status-message" role="status">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}

      <section aria-labelledby="managed-votes-title">
        <h2 id="managed-votes-title" className="text-xl font-bold text-white">Votes</h2>
        {loading ? <p className="card mt-3 p-6 text-braga-100" role="status">Loading votes…</p> : <div className="mt-3 space-y-3">
          {votes.map((vote) => (
            <article key={vote.id} className="card flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{vote.title}</h3><span className="rounded-full border border-braga-300/30 px-2.5 py-1 text-xs uppercase tracking-wider text-braga-200">{vote.status}</span></div><p className="mt-2 text-xs text-braga-300">{vote.ballot_count} ballot{vote.ballot_count === 1 ? '' : 's'} · Closes {formatDate(vote.closes_at)}</p></div>
              <div className="flex flex-wrap gap-2">
                {vote.can_edit && <button type="button" className="btn-secondary" onClick={() => edit(vote)} disabled={busy}>Edit</button>}
                {vote.status === 'published' && <button type="button" className="btn-secondary" onClick={() => void close(vote)} disabled={busy}>Close early</button>}
                {vote.can_delete && <button type="button" className="rounded-full border border-red-300/30 px-4 py-2 text-sm font-semibold text-red-200" onClick={() => void remove(vote)} disabled={busy}>Delete</button>}
                {vote.status !== 'draft' && <a className="btn-secondary" href="/voting">View public page</a>}
              </div>
            </article>
          ))}
          {votes.length === 0 && <p className="card p-6 text-braga-100">No votes yet.</p>}
        </div>}
      </section>
    </div>
  );
}
