import { describe, expect, test } from 'bun:test';
import { normalizeRipTags, ripTagLabel } from '../src/lib/rips';

describe('dynamic post tags', () => {
  test('keeps valid registered-style slugs, removes duplicates, and caps posts at six tags', () => {
    expect(normalizeRipTags([
      'next-event',
      'ai-agents',
      'ai-agents',
      'aprendizagem-ação',
      'news',
      'learning',
      'member-project',
      'seventh-tag',
      'not a slug',
    ])).toEqual([
      'next-event',
      'ai-agents',
      'aprendizagem-ação',
      'news',
      'learning',
      'member-project',
    ]);
  });

  test('falls back to a readable label before the catalog has loaded', () => {
    expect(ripTagLabel('ai-agents')).toBe('Ai Agents');
  });
});
