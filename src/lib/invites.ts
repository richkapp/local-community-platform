import { supabase } from './supabase';

export type MemberInviteStatus = 'available' | 'pending' | 'used';

export type MemberInvite = {
  invite_id: string;
  code: string;
  status: MemberInviteStatus;
  created_at: string;
  status_at: string | null;
};

export async function getMyMemberInvites() {
  const { data, error } = await supabase.rpc('get_my_member_invites');
  if (error) throw error;
  return (data ?? []) as MemberInvite[];
}
