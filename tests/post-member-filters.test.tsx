import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import React from 'react';
import type { Idea, PublicProfile } from '@/lib/types';
import { ideaMatchesMember, rankPostingMembers, scopeIdeasToPostView, type PostMemberFilterOption } from '@/lib/postMemberFilters';

GlobalRegistrator.register();
const { cleanup, fireEvent, render } = await import('@testing-library/react');
const { default: PostMemberFilters, collapsedMemberLimit } = await import('@/components/ideas/PostMemberFilters');

afterEach(() => cleanup());
afterAll(() => GlobalRegistrator.unregister());

function profile(handle: string, displayName: string): PublicProfile {
  return {
    handle,
    display_name: displayName,
    bio: '',
    avatar_url: `https://example.com/${handle}.jpg`,
    avatar_path: null,
    avatar_updated_at: null,
    website_url: null,
    linkedin_url: null,
    github_url: null,
    x_url: null
  };
}

function idea(id: string, author: PublicProfile | null, overrides: Partial<Idea> = {}): Idea {
  return {
    id,
    slug: id,
    title: `Post ${id}`,
    body: 'A valid post body.',
    category: 'idea',
    tags: [],
    month_key: '2026-07',
    status: 'open',
    created_at: '2026-07-14T00:00:00.000Z',
    updated_at: '2026-07-14T00:00:00.000Z',
    profiles: author,
    ...overrides
  };
}

function memberOption(index: number): PostMemberFilterOption {
  return {
    handle: `member-${index}`,
    profile: profile(`member-${index}`, `Member ${index}`),
    postCount: 20 - index
  };
}

describe('post member filter ranking', () => {
  test('ranks public authors by post count and excludes anonymous or private attribution', () => {
    const ada = profile('ada', 'Ada');
    const zara = profile('zara', 'Zara');
    const ranked = rankPostingMembers([
      idea('1', zara), idea('2', ada), idea('3', zara), idea('4', null), idea('5', ada), idea('6', zara)
    ]);

    expect(ranked.map((member) => [member.handle, member.postCount])).toEqual([
      ['zara', 3],
      ['ada', 2]
    ]);
    expect(ideaMatchesMember(idea('7', ada), 'ada')).toBe(true);
    expect(ideaMatchesMember(idea('8', zara), 'ada')).toBe(false);
    expect(ideaMatchesMember(idea('9', null), null)).toBe(true);
  });

  test('breaks equal-count ties by display name', () => {
    const ranked = rankPostingMembers([
      idea('1', profile('zoe', 'Zoe')),
      idea('2', profile('ana', 'Ana'))
    ]);
    expect(ranked.map((member) => member.handle)).toEqual(['ana', 'zoe']);
  });
  test('scopes ranking choices to the active post-library view', () => {
    const ada = profile('ada', 'Ada');
    const zara = profile('zara', 'Zara');
    const rows = [
      idea('1', zara, { viewer_has_bookmarked: true }),
      idea('2', ada, { viewer_is_author: true }),
      idea('3', zara),
      idea('4', ada, { viewer_is_author: true, viewer_has_bookmarked: true })
    ];

    expect(rankPostingMembers(scopeIdeasToPostView(rows, 'mine')).map((member) => [member.handle, member.postCount]))
      .toEqual([['ada', 2]]);
    expect(rankPostingMembers(scopeIdeasToPostView(rows, 'bookmarks')).map((member) => member.handle))
      .toEqual(['ada', 'zara']);
    expect(scopeIdeasToPostView(rows, 'all')).toHaveLength(4);
  });
});

describe('PostMemberFilters', () => {
  test('shows six avatars, expands all, exposes names, and toggles the selected member', () => {
    const members = Array.from({ length: 8 }, (_, index) => memberOption(index + 1));
    let selectedHandle: string | null = null;
    let expanded = false;
    const onSelectedHandleChange = (handle: string | null) => { selectedHandle = handle; };
    const onExpandedChange = (value: boolean) => { expanded = value; };
    const view = render(
      <PostMemberFilters
        members={members}
        selectedHandle={selectedHandle}
        expanded={expanded}
        onSelectedHandleChange={onSelectedHandleChange}
        onExpandedChange={onExpandedChange}
      />
    );

    expect(collapsedMemberLimit).toBe(6);
    expect(view.getAllByRole('button', { name: /Filter posts by member:/ })).toHaveLength(6);
    const firstButton = view.getByRole('button', { name: /Member 1/ });
    const tooltipId = firstButton.getAttribute('aria-describedby');
    expect(tooltipId).toBeTruthy();
    expect(document.getElementById(tooltipId!)?.textContent?.trim()).toBe('Member 1');

    fireEvent.click(view.getByRole('button', { name: 'Show all member filters' }));
    expect(expanded).toBe(true);
    view.rerender(
      <PostMemberFilters
        members={members}
        selectedHandle={selectedHandle}
        expanded={expanded}
        onSelectedHandleChange={onSelectedHandleChange}
        onExpandedChange={onExpandedChange}
      />
    );
    expect(view.getAllByRole('button', { name: /Filter posts by member:/ })).toHaveLength(8);

    fireEvent.click(view.getByRole('button', { name: /Member 8/ }));
    expect(selectedHandle).toBe('member-8');
    view.rerender(
      <PostMemberFilters
        members={members}
        selectedHandle={selectedHandle}
        expanded={false}
        onSelectedHandleChange={onSelectedHandleChange}
        onExpandedChange={onExpandedChange}
      />
    );
    expect(view.getAllByRole('button', { name: /Filter posts by member:/ })).toHaveLength(6);
    expect(view.getByRole('button', { name: /Member 8/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(view.getByRole('button', { name: /Member 8/ }));
    expect(selectedHandle).toBeNull();
  });
});
