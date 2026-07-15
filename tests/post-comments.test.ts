import { describe, expect, test } from 'bun:test';
import { buildPostCommentTree } from '../src/lib/postComments';
import type { PostComment } from '../src/lib/types';

function comment(id: string, parentId: string | null): PostComment {
  return {
    id,
    parent_id: parentId,
    body: `Comment ${id}`,
    created_at: '2026-07-14T12:00:00.000Z',
    is_anonymous: false,
    profiles: null,
    upvote_count: 0,
    viewer_has_upvoted: false
  };
}

describe('post comment threads', () => {
  test('builds replies to replies without flattening their parentage', () => {
    const tree = buildPostCommentTree([
      comment('root', null),
      comment('reply', 'root'),
      comment('nested', 'reply'),
      comment('sibling', 'root')
    ]);

    expect(tree.map((item) => item.id)).toEqual(['root']);
    expect(tree[0]?.replies.map((item) => item.id)).toEqual(['reply', 'sibling']);
    expect(tree[0]?.replies[0]?.replies.map((item) => item.id)).toEqual(['nested']);
  });

  test('preserves RPC order and keeps defensive orphans visible', () => {
    const tree = buildPostCommentTree([
      comment('first', null),
      comment('orphan', 'missing'),
      comment('last', null)
    ]);

    expect(tree.map((item) => item.id)).toEqual(['first', 'orphan', 'last']);
  });

  test('does not attach a malformed comment to itself', () => {
    const tree = buildPostCommentTree([comment('self', 'self')]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.replies).toEqual([]);
  });
});
