import { supabaseAnonKey, supabaseUrl } from './supabase';
import { normalizeRipTags, RIP_CATEGORIES } from './rips';
import type { RipCategory, RipTag } from './types';

export type SavedIdeaDraft = { title: string; body: string; category: RipCategory; tags: RipTag[]; savedAt: number };
const draftKey = 'braga-idea-draft-v1';
const maxDraftAge = 7 * 24 * 60 * 60 * 1000;

export function saveIdeaDraft(title: string, body: string, category: RipCategory, tags: RipTag[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(draftKey, JSON.stringify({ title, body, category, tags: normalizeRipTags(tags), savedAt: Date.now() } satisfies SavedIdeaDraft));
}

export function loadIdeaDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const draft = JSON.parse(window.localStorage.getItem(draftKey) || 'null') as Partial<SavedIdeaDraft> | null;
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
  if (typeof window !== 'undefined') window.localStorage.removeItem(draftKey);
}

export async function requestIdeaAccount(email: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/request-invite-magic-link`, {
    method: 'POST',
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), context: 'ideas', emailConsent: true })
  });
  const body = await response.json().catch(() => ({})) as { error?: string; message?: string };
  if (!response.ok) throw new Error(body.error || 'Could not send the account link.');
  return body.message || 'Check your email to finish sharing your post.';
}
