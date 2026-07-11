import { supabase } from './supabase';
import { slugWithRandomSuffix } from './slug';
import { RIP_CATEGORIES, normalizeRipTags } from './rips';
import type { Idea, RipCategory, RipTag } from './types';
import { createAnonymousIdea, isAnonymousUser, toggleAnonymousVote } from './anonymous';

type PublicAuthor = {
  idea_id: string;
  handle: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  website_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  x_url: string | null;
};

export type IdeaPostingMode = 'anonymous' | 'account';
export type RipInput = { title: string; body: string; category: RipCategory; tags: RipTag[] };
export type CreateRipInput = RipInput & { mode: IdeaPostingMode };
export const PUBLIC_IDEA_COLUMNS = 'id, slug, title, body, month_key, status, created_at, updated_at, category, tags';

export async function attachPublicAuthors(ideas: Idea[]): Promise<Idea[]> {
  const ideaIds = ideas.map((idea) => idea.id);
  if (!ideaIds.length) return ideas;

  const { data, error } = await supabase
    .from('idea_public_authors')
    .select('idea_id, handle, display_name, avatar_url, bio, website_url, linkedin_url, github_url, x_url')
    .in('idea_id', ideaIds);
  if (error) throw error;

  const authors = new Map((data as PublicAuthor[] | null)?.map((author) => [author.idea_id, author]) ?? []);
  return ideas.map((idea) => {
    const author = authors.get(idea.id);
    return {
      ...idea,
      profiles: author
        ? {
            handle: author.handle,
            display_name: author.display_name,
            avatar_url: author.avatar_url,
            bio: author.bio,
            website_url: author.website_url,
            linkedin_url: author.linkedin_url,
            github_url: author.github_url,
            x_url: author.x_url
          }
        : null,
    };
  });
}

export function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function normalizeRip(input: RipInput): RipInput {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 4 || title.length > 120) throw new Error('Post titles must be 4–120 characters.');
  if (body.length < 10 || body.length > 2000) throw new Error('Post details must be 10–2000 characters.');
  if (!RIP_CATEGORIES.some((item) => item.value === input.category)) throw new Error('Choose a post category.');
  return { title, body, category: input.category, tags: normalizeRipTags(input.tags) };
}

export async function createIdea(input: CreateRipInput) {
  const rip = normalizeRip(input);
  const slug = slugWithRandomSuffix(rip.title);
  const monthKey = currentMonthKey();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;

  if (input.mode === 'anonymous') return createAnonymousIdea(rip.title, rip.body, slug, monthKey, rip.category, rip.tags);
  if (!user || isAnonymousUser(user)) throw new Error('Create or sign in to an account before posting with your profile.');

  const { data, error } = await supabase
    .from('ideas')
    .insert({ title: rip.title, body: rip.body, category: rip.category, tags: rip.tags, slug, month_key: monthKey, author_id: user.id })
    .select(PUBLIC_IDEA_COLUMNS)
    .single<Idea>();
  if (error) throw error;
  return data;
}

export async function toggleUpvote(ideaId: string, hasVoted: boolean) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;

  if (!user || isAnonymousUser(user)) return (await toggleAnonymousVote(ideaId)).voted;

  if (hasVoted) {
    const { error } = await supabase.from('idea_votes').delete().eq('idea_id', ideaId).eq('user_id', user.id);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from('idea_votes').insert({ idea_id: ideaId, user_id: user.id });
  if (error) {
    if (error.code === '23505') return true;
    throw error;
  }
  return true;
}

export async function updateOwnIdea(ideaId: string, input: RipInput) {
  const rip = normalizeRip(input);
  const { data, error } = await supabase
    .from('ideas')
    .update({ title: rip.title, body: rip.body, category: rip.category, tags: rip.tags })
    .eq('id', ideaId)
    .select(PUBLIC_IDEA_COLUMNS)
    .single<Idea>();
  if (error) throw error;
  return data;
}
