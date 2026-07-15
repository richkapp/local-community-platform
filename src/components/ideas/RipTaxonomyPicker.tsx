import { useId, useState } from 'react';
import { LuChevronDown, LuInfo, LuPlus } from 'react-icons/lu';
import { RIP_CATEGORIES } from '@/lib/rips';
import { createPostTag } from '@/lib/ideas';
import { toUserMessage } from '@/lib/errors';
import type { PostTagCatalogItem, RipCategory, RipTag } from '@/lib/types';

type Props = {
  category: RipCategory;
  tags: RipTag[];
  catalog: PostTagCatalogItem[];
  catalogLoading: boolean;
  catalogError: string;
  onCategoryChange: (category: RipCategory) => void;
  onTagsChange: (tags: RipTag[]) => void;
};

const basePill = 'rounded-full border px-3 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-limewash/70';
const collapsedTagLimit = 6;

export default function RipTaxonomyPicker({ category, tags, catalog, catalogLoading, catalogError, onCategoryChange, onTagsChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const disclosureId = useId();
  const infoId = useId();
  const quota = catalog[0];
  const createdCount = quota?.viewer_custom_tag_count ?? 0;
  const tagLimit = quota?.viewer_custom_tag_limit ?? 3;
  const viewerIsActive = quota?.viewer_is_active ?? false;
  const canCreate = viewerIsActive && createdCount < tagLimit;
  const canCreateForPost = canCreate && tags.length < 6;
  const visibleTags = expanded ? catalog : catalog.slice(0, collapsedTagLimit);
  const canExpand = catalog.length > collapsedTagLimit || viewerIsActive;

  function toggleTag(tag: RipTag) {
    setMessage('');
    if (tags.includes(tag)) {
      onTagsChange(tags.filter((value) => value !== tag));
      return;
    }
    if (tags.length >= 6) {
      setMessage('A post can use up to 6 tags. Remove one before choosing another.');
      return;
    }
    onTagsChange([...tags, tag]);
  }

  async function addTag() {
    if (tags.length >= 6) {
      setMessage('Remove one selected tag before creating another for this post.');
      return;
    }
    if (!newTag.trim() || creating || !canCreate) return;
    setCreating(true);
    setMessage('');
    try {
      const slug = await createPostTag(newTag);
      onTagsChange([...tags, slug]);
      setNewTag('');
      setAdding(false);
      setMessage('Tag added and selected.');
      window.dispatchEvent(new CustomEvent('community:tags-changed'));
    } catch (caught) {
      setMessage(toUserMessage('tag-create', caught));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="label">Category</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {RIP_CATEGORIES.map((item) => <button key={item.value} type="button" className={`${basePill} ${category === item.value ? 'border-limewash bg-limewash text-ink-950' : 'border-braga-300/30 text-braga-100 hover:border-limewash/60 hover:text-white'}`} aria-pressed={category === item.value} onClick={() => onCategoryChange(item.value)}>{item.label}</button>)}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Tags <span className="font-normal text-braga-300">(choose up to 6 · {tags.length} selected)</span></legend>
        {catalogLoading && catalog.length === 0
          ? <p className="mt-2 text-sm text-braga-300" role="status">Loading tags…</p>
          : <>
            <div id={disclosureId} className="mt-2 flex flex-wrap gap-2">
              {visibleTags.map((item) => <button key={item.slug} type="button" className={`${basePill} ${tags.includes(item.slug) ? 'border-violet-300 bg-violet-500/20 text-violet-100' : 'border-braga-300/30 text-braga-100 hover:border-violet-300/60 hover:text-white'} disabled:cursor-wait disabled:opacity-60`} aria-pressed={tags.includes(item.slug)} disabled={creating} onClick={() => toggleTag(item.slug)} title={`${item.usage_count} post${item.usage_count === 1 ? '' : 's'}`}>{item.label}</button>)}
            </div>

            {canExpand && <button type="button" className="mx-auto mt-2 flex min-h-8 items-center justify-center rounded-full px-4 text-braga-300 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/60" aria-expanded={expanded} aria-controls={disclosureId} aria-label={expanded ? 'Show fewer tags' : 'Show all tags'} onClick={() => { setExpanded((value) => !value); setAdding(false); }}>
              <LuChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>}

            {expanded && viewerIsActive && <div className="mt-3 border-t border-braga-300/15 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={`${basePill} inline-flex items-center gap-1.5 border-limewash/40 text-limewash hover:bg-limewash/10 disabled:cursor-not-allowed disabled:border-braga-300/20 disabled:text-braga-300`} disabled={!canCreateForPost} title={tags.length >= 6 ? 'Remove a selected tag before creating another' : canCreate ? 'Create a shared post tag' : 'You have used all 3 lifetime tag slots'} onClick={() => setAdding((value) => !value)} aria-expanded={adding}>
                  <LuPlus className="h-3.5 w-3.5" aria-hidden="true" /> ADD A TAG {createdCount}/{tagLimit}
                </button>
                <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-braga-300 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-limewash/60" aria-label="Explain tag creation rules" aria-expanded={showInfo} aria-controls={infoId} onClick={() => setShowInfo((value) => !value)}>
                  <LuInfo className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {showInfo && <div id={infoId} className="mt-3 rounded-xl border border-limewash/20 bg-limewash/[0.06] px-4 py-3 text-xs leading-5 text-braga-100">
                <strong className="text-white">Tag rules.</strong> Members can create up to 3 tags for the lifetime of their account. Tags are shared with everyone and cannot be renamed or deleted. Use a clear, reusable label with 2–28 letters, numbers, spaces, or hyphens. Categories stay fixed; tags describe the topic. Each post can use up to 6 tags.
              </div>}

              {adding && canCreateForPost && <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor={`${infoId}-new-tag`}>New tag name</label>
                <input id={`${infoId}-new-tag`} className="input min-w-0 flex-1" value={newTag} onChange={(event) => setNewTag(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void addTag(); } }} placeholder="e.g. AI Agents" minLength={2} maxLength={28} autoFocus disabled={creating} />
                <button type="button" className="btn-primary shrink-0" onClick={() => void addTag()} disabled={creating || newTag.trim().length < 2}>{creating ? 'Adding…' : 'Add tag'}</button>
                <button type="button" className="px-3 py-2 text-sm text-braga-200 hover:text-white" onClick={() => { setAdding(false); setNewTag(''); }} disabled={creating}>Cancel</button>
              </div>}
            </div>}
          </>}
        {(catalogError || message) && <p className="mt-3 text-sm leading-5 text-amber-200" role={catalogError ? 'alert' : 'status'} aria-live="polite">{catalogError || message}</p>}
      </fieldset>
    </div>
  );
}
