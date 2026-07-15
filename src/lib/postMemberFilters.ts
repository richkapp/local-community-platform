import type { Idea, PublicProfile } from './types';

export type PostMemberFilterOption = {
  handle: string;
  profile: PublicProfile;
  postCount: number;
};

export type PostFeedView = 'all' | 'mine' | 'bookmarks';

export function scopeIdeasToPostView(ideas: Idea[], view: PostFeedView) {
  if (view === 'mine') return ideas.filter((idea) => idea.viewer_is_author);
  if (view === 'bookmarks') return ideas.filter((idea) => idea.viewer_has_bookmarked);
  return ideas;
}

export function rankPostingMembers(ideas: Idea[]): PostMemberFilterOption[] {
  const members = new Map<string, PostMemberFilterOption>();

  for (const idea of ideas) {
    const profile = idea.profiles;
    if (!profile?.handle) continue;
    const existing = members.get(profile.handle);
    if (existing) existing.postCount += 1;
    else members.set(profile.handle, { handle: profile.handle, profile, postCount: 1 });
  }

  return [...members.values()].sort((left, right) =>
    right.postCount - left.postCount
    || left.profile.display_name.localeCompare(right.profile.display_name)
    || left.handle.localeCompare(right.handle)
  );
}

export function ideaMatchesMember(idea: Idea, selectedHandle: string | null) {
  return selectedHandle === null || idea.profiles?.handle === selectedHandle;
}
