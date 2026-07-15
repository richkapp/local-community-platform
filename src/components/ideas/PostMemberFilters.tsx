import { LuChevronDown } from 'react-icons/lu';
import type { PostMemberFilterOption } from '@/lib/postMemberFilters';
import AvatarImage from '@/components/profile/AvatarImage';

export const collapsedMemberLimit = 6;

type Props = {
  members: PostMemberFilterOption[];
  selectedHandle: string | null;
  expanded: boolean;
  onSelectedHandleChange: (handle: string | null) => void;
  onExpandedChange: (expanded: boolean) => void;
};

function collapsedMembers(members: PostMemberFilterOption[], selectedHandle: string | null) {
  const visible = members.slice(0, collapsedMemberLimit);
  if (!selectedHandle || visible.some((member) => member.handle === selectedHandle)) return visible;
  const selected = members.find((member) => member.handle === selectedHandle);
  return selected ? [...visible.slice(0, collapsedMemberLimit - 1), selected] : visible;
}

export default function PostMemberFilters({ members, selectedHandle, expanded, onSelectedHandleChange, onExpandedChange }: Props) {
  if (members.length === 0) return null;
  const visibleMembers = expanded ? members : collapsedMembers(members, selectedHandle);

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-braga-300">
        Member {selectedHandle && <span className="font-normal normal-case tracking-normal">· 1 selected</span>}
      </p>
      <div id="post-member-filters" className="mt-3 flex flex-wrap gap-2">
        {visibleMembers.map((member, index) => {
          const selected = selectedHandle === member.handle;
          const tooltipId = `post-member-tooltip-${index}`;
          const postLabel = `${member.postCount} post${member.postCount === 1 ? '' : 's'}`;
          return (
            <button
              key={member.handle}
              type="button"
              className={`group relative grid h-11 w-11 place-items-center rounded-full border p-0.5 transition focus:outline-none focus:ring-2 focus:ring-limewash/70 ${selected ? 'border-limewash bg-limewash/15 ring-2 ring-limewash/70' : 'border-braga-300/35 hover:border-limewash/70'}`}
              aria-label={`Filter posts by member: ${member.profile.display_name}, ${postLabel}`}
              aria-describedby={tooltipId}
              aria-pressed={selected}
              onClick={() => onSelectedHandleChange(selected ? null : member.handle)}
            >
              <AvatarImage
                profile={member.profile}
                imageClassName="h-9 w-9 rounded-full object-cover"
                fallbackClassName="grid h-9 w-9 place-items-center rounded-full bg-limewash text-xs font-black text-ink-950"
              />
              <span id={tooltipId} role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-ink-950 px-2.5 py-1.5 text-xs font-semibold normal-case tracking-normal text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {member.profile.display_name}
              </span>
            </button>
          );
        })}
      </div>
      {members.length > collapsedMemberLimit && (
        <button
          type="button"
          className="mx-auto mt-2 flex min-h-8 items-center justify-center rounded-full px-4 text-braga-300 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-limewash/60"
          aria-expanded={expanded}
          aria-controls="post-member-filters"
          aria-label={expanded ? 'Show fewer member filters' : 'Show all member filters'}
          onClick={() => onExpandedChange(!expanded)}
        >
          <LuChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
