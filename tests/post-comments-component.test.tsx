import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import React from 'react';
import type { PostCommentNode } from '@/lib/postComments';

GlobalRegistrator.register();
const { act, cleanup, fireEvent, render, waitFor } = await import('@testing-library/react');
const { CommentCard, CommentForm } = await import('@/components/ideas/PostCommentControls');

afterEach(() => cleanup());
afterAll(() => GlobalRegistrator.unregister());

const alice = {
  handle: 'alice', display_name: 'Alice Example', bio: '', avatar_url: null, avatar_path: null,
  avatar_updated_at: null, website_url: null, linkedin_url: null, github_url: null, x_url: null
};

function node(overrides: Partial<PostCommentNode> = {}): PostCommentNode {
  return {
    id: 'reply',
    parent_id: 'root',
    body: 'Reply to the root comment',
    created_at: '2026-07-14T12:05:00.000Z',
    is_anonymous: false,
    profiles: alice,
    upvote_count: 2,
    viewer_has_upvoted: false,
    replies: [],
    ...overrides
  };
}

describe('post comment controls', () => {
  test('submits member and anonymous attribution modes', async () => {
    const submissions: Array<{ body: string; postAnonymously: boolean }> = [];
    const view = render(<CommentForm
      label="Add a comment"
      anonymousKind="comment"
      allowAnonymous
      onCancel={() => {}}
      onSubmit={async (body: string, postAnonymously: boolean) => { submissions.push({ body, postAnonymously }); }}
    />);

    fireEvent.change(view.getByLabelText('Add a comment'), { target: { value: 'Member comment' } });
    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Post' }));
      await Promise.resolve();
    });
    await waitFor(() => expect(submissions).toContainEqual({ body: 'Member comment', postAnonymously: false }));
    expect(view.getByRole('button', { name: 'Post' }).hasAttribute('disabled')).toBe(true);

    fireEvent.change(view.getByLabelText('Add a comment'), { target: { value: 'Anonymous comment' } });
    fireEvent.click(view.getByLabelText('Post anon?'));
    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Post' }));
      await Promise.resolve();
    });
    await waitFor(() => expect(submissions).toContainEqual({ body: 'Anonymous comment', postAnonymously: true }));
    expect(view.getByRole('button', { name: 'Post' }).hasAttribute('disabled')).toBe(true);
  });

  test('disables anonymous mode when organizers turn it off', () => {
    const view = render(<CommentForm
      label="Add a comment"
      anonymousKind="comment"
      allowAnonymous={false}
      onCancel={() => {}}
      onSubmit={async () => {}}
    />);

    expect(view.getByLabelText('Post anon?').hasAttribute('disabled')).toBe(true);
    expect(view.getByText('Anonymous comments are disabled.')).toBeTruthy();
  });

  test('keeps deleted authors distinct from anonymous attribution', async () => {
    const deletedAuthorComment: PostCommentNode = {
      id: 'comment-deleted-author',
      parent_id: null,
      body: 'The thread remains after the member leaves.',
      created_at: '2026-07-14T10:00:00Z',
      is_anonymous: false,
      profiles: null,
      upvote_count: 0,
      viewer_has_upvoted: false,
      replies: []
    };
    const view = render(<CommentCard
      comment={deletedAuthorComment}
      depth={0}
      access="signed-out"
      replyingTo={null}
      votingId={null}
      onReply={() => undefined}
      onCreateReply={async () => undefined}
      onVote={async () => undefined}
      allowAnonymousReplies
    />);
    expect(view.getByText('Former member')).toBeTruthy();
    expect(view.queryByText('Anonymous')).toBeNull();
  });

  test('can reply to a reply and invoke its upvote control', async () => {
    const replies: Array<{ parentId: string; body: string; postAnonymously: boolean }> = [];
    const votes: string[] = [];
    const reply = node();
    const view = render(<CommentCard
      comment={reply}
      depth={2}
      access="active"
      replyingTo={reply.id}
      votingId={null}
      onReply={() => {}}
      onCreateReply={async (parentId: string, body: string, postAnonymously: boolean) => { replies.push({ parentId, body, postAnonymously }); }}
      onVote={async (commentId: string) => { votes.push(commentId); }}
      allowAnonymousReplies
    />);

    fireEvent.click(view.getByRole('button', { name: 'Upvote comment by Alice Example' }));
    await waitFor(() => expect(votes).toEqual(['reply']));

    fireEvent.change(view.getByLabelText('Reply to Alice Example'), { target: { value: 'Nested response' } });
    fireEvent.click(view.getByLabelText('Post anon?'));
    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Post' }));
      await Promise.resolve();
    });
    await waitFor(() => expect(replies).toEqual([
      { parentId: 'reply', body: 'Nested response', postAnonymously: true }
    ]));
    expect(view.getByRole('button', { name: 'Post' }).hasAttribute('disabled')).toBe(true);
  });
});
