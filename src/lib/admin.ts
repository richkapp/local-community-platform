import { supabase } from './supabase';
import type { Event, Idea } from './types';
import { attachPublicAuthors } from './ideas';

export type BugReportStatus = 'new' | 'in_review' | 'done';
export type MemberRole = 'member' | 'admin' | 'super_admin';

export type BugReport = {
  id: string;
  name: string | null;
  email: string | null;
  description: string;
  page_url: string | null;
  status: BugReportStatus;
  created_at: string;
  updated_at: string;
};

export type InviteRecord = {
  id: string;
  code: string;
  label: string;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  invite_kind: 'system' | 'member_single' | 'admin_campaign';
  created_at: string;
};

export type MemberInviteAdminRecord = {
  invite_id: string;
  code: string;
  creator_id: string;
  creator_label: string;
  status: 'available' | 'pending';
  created_at: string;
  status_at: string | null;
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
  avatar_path: string | null;
  avatar_updated_at: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  x_url: string | null;
  role: MemberRole;
  is_public: boolean;
  suspended_at: string | null;
  profile_created_at: string;
  profile_updated_at: string;
};

export async function listAdminMembers() {
  const { data, error } = await supabase.rpc('admin_list_members');
  if (error) throw error;
  return (data ?? []) as AdminMember[];
}

export async function getCurrentMemberRole() {
  const { data, error } = await supabase.rpc('current_member_role');
  if (error) throw error;
  return (data || null) as MemberRole | null;
}

export async function setMemberRole(id: string, role: Exclude<MemberRole, 'super_admin'>) {
  const { data, error } = await supabase.rpc('super_admin_set_member_role', {
    target_user_id: id,
    target_role: role
  });
  if (error) throw error;
  return data as Exclude<MemberRole, 'super_admin'>;
}

export async function setMemberSuspension(id: string, suspended: boolean) {
  const { data, error } = await supabase.rpc('super_admin_set_member_suspension', {
    target_user_id: id,
    should_suspend: suspended
  });
  if (error) throw error;
  return (data || null) as string | null;
}

export async function deleteMember(id: string, avatarPath: string | null) {
  if (avatarPath) {
    const { error: avatarError } = await supabase.storage.from('avatars').remove([avatarPath]);
    if (avatarError) throw avatarError;
  }
  const { data, error } = await supabase.rpc('super_admin_delete_member', { target_user_id: id });
  if (error) throw error;
  if (data !== true) throw new Error('Member deletion was not confirmed.');
}

export async function createInvite(code: string, label: string, maxUses: number, expiresAt: string | null) {
  const { data, error } = await supabase.rpc('create_admin_invite', {
    requested_code: code,
    requested_label: label.trim(),
    requested_max_uses: maxUses,
    requested_expires_at: expiresAt
  });
  if (error) throw error;
  return data as string;
}

export async function listInvites() {
  const { data, error } = await supabase
    .from('invites')
    .select('id, code, label, max_uses, uses_count, expires_at, revoked_at, invite_kind, created_at')
    .in('invite_kind', ['admin_campaign', 'system'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InviteRecord[];
}

export async function listMemberInvitesForAdmin() {
  const { data, error } = await supabase.rpc('list_member_invites_for_admin');
  if (error) throw error;
  return (data ?? []) as MemberInviteAdminRecord[];
}

export async function revokeInvite(id: string) {
  const { data, error } = await supabase.rpc('revoke_admin_invite', { target_invite_id: id });
  if (error) throw error;
  if (data !== true) throw new Error('Invite revocation was not confirmed.');
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

export async function listBugReports() {
  const { data, error } = await supabase
    .from('bug_reports')
    .select('id, name, email, description, page_url, status, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BugReport[];
}

export async function updateBugReportStatus(id: string, status: BugReportStatus) {
  const { error } = await supabase
    .from('bug_reports')
    .update({ status })
    .eq('id', id)
    .select('id')
    .single();
  if (error) throw error;
}

export async function isCurrentUserAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return Boolean(data);
}
