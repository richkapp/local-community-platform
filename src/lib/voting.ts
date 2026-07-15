import { supabase } from './supabase';
import type { AdminCommunityVote, CommunityVote, VotingFeatureAccess } from './types';

export type CommunityVoteInput = {
  title: string;
  description: string;
  closesAt: string;
  options: string[];
};

export type NormalizedCommunityVoteInput = {
  title: string;
  description: string;
  closesAt: string;
  options: string[];
};

export function normalizeCommunityVoteInput(input: CommunityVoteInput): NormalizedCommunityVoteInput {
  const title = input.title.trim();
  const description = input.description.trim();
  const options = input.options.map((option) => option.trim());
  const closesAt = new Date(input.closesAt);

  if (title.length < 4 || title.length > 140) {
    throw new Error('Vote titles must be between 4 and 140 characters.');
  }
  if (description.length < 10 || description.length > 4000) {
    throw new Error('Vote descriptions must be between 10 and 4000 characters.');
  }
  if (options.length < 2 || options.length > 10) {
    throw new Error('Votes require between 2 and 10 options.');
  }
  if (options.some((option) => option.length < 1 || option.length > 180)) {
    throw new Error('Vote options must be between 1 and 180 characters.');
  }
  if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) {
    throw new Error('Vote options must be distinct.');
  }
  if (Number.isNaN(closesAt.getTime()) || closesAt.getTime() <= Date.now()) {
    throw new Error('Vote closing time must be in the future.');
  }

  return {
    title,
    description,
    closesAt: closesAt.toISOString(),
    options
  };
}

export function calculateVotePercentage(ballotCount: number, totalBallots: number) {
  if (totalBallots <= 0 || ballotCount <= 0) return 0;
  return Math.round((ballotCount / totalBallots) * 100);
}

export function canManageCommunityVotes(user: { is_anonymous?: boolean } | null | undefined, role: 'member' | 'admin' | 'super_admin' | null) {
  return Boolean(user && !user.is_anonymous && (role === 'admin' || role === 'super_admin'));
}

export function canViewCommunityVoting(access: VotingFeatureAccess | null | undefined) {
  return Boolean(access?.is_enabled || access?.viewer_is_admin);
}

export function shouldShowVotingLink(access: VotingFeatureAccess | null | undefined) {
  return Boolean(access?.is_enabled);
}

export async function getVotingFeatureAccess() {
  const { data, error } = await supabase.rpc('get_voting_feature_access');
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as VotingFeatureAccess | null;
  return {
    is_enabled: Boolean(row?.is_enabled),
    viewer_is_admin: Boolean(row?.viewer_is_admin)
  } satisfies VotingFeatureAccess;
}

export async function setVotingFeatureEnabled(enabled: boolean) {
  const { data, error } = await supabase.rpc('admin_set_voting_feature_enabled', { p_enabled: enabled });
  if (error) throw error;
  const isEnabled = Boolean(data);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('community:voting-visibility-changed', { detail: { is_enabled: isEnabled } }));
  }
  return isEnabled;
}

export async function listCommunityVotes() {
  const { data, error } = await supabase.rpc('list_public_community_votes');
  if (error) throw error;
  return (data ?? []) as CommunityVote[];
}

export async function submitCommunityBallot(voteId: string, optionId: string, isAnonymous: boolean) {
  const { data, error } = await supabase.rpc('submit_community_ballot', {
    target_vote_id: voteId,
    target_option_id: optionId,
    p_is_anonymous: isAnonymous
  });
  if (error) throw error;
  return String(data);
}

export async function listAdminCommunityVotes() {
  const { data, error } = await supabase.rpc('admin_list_community_votes');
  if (error) throw error;
  return (data ?? []) as AdminCommunityVote[];
}

export async function createCommunityVote(input: CommunityVoteInput, publish: boolean) {
  const normalized = normalizeCommunityVoteInput(input);
  const { data, error } = await supabase.rpc('admin_create_community_vote', {
    p_title: normalized.title,
    p_description: normalized.description,
    p_closes_at: normalized.closesAt,
    p_options: normalized.options,
    p_publish: publish
  });
  if (error) throw error;
  return String(data);
}

export async function updateCommunityVote(voteId: string, input: CommunityVoteInput, publish: boolean) {
  const normalized = normalizeCommunityVoteInput(input);
  const { data, error } = await supabase.rpc('admin_update_community_vote', {
    target_vote_id: voteId,
    p_title: normalized.title,
    p_description: normalized.description,
    p_closes_at: normalized.closesAt,
    p_options: normalized.options,
    p_publish: publish
  });
  if (error) throw error;
  return String(data);
}

export async function closeCommunityVote(voteId: string) {
  const { data, error } = await supabase.rpc('admin_close_community_vote', { target_vote_id: voteId });
  if (error) throw error;
  return String(data);
}

export async function deleteCommunityVote(voteId: string) {
  const { data, error } = await supabase.rpc('admin_delete_community_vote', { target_vote_id: voteId });
  if (error) throw error;
  return Boolean(data);
}
