import type { User } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './supabase';
import { readMigratedStorageValue } from './browserStorage';

type AnonymousCapableUser = User & { is_anonymous?: boolean };
import type { RipCategory, RipTag } from './types';

type AnonymousIdea = { id: string; slug: string; title: string; body: string; month_key: string; category: RipCategory; tags: RipTag[] };
type AnonymousVote = { voted: boolean; upvote_count: number };

const visitorKey = 'local-community-anonymous-visitor-id-v1';
const voteKey = 'local-community-anonymous-post-votes-v1';
const legacyVisitorKeys = ['braga-anonymous-idea-visitor-id'];
const legacyVoteKeys = ['braga-anonymous-idea-votes'];


export function isAnonymousUser(user: User | null | undefined) {
  return Boolean((user as AnonymousCapableUser | null | undefined)?.is_anonymous);
}

export function getAnonymousVisitorId() {
  if (typeof window === 'undefined') throw new Error('Anonymous ideas are available in a browser.');
  const current = readMigratedStorageValue(window.localStorage, visitorKey, legacyVisitorKeys);
  if (current && /^[0-9a-f-]{36}$/i.test(current)) return current;
  const visitorId = crypto.randomUUID();
  window.localStorage.setItem(visitorKey, visitorId);
  return visitorId;
}

function readVoteIds() {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const value = JSON.parse(readMigratedStorageValue(window.localStorage, voteKey, legacyVoteKeys) || '[]');
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function writeVoteIds(ids: Set<string>) {
  if (typeof window !== 'undefined') window.localStorage.setItem(voteKey, JSON.stringify([...ids]));
}

export function hasAnonymousVote(ideaId: string) {
  return readVoteIds().has(ideaId);
}

async function invokeIdeas<T>(payload: Record<string, unknown>) {
  const response = await fetch(`${supabaseUrl}/functions/v1/anonymous-ideas`, {
    method: 'POST',
    headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || 'Ideas are temporarily unavailable.');
  return body;
}

export async function createAnonymousIdea(title: string, body: string, slug: string, monthKey: string, category: RipCategory, tags: RipTag[]) {
  const result = await invokeIdeas<{ idea: AnonymousIdea }>({ action: 'create', visitorId: getAnonymousVisitorId(), title, body, slug, monthKey, category, tags });
  return result.idea;
}

export async function toggleAnonymousVote(ideaId: string) {
  const result = await invokeIdeas<{ vote: AnonymousVote }>({ action: 'toggle-vote', visitorId: getAnonymousVisitorId(), ideaId });
  if (!result.vote) throw new Error('Vote could not be recorded.');
  const voteIds = readVoteIds();
  if (result.vote.voted) voteIds.add(ideaId); else voteIds.delete(ideaId);
  writeVoteIds(voteIds);
  return result.vote;
}
