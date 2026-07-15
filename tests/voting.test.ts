import { describe, expect, test } from 'bun:test';
import { calculateVotePercentage, canManageCommunityVotes, canViewCommunityVoting, normalizeCommunityVoteInput, shouldShowVotingLink } from '@/lib/voting';

const validInput = {
  title: 'Choose the next build night topic',
  description: 'Pick the workshop topic you want the community to run next.',
  closesAt: '2099-07-20T18:00:00.000Z',
  options: ['Agents', 'Local models']
};

describe('community vote input', () => {
  test('trims valid values and preserves option order', () => {
    expect(normalizeCommunityVoteInput({
      ...validInput,
      title: `  ${validInput.title}  `,
      description: ` ${validInput.description} `,
      options: [' Agents ', ' Local models ']
    })).toEqual(validInput);
  });

  test('requires 2 to 10 options', () => {
    expect(() => normalizeCommunityVoteInput({ ...validInput, options: ['Only one'] })).toThrow('between 2 and 10');
    expect(() => normalizeCommunityVoteInput({
      ...validInput,
      options: Array.from({ length: 11 }, (_, index) => `Option ${index + 1}`)
    })).toThrow('between 2 and 10');
  });

  test('rejects blank, oversized, and case-insensitive duplicate options', () => {
    expect(() => normalizeCommunityVoteInput({ ...validInput, options: ['Agents', '   '] })).toThrow('between 1 and 180');
    expect(() => normalizeCommunityVoteInput({ ...validInput, options: ['Agents', 'x'.repeat(181)] })).toThrow('between 1 and 180');
    expect(() => normalizeCommunityVoteInput({ ...validInput, options: ['Agents', ' agents '] })).toThrow('distinct');
  });

  test('requires useful title, description, and a future deadline', () => {
    expect(() => normalizeCommunityVoteInput({ ...validInput, title: 'No' })).toThrow('titles');
    expect(() => normalizeCommunityVoteInput({ ...validInput, description: 'Too short' })).toThrow('descriptions');
    expect(() => normalizeCommunityVoteInput({ ...validInput, closesAt: 'not-a-date' })).toThrow('future');
    expect(() => normalizeCommunityVoteInput({ ...validInput, closesAt: '2020-01-01T00:00:00.000Z' })).toThrow('future');
  });
});

describe('community vote percentages', () => {
  test('returns zero without turnout', () => {
    expect(calculateVotePercentage(0, 0)).toBe(0);
    expect(calculateVotePercentage(2, 0)).toBe(0);
  });

  test('rounds option share to the nearest whole percent', () => {
    expect(calculateVotePercentage(1, 3)).toBe(33);
    expect(calculateVotePercentage(2, 3)).toBe(67);
    expect(calculateVotePercentage(3, 3)).toBe(100);
  });
});

describe('community vote management authorization', () => {
  test('allows only signed-in admins and super admins to create polls', () => {
    expect(canManageCommunityVotes(null, null)).toBe(false);
    expect(canManageCommunityVotes({ is_anonymous: true }, 'admin')).toBe(false);
    expect(canManageCommunityVotes({}, 'member')).toBe(false);
    expect(canManageCommunityVotes({}, 'admin')).toBe(true);
    expect(canManageCommunityVotes({}, 'super_admin')).toBe(true);
  });
});

describe('community vote visibility decisions', () => {
  test('keeps the page private while preserving direct admin access', () => {
    expect(canViewCommunityVoting(null)).toBe(false);
    expect(canViewCommunityVoting({ is_enabled: false, viewer_is_admin: false })).toBe(false);
    expect(canViewCommunityVoting({ is_enabled: false, viewer_is_admin: true })).toBe(true);
    expect(canViewCommunityVoting({ is_enabled: true, viewer_is_admin: false })).toBe(true);
  });

  test('hides navigation links for everyone whenever public voting is off', () => {
    expect(shouldShowVotingLink({ is_enabled: false, viewer_is_admin: false })).toBe(false);
    expect(shouldShowVotingLink({ is_enabled: false, viewer_is_admin: true })).toBe(false);
    expect(shouldShowVotingLink({ is_enabled: true, viewer_is_admin: false })).toBe(true);
  });
});
