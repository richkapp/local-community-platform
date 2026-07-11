import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuCheck, LuInfo, LuPencil, LuTrash2 } from 'react-icons/lu';
import type { FormSubmitEvent } from '@/lib/dom';
import { supabase } from '@/lib/supabase';
import { toUserMessage } from '@/lib/errors';
import { attachPublicAuthors, updateOwnIdea } from '@/lib/ideas';
import { RIP_CATEGORIES, RIP_TAGS, ripCategoryLabel, ripTagLabel } from '@/lib/rips';
import { deleteIdea, isCurrentUserAdmin, updateIdeaStatus } from '@/lib/admin';
import type { Event, Idea, RipCategory, RipTag } from '@/lib/types';
import UpvoteButton from './UpvoteButton';
import RipTaxonomyPicker from './RipTaxonomyPicker';
import PostAuthorPreview from './PostAuthorPreview';

type VoteCountRow = { idea_id: string; upvote_count: number };
type VoteRow = { idea_id: string };
type CategoryFilter = RipCategory | 'all';
type TagFilter = RipTag | 'all';

const filterPill = 'rounded-full border px-3 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-limewash/70';

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(value));
}

async function hydrateIdeas(rows: Idea[], viewerId: string | null) {
  const ids = rows.map((idea) => idea.id);
  if (ids.length === 0) return rows;
  const { data: counts, error: countError } = await supabase.from('idea_vote_counts').select('idea_id, upvote_count').in('idea_id', ids);
  if (countError) throw countError;
  let voted = new Set<string>();
  if (viewerId) {
    const { data: votes, error: voteError } = await supabase.from('idea_votes').select('idea_id').eq('user_id', viewerId).in('idea_id', ids);
    if (voteError) throw voteError;
    voted = new Set(((votes ?? []) as VoteRow[]).map((vote) => vote.idea_id));
  }
  const countById = new Map(((counts ?? []) as VoteCountRow[]).map((row) => [row.idea_id, row.upvote_count]));
  return rows.map((idea) => ({ ...idea, upvote_count: countById.get(idea.id) ?? 0, viewer_has_voted: voted.has(idea.id) }));
}

function TaxonomyBadges({ idea }: { idea: Idea }) {
  return <div className="mb-3 flex flex-wrap gap-2"><span className="rounded-full border border-limewash/30 bg-limewash/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-limewash">{ripCategoryLabel(idea.category)}</span>{idea.tags.map((tag) => <span key={tag} className="rounded-full border border-violet-300/25 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-200">{ripTagLabel(tag)}</span>)}</div>;
}

function IdeaEditor({ idea, onClose, onSaved }: { idea: Idea; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(idea.title);
  const [body, setBody] = useState(idea.body);
  const [category, setCategory] = useState<RipCategory>(idea.category);
  const [tags, setTags] = useState<RipTag[]>(idea.tags);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormSubmitEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try { await updateOwnIdea(idea.id, { title, body, category, tags }); onSaved(); }
    catch (caught) { setError(toUserMessage('idea-create', caught)); setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(click) => { if (click.target === click.currentTarget) onClose(); }}>
      <form onSubmit={submit} className="card my-6 w-full max-w-2xl space-y-4 p-6" role="dialog" aria-modal="true" aria-labelledby="edit-idea-title">
        <div className="flex items-start justify-between gap-4"><div><h2 id="edit-idea-title" className="text-2xl font-black text-white">Edit post</h2><p className="mt-1 text-sm text-braga-200">Update its category, tags, title, or details.</p></div><button type="button" className="text-sm text-braga-200 hover:text-white" onClick={onClose}>Close</button></div>
        <RipTaxonomyPicker category={category} tags={tags} onCategoryChange={setCategory} onTagsChange={setTags} />
        <div><label className="label" htmlFor="edit-idea-name">Title</label><input id="edit-idea-name" className="input mt-2" value={title} onChange={(change) => setTitle(change.target.value)} minLength={4} maxLength={120} required /></div>
        <div><label className="label" htmlFor="edit-idea-body">Details</label><textarea id="edit-idea-body" className="input mt-2 min-h-40" value={body} onChange={(change) => setBody(change.target.value)} minLength={10} maxLength={2000} required /></div>
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        {error && <p className="error-message" role="alert">{error}</p>}
      </form>
    </div>
  );
}

export default function IdeaFeed() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [nextEvent, setNextEvent] = useState<Event | null>(null);
  const [editing, setEditing] = useState<Idea | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [tagFilter, setTagFilter] = useState<TagFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [ideaResponse, userResponse, admin, eventResponse] = await Promise.all([
        supabase.rpc('list_visible_ideas').order('created_at', { ascending: false }),
        supabase.auth.getUser(),
        isCurrentUserAdmin(),
        supabase.from('events').select('*').in('status', ['published', 'completed']).gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(1).maybeSingle()
      ]);
      if (ideaResponse.error) throw ideaResponse.error;
      if (eventResponse.error) throw eventResponse.error;
      const userId = userResponse.data.user?.id ?? null;
      const withAuthors = await attachPublicAuthors((ideaResponse.data ?? []) as Idea[]);
      setIdeas(await hydrateIdeas(withAuthors, userId)); setIsAdmin(admin); setNextEvent((eventResponse.data as Event | null) ?? null);
    } catch (caught) { setError(toUserMessage('ideas-feed', caught)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('braga:ideas-changed', refresh);
    return () => window.removeEventListener('braga:ideas-changed', refresh);
  }, [load]);

  const filteredIdeas = useMemo(() => ideas.filter((idea) => (categoryFilter === 'all' || idea.category === categoryFilter) && (tagFilter === 'all' || idea.tags.includes(tagFilter))), [ideas, categoryFilter, tagFilter]);

  async function markDone(idea: Idea) {
    setError('');
    try { await updateIdeaStatus(idea.id, 'closed'); await load(); }
    catch (caught) { setError(toUserMessage('admin-save', caught)); }
  }

  async function remove(idea: Idea) {
    if (!window.confirm(`Delete “${idea.title}”? This cannot be undone.`)) return;
    setError('');
    try { await deleteIdea(idea.id); await load(); }
    catch (caught) { setError(toUserMessage('admin-save', caught)); }
  }

  if (loading) return <p className="card p-6 text-braga-100" role="status">Loading posts…</p>;
  if (error) return <p className="error-message" role="alert">{error}</p>;

  return (
    <div className="space-y-5">
      <aside className="rounded-2xl border border-braga-300/20 bg-braga-950/45 p-5" aria-label="Post participation information">
        <div className="flex gap-3"><LuInfo className="mt-0.5 h-5 w-5 shrink-0 text-limewash" aria-hidden="true" /><div className="space-y-2 text-sm leading-6 text-braga-100"><p>You can post and vote without an account. Want your posts tied to your profile and editable? <a className="font-semibold text-limewash hover:underline" href="/signin">Sign in or create an account with a magic link →</a></p>{nextEvent && <p><span className="font-semibold text-white">Next event:</span> {formatEventDate(nextEvent.starts_at)} · <a className="font-semibold text-limewash hover:underline" href={nextEvent.external_url || '/events'} target="_blank" rel="noreferrer noopener">{nextEvent.title} ↗</a></p>}</div></div>
      </aside>

      <section className="space-y-4 rounded-2xl border border-braga-300/15 p-5" aria-label="Filter posts">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-braga-300">Category</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" className={`${filterPill} ${categoryFilter === 'all' ? 'border-limewash bg-limewash text-ink-950' : 'border-braga-300/30 text-braga-100'}`} onClick={() => setCategoryFilter('all')}>All</button>{RIP_CATEGORIES.map((item) => <button key={item.value} type="button" className={`${filterPill} ${categoryFilter === item.value ? 'border-limewash bg-limewash text-ink-950' : 'border-braga-300/30 text-braga-100 hover:border-limewash/60'}`} aria-pressed={categoryFilter === item.value} onClick={() => setCategoryFilter(item.value)}>{item.label}</button>)}</div></div>
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-braga-300">Tags</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" className={`${filterPill} ${tagFilter === 'all' ? 'border-violet-300 bg-violet-500/20 text-violet-100' : 'border-braga-300/30 text-braga-100'}`} onClick={() => setTagFilter('all')}>All</button>{RIP_TAGS.map((item) => <button key={item.value} type="button" className={`${filterPill} ${tagFilter === item.value ? 'border-violet-300 bg-violet-500/20 text-violet-100' : 'border-braga-300/30 text-braga-100 hover:border-violet-300/60'}`} aria-pressed={tagFilter === item.value} onClick={() => setTagFilter(item.value)}>{item.label}</button>)}</div></div>
      </section>

      {filteredIdeas.map((idea) => {
        const canEdit = Boolean(idea.viewer_can_edit);
        return <article key={idea.id} className="card relative flex gap-4 p-5">
          <UpvoteButton ideaId={idea.id} initialCount={idea.upvote_count ?? 0} initialVoted={idea.viewer_has_voted ?? false} disabled={idea.status === 'closed'} />
          <div className={(canEdit || isAdmin) ? 'min-w-0 flex-1 pr-28' : 'min-w-0 flex-1'}>
            <TaxonomyBadges idea={idea} />
            <div className="flex flex-wrap items-center gap-2"><a href={`/ideas/${idea.slug}`} className="text-xl font-bold text-white hover:text-limewash">{idea.title}</a>{idea.status === 'closed' && <span className="rounded-full border border-limewash/30 bg-limewash/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-limewash">Done</span>}</div>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-braga-100">{idea.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-braga-300"><span>{idea.month_key}</span><span aria-hidden="true">·</span><PostAuthorPreview profile={idea.profiles} /></div>
          </div>
          {(canEdit || isAdmin) && <div className="absolute right-4 top-4 flex gap-2">
            {canEdit && <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-braga-300/30 text-braga-100 hover:border-limewash/70 hover:text-limewash" onClick={() => setEditing(idea)} aria-label={`Edit ${idea.title}`} title="Edit post"><LuPencil className="h-4 w-4" aria-hidden="true" /></button>}
            {isAdmin && idea.status !== 'closed' && <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-limewash/30 text-limewash hover:bg-limewash/10" onClick={() => void markDone(idea)} aria-label={`Mark ${idea.title} as done`} title="Mark done"><LuCheck className="h-4 w-4" aria-hidden="true" /></button>}
            {isAdmin && <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-300/30 text-red-200 hover:bg-red-300/10" onClick={() => void remove(idea)} aria-label={`Delete ${idea.title}`} title="Delete post"><LuTrash2 className="h-4 w-4" aria-hidden="true" /></button>}
          </div>}
        </article>;
      })}
      {ideas.length === 0 && <p className="card p-6 text-braga-100">No posts yet. Be the first to add one.</p>}
      {ideas.length > 0 && filteredIdeas.length === 0 && <p className="card p-6 text-braga-100">No posts match those filters.</p>}
      {editing && <IdeaEditor idea={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </div>
  );
}
