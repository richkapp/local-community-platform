import { requestMagicLink } from './magicLink';
import { readMigratedStorageValue } from './browserStorage';
import { normalizeRipTags, RIP_CATEGORIES } from './rips';
import type { RipCategory, RipTag } from './types';

export type SavedIdeaDraft = { title: string; body: string; category: RipCategory; tags: RipTag[]; savedAt: number };
const draftKey = 'local-community-post-draft-v1';
const legacyDraftKeys = ['braga-idea-draft-v1'];
const maxDraftAge = 7 * 24 * 60 * 60 * 1000;


export function saveIdeaDraft(title: string, body: string, category: RipCategory, tags: RipTag[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(draftKey, JSON.stringify({ title, body, category, tags: normalizeRipTags(tags), savedAt: Date.now() } satisfies SavedIdeaDraft));
}

export function loadIdeaDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const draft = JSON.parse(readMigratedStorageValue(window.localStorage, draftKey, legacyDraftKeys) || 'null') as Partial<SavedIdeaDraft> | null;
    if (!draft || typeof draft.title !== 'string' || typeof draft.body !== 'string' || typeof draft.savedAt !== 'number' || Date.now() - draft.savedAt > maxDraftAge) {
      window.localStorage.removeItem(draftKey);
      return null;
    }
    const category = RIP_CATEGORIES.some((item) => item.value === draft.category) ? draft.category as RipCategory : 'idea';
    const tags = normalizeRipTags(Array.isArray(draft.tags) ? draft.tags.filter((tag): tag is RipTag => typeof tag === 'string') : []);
    return { title: draft.title, body: draft.body, category, tags, savedAt: draft.savedAt } satisfies SavedIdeaDraft;
  } catch {
    window.localStorage.removeItem(draftKey);
    return null;
  }
}

export function clearIdeaDraft() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(draftKey);
  legacyDraftKeys.forEach((legacyKey) => window.localStorage.removeItem(legacyKey));
}

export async function requestIdeaSignIn(email: string) {
  // Keep the deployed Edge Function's legacy return marker; the callback maps it to canonical /posts.
  const body = await requestMagicLink({ email, context: 'signin', next: '/ideas', emailConsent: true });
  return body.message || 'If that email belongs to a member, check it for your sign-in link.';
}
