import { RIP_CATEGORIES, RIP_TAGS } from '@/lib/rips';
import type { RipCategory, RipTag } from '@/lib/types';

type Props = {
  category: RipCategory;
  tags: RipTag[];
  onCategoryChange: (category: RipCategory) => void;
  onTagsChange: (tags: RipTag[]) => void;
};

const basePill = 'rounded-full border px-3 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-limewash/70';

export default function RipTaxonomyPicker({ category, tags, onCategoryChange, onTagsChange }: Props) {
  function toggleTag(tag: RipTag) {
    onTagsChange(tags.includes(tag) ? tags.filter((value) => value !== tag) : [...tags, tag]);
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
        <legend className="label">Tags <span className="font-normal text-braga-300">(choose any)</span></legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {RIP_TAGS.map((item) => <button key={item.value} type="button" className={`${basePill} ${tags.includes(item.value) ? 'border-violet-300 bg-violet-500/20 text-violet-100' : 'border-braga-300/30 text-braga-100 hover:border-violet-300/60 hover:text-white'}`} aria-pressed={tags.includes(item.value)} onClick={() => toggleTag(item.value)}>{item.label}</button>)}
        </div>
      </fieldset>
    </div>
  );
}
