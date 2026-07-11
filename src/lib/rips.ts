import type { RipCategory, RipTag } from './types';

export const RIP_CATEGORIES: ReadonlyArray<{ value: RipCategory; label: string }> = [
  { value: 'idea', label: 'Idea' },
  { value: 'resource', label: 'Resource' },
  { value: 'perspective', label: 'Perspective' }
];

export const RIP_TAGS: ReadonlyArray<{ value: RipTag; label: string }> = [
  { value: 'next-event', label: 'Next Event' },
  { value: 'news', label: 'News' },
  { value: 'community-challenge', label: 'Community Challenge' },
  { value: 'collaboration', label: 'Collaboration' },
  { value: 'learning', label: 'Learning' },
  { value: 'member-project', label: 'Member Project' }
];

export function ripCategoryLabel(value: RipCategory) {
  return RIP_CATEGORIES.find((item) => item.value === value)?.label ?? 'Idea';
}

export function ripTagLabel(value: RipTag) {
  return RIP_TAGS.find((item) => item.value === value)?.label ?? value;
}

export function normalizeRipTags(values: readonly RipTag[]) {
  return [...new Set(values)].filter((value): value is RipTag => RIP_TAGS.some((item) => item.value === value));
}
