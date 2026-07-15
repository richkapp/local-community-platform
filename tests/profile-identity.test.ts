import { expect, test } from 'bun:test';
import { mergeSavedProfileWithAvatar } from '@/lib/profileDraft';
import { verifiedProfileIdentity } from '@/lib/profileIdentity';
import type { EditableProfileRecord } from '@/lib/types';

function profile(overrides: Partial<EditableProfileRecord> = {}): EditableProfileRecord {
  return {
    id: 'account-a',
    handle: 'builder',
    display_name: 'Builder',
    bio: '',
    avatar_url: null,
    avatar_path: null,
    website_url: null,
    linkedin_url: null,
    github_url: null,
    x_url: null,
    is_public: true,
    updated_at: '2026-07-14T00:00:00.000Z',
    ...overrides
  };
}

test('profile updates remain bound to the authenticated submitting account', () => {
  expect(verifiedProfileIdentity('account-a', 'account-a')).toBe('account-a');
  expect(() => verifiedProfileIdentity('account-a', 'account-b')).toThrow('Your account changed while the profile was saving.');
});

test('a late profile save cannot overwrite an avatar changed during that save', () => {
  const saved = profile({ display_name: 'Saved name', avatar_path: null, updated_at: '2026-07-14T00:00:01.000Z' });
  const current = profile({ display_name: 'Unsaved name', avatar_path: 'new-avatar.webp', updated_at: '2026-07-14T00:00:02.000Z' });

  expect(mergeSavedProfileWithAvatar(saved, current, true)).toEqual({
    ...saved,
    avatar_path: 'new-avatar.webp',
    avatar_url: null,
    updated_at: '2026-07-14T00:00:02.000Z'
  });
  expect(mergeSavedProfileWithAvatar(saved, current, false)).toBe(saved);
});