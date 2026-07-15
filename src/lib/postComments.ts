import { supabase } from './supabase';
import type { PostComment, PublicProfile } from './types';

type CommentCountRow = {
  idea_id: string;
  comment_count: number;
};

type CommentRecord = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  is_anonymous: boolean;
  author_handle: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  author_avatar_path: string | null;
  author_avatar_updated_at: string | null;
  upvote_count: number;
  viewer_has_upvoted: boolean;
};

type CommentVoteResult = {
  viewer_has_upvoted: boolean;
  upvote_count: number;
};

export type PostCommentNode = PostComment & {
  replies: PostCommentNode[];
};

export async function listIdeaCommentCounts(ideaIds: string[]): Promise<CommentCountRow[]> {
  if (ideaIds.length === 0) return [];
  const { data, error } = await supabase.rpc('list_idea_comment_counts', { target_idea_ids: ideaIds });
  if (error) throw error;
  return (data ?? []) as CommentCountRow[];
}

export async function listIdeaComments(ideaId: string): Promise<PostComment[]> {
  const { data, error } = await supabase.rpc('list_idea_comments', { target_idea_id: ideaId });
  if (error) throw error;

  return ((data ?? []) as CommentRecord[]).map((comment) => {
    const profile: PublicProfile | null = !comment.is_anonymous && comment.author_display_name
      ? {
          handle: comment.author_handle,
          display_name: comment.author_display_name,
          avatar_url: comment.author_avatar_url,
          avatar_path: comment.author_avatar_path,
          avatar_updated_at: comment.author_avatar_updated_at,
          bio: '',
          website_url: null,
          linkedin_url: null,
          github_url: null,
          x_url: null
        }
      : null;

    return {
      id: comment.id,
      parent_id: comment.parent_id,
      body: comment.body,
      created_at: comment.created_at,
      is_anonymous: comment.is_anonymous,
      profiles: profile,
      upvote_count: comment.upvote_count,
      viewer_has_upvoted: comment.viewer_has_upvoted
    };
  });
}

export async function createIdeaComment(input: {
  ideaId: string;
  parentId?: string | null;
  body: string;
  postAnonymously: boolean;
}) {
  const body = input.body.trim();
  if (body.length < 1 || body.length > 1500) throw new Error('Comments must be between 1 and 1500 characters.');

  const { data, error } = await supabase.rpc('create_idea_comment', {
    target_idea_id: input.ideaId,
    target_parent_id: input.parentId ?? null,
    comment_body: body,
    post_anonymously: input.postAnonymously
  });
  if (error) throw error;
  return String(data);
}

export async function toggleIdeaCommentUpvote(commentId: string): Promise<CommentVoteResult> {
  const { data, error } = await supabase
    .rpc('toggle_idea_comment_upvote', { target_comment_id: commentId })
    .single();
  if (error) throw error;
  return data as CommentVoteResult;
}

export function buildPostCommentTree(comments: PostComment[]): PostCommentNode[] {
  const nodes = new Map<string, PostCommentNode>();
  for (const comment of comments) {
    nodes.set(comment.id, { ...comment, replies: [] });
  }
  const roots: PostCommentNode[] = [];

  for (const comment of comments) {
    const node = nodes.get(comment.id);
    if (!node) continue;
    const parent = comment.parent_id ? nodes.get(comment.parent_id) : null;
    if (parent && parent.id !== node.id) parent.replies.push(node);
    else roots.push(node);
  }

  return roots;
}
