import { supabase } from './supabase';

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

export function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export async function createIdea(title: string, body: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('You need to sign in first.');

  const slug = `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await supabase
    .from('ideas')
    .insert({ title, body, slug, month_key: currentMonthKey(), author_id: userData.user.id })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function toggleUpvote(ideaId: string, hasVoted: boolean) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('You need to sign in first.');

  if (hasVoted) {
    const { error } = await supabase
      .from('idea_votes')
      .delete()
      .eq('idea_id', ideaId)
      .eq('user_id', userData.user.id);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from('idea_votes').insert({ idea_id: ideaId, user_id: userData.user.id });
  if (error) throw error;
  return true;
}
