import { communityConfig } from '@/config/community';

export function formatCommunityDate(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
) {
  return new Intl.DateTimeFormat(communityConfig.locale, {
    ...options,
    timeZone: communityConfig.timeZone
  }).format(new Date(value));
}

export function communityDateKey(value: string | number | Date) {
  const parts = new Intl.DateTimeFormat(communityConfig.locale, {
    timeZone: communityConfig.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
