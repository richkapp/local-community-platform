import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuCheck, LuChevronDown, LuInfo, LuMessageCircle, LuPencil, LuTrash2 } from 'react-icons/lu';
import type { FormSubmitEvent } from '@/lib/dom';
import { supabase } from '@/lib/supabase';
import { toUserMessage } from '@/lib/errors';
import { listPostFeed, updateOwnIdea } from '@/lib/ideas';
import { RIP_CATEGORIES, ripCategoryLabel, ripTagLabel } from '@/lib/rips';
import { deleteIdea, updateIdeaStatus } from '@/lib/admin';
import { ideaMatchesMember, rankPostingMembers, scopeIdeasToPostView, type PostFeedView } from '@/lib/postMemberFilters';
import { formatCommunityDate } from '@/lib/communityDate';

import type { Event, Idea, PostTagCatalogItem, RipCategory, RipTag } from '@/lib/types';
import AuthRequired from '@/components/auth/AuthRequired';
import UpvoteButton from './UpvoteButton';
import BookmarkButton, { type BookmarkAccess } from './BookmarkButton';
import IdeaComposer from './IdeaComposer';
import PostAuthorIdentity from './PostAuthorIdentity';
import PostMemberFilters from './PostMemberFilters';
import RipTaxonomyPicker from './RipTaxonomyPicker';
import SharePostButton from './SharePostButton';

import { usePostTagCatalog } from './usePostTagCatalog';

type CategoryFilter = RipCategory | 'all';
type Props = {
  initialView?: PostFeedView;
  showIntro?: boolean;
  showViewTabs?: boolean;
  showFilters?: boolean;
  layout?: 'default' | 'sidebar';
};

const filterPill = 'min-h-11 rounded-full border px-3 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-limewash/70';
const collapsedTagLimit = 6;

function formatEventDate(value: string) {
  return formatCommunityDate(value);
}


function TaxonomyBadges({ idea, tagLabels, activeCategory, selectedTags, onCategory, onTag }: {
  idea: Idea;
  tagLabels: Map<RipTag, string>;
  activeCategory: CategoryFilter;
  selectedTags: RipTag[];
  onCategory?: (category: RipCategory) => void;
  onTag?: (tag: RipTag) => void;
}) {
  const categoryClass = 'rounded-full border border-limewash/30 bg-limewash/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-limewash';
  const tagClass = 'rounded-full border border-violet-300/25 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-200';
  const categoryLabel = ripCategoryLabel(idea.category);
  return <div className="mb-3 flex flex-wrap gap-2">
    {onCategory
      ? <button type="button" className={`${categoryClass} transition hover:border-limewash/70 focus:outline-none focus:ring-2 focus:ring-limewash/60`} aria-label={`Filter posts by category: ${categoryLabel}`} aria-pressed={activeCategory === idea.category} onClick={() => onCategory(idea.category)}>{categoryLabel}</button>
      : <span className={categoryClass}>{categoryLabel}</span>}
    {idea.tags.map((tag) => {
      const label = tagLabels.get(tag) ?? ripTagLabel(tag);
      return onTag
        ? <button key={tag} type="button" className={`${tagClass} transition hover:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-300/60`} aria-label={`Filter posts by tag: ${label}`} aria-pressed={selectedTags.includes(tag)} onClick={() => onTag(tag)}>{label}</button>
        : <span key={tag} className={tagClass}>{label}</span>;
    })}
  </div>;
}

function IdeaEditor({ idea, tagCatalog, tagCatalogLoading, tagCatalogError, onClose, onSaved }: {
  idea: Idea;
  tagCatalog: PostTagCatalogItem[];
  tagCatalogLoading: boolean;
  tagCatalogError: string;
  onClose: () => void;
  onSaved: () => void;
}) {
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
        <div className="flex items-start justify-between gap-4"><div><h2 id="edit-idea-title" className="text-2xl font-black text-white">Edit post</h2><p className="mt-1 text-sm text-braga-200">Update its category, tags, title, or details.</p></div><button type="button" className="min-h-11 text-sm text-braga-200 hover:text-white" onClick={onClose}>Close</button></div>
        <RipTaxonomyPicker category={category} tags={tags} catalog={tagCatalog} catalogLoading={tagCatalogLoading} catalogError={tagCatalogError} onCategoryChange={setCategory} onTagsChange={setTags} />
        <div><label className="label" htmlFor="edit-idea-name">Title</label><input id="edit-idea-name" className="input mt-2" value={title} onChange={(change) => setTitle(change.target.value)} minLength={4} maxLength={120} required /></div>
        <div><label className="label" htmlFor="edit-idea-body">Details</label><textarea id="edit-idea-body" className="input mt-2 min-h-40" value={body} onChange={(change) => setBody(change.target.value)} minLength={10} maxLength={2000} required /></div>
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        {error && <p className="error-message" role="alert">{error}</p>}
      </form>
    </div>
  );
}

const viewLabels: Record<PostFeedView, string> = {
  all: 'All posts',
  mine: 'My posts',
  bookmarks: 'My bookmarks'
};

function participationCopy(access: BookmarkAccess) {
  if (access === 'active') return null;
  if (access === 'inactive') return 'This account is signed in, but its community membership is not active. Contact an organizer if that looks wrong.';
  return <>You can post and vote without an account. Want your posts tied to your profile, editable, and bookmarkable? <a className="font-semibold text-limewash hover:underline" href="/signin">Already a member? Sign in with a magic link →</a></>;
}

export default function IdeaFeed({ initialView = 'all', showIntro = true, showViewTabs = true, showFilters = true, layout = 'default' }: Props) {
  const { tags: tagCatalog, loading: tagCatalogLoading, error: tagCatalogError } = usePostTagCatalog();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [libraryAccess, setLibraryAccess] = useState<BookmarkAccess>('signed-out');
  const [nextEvent, setNextEvent] = useState<Event | null>(null);
  const [editing, setEditing] = useState<Idea | null>(null);
  const [view, setView] = useState<PostFeedView>(initialView);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedTags, setSelectedTags] = useState<RipTag[]>([]);
  const [selectedMemberHandle, setSelectedMemberHandle] = useState<string | null>(null);
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadSequence = useRef(0);

  const load = useCallback(async (withLoading = true) => {
    const sequence = ++loadSequence.current;
    if (withLoading) setLoading(true);
    setError('');
    try {
      const eventRequest = showIntro
        ? supabase.from('events').select('*').in('status', ['published', 'completed']).gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null });
      const [feedResponse, eventResponse] = await Promise.all([
        listPostFeed(initialView),
        eventRequest
      ]);
      if (eventResponse.error) throw eventResponse.error;
      if (sequence !== loadSequence.current) return;
      setIdeas(feedResponse.posts);
      setLibraryAccess(feedResponse.viewer.access);
      setIsAdmin(feedResponse.viewer.role === 'admin' || feedResponse.viewer.role === 'super_admin');
      setNextEvent((eventResponse.data as Event | null) ?? null);
    } catch (caught) {
      if (sequence === loadSequence.current) setError(toUserMessage('ideas-feed', caught));
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [initialView, showIntro]);

  useEffect(() => {
    void load();
    const refresh = () => void load(false);
    window.addEventListener('community:ideas-changed', refresh);
    return () => {
      loadSequence.current += 1;
      window.removeEventListener('community:ideas-changed', refresh);
    };
  }, [load]);

  const tagLabels = useMemo(() => new Map(tagCatalog.map((tag) => [tag.slug, tag.label])), [tagCatalog]);
  const visibleFilterTags = filtersExpanded ? tagCatalog : tagCatalog.slice(0, collapsedTagLimit);
  const categoryOptions = useMemo(() => {
    const counts = new Map<RipCategory, number>();
    for (const idea of ideas) counts.set(idea.category, (counts.get(idea.category) ?? 0) + 1);
    return [...RIP_CATEGORIES].sort((left, right) => (counts.get(right.value) ?? 0) - (counts.get(left.value) ?? 0));
  }, [ideas]);
  const viewScopedIdeas = useMemo(() => scopeIdeasToPostView(ideas, view), [ideas, view]);
  const memberOptions = useMemo(() => rankPostingMembers(viewScopedIdeas), [viewScopedIdeas]);

  useEffect(() => {
    if (selectedMemberHandle && !memberOptions.some((member) => member.handle === selectedMemberHandle)) {
      setSelectedMemberHandle(null);
    }
  }, [memberOptions, selectedMemberHandle]);

  const filteredIdeas = useMemo(() => {
    const matching = viewScopedIdeas.filter((idea) =>
      (categoryFilter === 'all' || idea.category === categoryFilter)
      && selectedTags.every((tag) => idea.tags.includes(tag))
      && ideaMatchesMember(idea, selectedMemberHandle)
    );
    return view === 'bookmarks'
      ? [...matching].sort((left, right) => Date.parse(right.viewer_bookmarked_at ?? '1970-01-01') - Date.parse(left.viewer_bookmarked_at ?? '1970-01-01'))
      : matching;
  }, [viewScopedIdeas, view, categoryFilter, selectedTags, selectedMemberHandle]);

  async function markDone(idea: Idea) {
    setError('');
    try { await updateIdeaStatus(idea.id, 'closed'); await load(false); }
    catch (caught) { setError(toUserMessage('admin-save', caught)); }
  }

  async function remove(idea: Idea) {
    if (!window.confirm(`Delete “${idea.title}”? This cannot be undone.`)) return;
    setError('');
    try { await deleteIdea(idea.id); await load(false); }
    catch (caught) { setError(toUserMessage('admin-save', caught)); }
  }

  function updateBookmark(ideaId: string, bookmarked: boolean) {
    setIdeas((current) => current.map((idea) => idea.id === ideaId ? {
      ...idea,
      viewer_has_bookmarked: bookmarked,
      viewer_bookmarked_at: bookmarked ? new Date().toISOString() : null
    } : idea));
  }

  function toggleTagFilter(tag: RipTag) {
    setSelectedTags((current) => current.includes(tag)
      ? current.filter((value) => value !== tag)
      : [...current, tag]);
  }

  function chooseView(nextView: PostFeedView) {
    setView(nextView);
    setCategoryFilter('all');
    setSelectedTags([]);
    setSelectedMemberHandle(null);
    setFiltersExpanded(false);
    setMembersExpanded(false);
  }

  if (layout === 'sidebar' && (loading || error)) {
    return <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start" aria-label="Post controls"><IdeaComposer tagCatalog={tagCatalog} tagCatalogLoading={tagCatalogLoading} tagCatalogError={tagCatalogError} /></aside>
      <div className="min-w-0">{loading ? <p className="card p-6 text-braga-100" role="status">Loading posts…</p> : <p className="error-message" role="alert">{error}</p>}</div>
    </div>;
  }
  if (loading) return <p className="card p-6 text-braga-100" role="status">Loading posts…</p>;
  if (error) return <p className="error-message" role="alert">{error}</p>;
  if (initialView !== 'all' && libraryAccess === 'signed-out') return <AuthRequired title={initialView === 'mine' ? 'Your posts' : 'Your bookmarks'} message="Sign in with your member account to see your personal post library." />;
  if (initialView !== 'all' && libraryAccess === 'inactive') return <div className="card p-6"><h2 className="text-xl font-bold text-white">Member access unavailable</h2><p className="mt-2 text-sm leading-6 text-braga-100">This account is signed in, but its community membership is not active. Contact an organizer if that looks wrong.</p></div>;

  const introCopy = participationCopy(libraryAccess);
  const intro = showIntro && (introCopy || nextEvent) && (
    <aside className="rounded-2xl border border-braga-300/20 bg-braga-950/45 p-5" aria-label="Post participation information">
      <div className="flex gap-3"><LuInfo className="mt-0.5 h-5 w-5 shrink-0 text-limewash" aria-hidden="true" /><div className="space-y-2 text-sm leading-6 text-braga-100">{introCopy && <p>{introCopy}</p>}{nextEvent && <p><span className="font-semibold text-white">Next event:</span> {formatEventDate(nextEvent.starts_at)} · <a className="font-semibold text-limewash hover:underline" href={nextEvent.external_url || '/events'} target="_blank" rel="noreferrer noopener">{nextEvent.title} ↗</a></p>}</div></div>
    </aside>
  );

  const controls = (showFilters || (showViewTabs && libraryAccess === 'active')) && (
    <section className="card space-y-6 p-5" aria-label="Filter posts">
      <div>
        <h2 className="text-lg font-black text-white">Filters</h2>
      </div>
      {showViewTabs && libraryAccess === 'active' && <nav className="grid gap-2" aria-label="Post library views">
        {(Object.keys(viewLabels) as PostFeedView[]).map((item) => <button key={item} type="button" className={`${filterPill} text-left ${view === item ? 'border-limewash bg-limewash text-ink-950' : 'border-braga-300/30 text-braga-100 hover:border-limewash/60'}`} aria-pressed={view === item} onClick={() => chooseView(item)}>{viewLabels[item]}</button>)}
      </nav>}
      {showFilters && <>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-braga-300">Category</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={`${filterPill} ${categoryFilter === 'all' ? 'border-limewash bg-limewash text-ink-950' : 'border-braga-300/30 text-braga-100'}`} aria-pressed={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>All</button>
            {categoryOptions.map((item) => <button key={item.value} type="button" className={`${filterPill} ${categoryFilter === item.value ? 'border-limewash bg-limewash text-ink-950' : 'border-braga-300/30 text-braga-100 hover:border-limewash/60'}`} aria-pressed={categoryFilter === item.value} onClick={() => setCategoryFilter(item.value)}>{item.label}</button>)}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-braga-300">Tags {selectedTags.length > 0 && <span className="font-normal normal-case tracking-normal">· {selectedTags.length} selected</span>}</p>
          <div id="post-tag-filters" className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={`${filterPill} ${selectedTags.length === 0 ? 'border-violet-300 bg-violet-500/20 text-violet-100' : 'border-braga-300/30 text-braga-100'}`} aria-pressed={selectedTags.length === 0} onClick={() => setSelectedTags([])}>All</button>
            {visibleFilterTags.map((item) => <button key={item.slug} type="button" className={`${filterPill} ${selectedTags.includes(item.slug) ? 'border-violet-300 bg-violet-500/20 text-violet-100' : 'border-braga-300/30 text-braga-100 hover:border-violet-300/60'}`} aria-pressed={selectedTags.includes(item.slug)} onClick={() => toggleTagFilter(item.slug)} title={`${item.usage_count} post${item.usage_count === 1 ? '' : 's'}`}>{item.label}</button>)}
          </div>
          {tagCatalog.length > collapsedTagLimit && <button type="button" className="mx-auto mt-2 flex min-h-8 items-center justify-center rounded-full px-4 text-braga-300 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/60" aria-expanded={filtersExpanded} aria-controls="post-tag-filters" aria-label={filtersExpanded ? 'Show fewer tag filters' : 'Show all tag filters'} onClick={() => setFiltersExpanded((value) => !value)}><LuChevronDown className={`h-4 w-4 transition-transform ${filtersExpanded ? 'rotate-180' : ''}`} aria-hidden="true" /></button>}
          {tagCatalogError && <p className="mt-3 text-sm text-amber-200" role="alert">{tagCatalogError}</p>}
        </div>
        <PostMemberFilters
          members={memberOptions}
          selectedHandle={selectedMemberHandle}
          expanded={membersExpanded}
          onSelectedHandleChange={setSelectedMemberHandle}
          onExpandedChange={setMembersExpanded}
        />
      </>}
    </section>
  );

  const feed = <div className="space-y-5">
    {filteredIdeas.map((idea) => {
      const canEdit = libraryAccess === 'active' && Boolean(idea.viewer_can_edit);
      return <article key={idea.id} className="card p-5 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <PostAuthorIdentity profile={idea.profiles} createdAt={idea.created_at} />
          <div className="ml-auto flex max-w-28 shrink-0 flex-wrap justify-end gap-2 sm:max-w-none">
            <BookmarkButton ideaId={idea.id} title={idea.title} initialBookmarked={idea.viewer_has_bookmarked} access={libraryAccess} onChange={(bookmarked) => updateBookmark(idea.id, bookmarked)} />
            {canEdit && <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-braga-300/30 text-braga-100 hover:border-limewash/70 hover:text-limewash" onClick={() => setEditing(idea)} aria-label={`Edit ${idea.title}`} title="Edit post"><LuPencil className="h-4 w-4" aria-hidden="true" /></button>}
            {isAdmin && idea.status !== 'closed' && <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-limewash/30 text-limewash hover:bg-limewash/10" onClick={() => void markDone(idea)} aria-label={`Mark ${idea.title} as done`} title="Mark done"><LuCheck className="h-4 w-4" aria-hidden="true" /></button>}
            {isAdmin && <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-300/30 text-red-200 hover:bg-red-300/10" onClick={() => void remove(idea)} aria-label={`Delete ${idea.title}`} title="Delete post"><LuTrash2 className="h-4 w-4" aria-hidden="true" /></button>}
          </div>
        </header>
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2"><a href={`/posts/${idea.slug}`} className="text-xl font-bold text-white hover:text-limewash">{idea.title}</a>{idea.status === 'closed' && <span className="rounded-full border border-limewash/30 bg-limewash/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-limewash">Done</span>}</div>
          <div className="mt-3"><TaxonomyBadges idea={idea} tagLabels={tagLabels} activeCategory={categoryFilter} selectedTags={selectedTags} onCategory={showFilters ? setCategoryFilter : undefined} onTag={showFilters ? toggleTagFilter : undefined} /></div>
          <p className="line-clamp-4 text-sm leading-6 text-braga-100">{idea.body}</p>
        </div>
        <footer className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <UpvoteButton ideaId={idea.id} initialCount={idea.upvote_count ?? 0} initialVoted={idea.viewer_has_voted ?? false} disabled={idea.status === 'closed'} />
            <a
              href={`/posts/${idea.slug}#comments`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-braga-300/30 px-3 text-sm font-semibold text-braga-100 transition hover:border-violet-300/60 hover:text-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-300/60"
              aria-label={`Open ${idea.comment_count ?? 0} ${(idea.comment_count ?? 0) === 1 ? 'comment' : 'comments'} on ${idea.title}`}
            >
              <LuMessageCircle className="h-4 w-4" aria-hidden="true" />
              {idea.comment_count ?? 0}
            </a>
            <SharePostButton slug={idea.slug} title={idea.title} />
          </div>
        </footer>
      </article>;
    })}
    {ideas.length === 0 && <p className="card p-6 text-braga-100">No posts yet. Be the first to add one.</p>}
    {ideas.length > 0 && filteredIdeas.length === 0 && <p className="card p-6 text-braga-100">{view === 'mine' ? 'You have not published any posts with your member profile yet.' : view === 'bookmarks' ? 'You have not bookmarked any posts yet.' : 'No posts match those filters.'}</p>}
    {editing && <IdeaEditor idea={editing} tagCatalog={tagCatalog} tagCatalogLoading={tagCatalogLoading} tagCatalogError={tagCatalogError} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(false); }} />}
  </div>;

  if (layout === 'sidebar') {
    return <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start" aria-label="Post controls">
        <IdeaComposer tagCatalog={tagCatalog} tagCatalogLoading={tagCatalogLoading} tagCatalogError={tagCatalogError} />
        {controls}
      </aside>
      <div className="min-w-0 space-y-5">{intro}{feed}</div>
    </div>;
  }

  return <div className="space-y-5">{intro}{controls}{feed}</div>;
}
