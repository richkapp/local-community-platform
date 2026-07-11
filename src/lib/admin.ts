import { supabase } from './supabase';
import type { Event, Idea } from './types';
import { attachPublicAuthors } from './ideas';

export type InviteRecord = {
  id: string;
  code: string;
  label: string;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type AdminMember = {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  auth_created_at: string;
  handle: string | null;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  x_url: string | null;
  role: 'member' | 'admin';
  is_public: boolean;
  profile_created_at: string;
  profile_updated_at: string;
};

export async function listAdminMembers() {
  const { data, error } = await supabase.rpc('admin_list_members');
  if (error) throw error;
  return (data ?? []) as AdminMember[];
}

export async function createInvite(code: string, label: string, maxUses: number | null, expiresAt: string | null) {
  const { data, error } = await supabase
    .from('invites')
    .insert({ code, label: label.trim(), max_uses: maxUses, expires_at: expiresAt })
    .select('*')
    .single<InviteRecord>();
  if (error) throw error;
  return data;
}

export async function listInvites() {
  const { data, error } = await supabase.from('invites').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InviteRecord[];
}

export async function revokeInvite(id: string) {
  const { error } = await supabase.from('invites').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function createEvent(payload: {
  slug: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at?: string | null;
  location_name?: string | null;
  external_url: string;
  image_url?: string | null;
  capacity?: number | null;
  status?: 'draft' | 'published';
}) {
  const { data, error } = await supabase.from('events').insert(payload).select('*').single<Event>();
  if (error) throw error;
  return data;
}

export async function listAdminEvents() {
  const { data, error } = await supabase.from('events').select('*').order('starts_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Event[];
}

export async function updateEventStatus(id: string, status: Event['status']) {
  const { error } = await supabase.from('events').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function updateEvent(id: string, payload: Pick<Event, 'title' | 'description' | 'starts_at' | 'location_name' | 'external_url'>) {
  const { data, error } = await supabase.from('events').update(payload).eq('id', id).select('*').single<Event>();
  if (error) throw error;
  return data;
}

export async function listAdminIdeas() {
  const { data, error } = await supabase
    .rpc('list_visible_ideas')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return attachPublicAuthors((data ?? []) as Idea[]);
}

export async function updateIdeaStatus(id: string, status: Idea['status']) {
  const { error } = await supabase.from('ideas').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteIdea(id: string) {
  const { error } = await supabase.from('ideas').delete().eq('id', id);
  if (error) throw error;
}

export async function isCurrentUserAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return Boolean(data);
}
