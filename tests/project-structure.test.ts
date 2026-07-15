import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { files } from './helpers/files';

const required = [
  'AGENTS.md',
  'CHANGELOG.md',
  'README.md',
  'scripts/verify-build-output.mjs',
  'supabase/migrations/001_initial_schema.sql',
  'supabase/migrations/002_rls_policies.sql',
  'supabase/functions/request-invite-magic-link/index.ts',
  'src/pages/join/[code].astro',
  'src/pages/posts.astro',
  'src/pages/posts/[slug].astro',
  'src/pages/events.astro',
  'src/pages/admin/index.astro'
];

test('required project files exist', () => {
  for (const file of required) {
    expect(existsSync(file), `${file} should exist`).toBe(true);
  }
});

test('runtime community identity stays configurable', () => {
  const violations = ['src', 'supabase/functions']
    .flatMap((directory) => files(directory, (path) => /\.(?:astro|[jt]sx?)$/.test(path)))
    .filter((path) => path !== 'src/config/community.ts')
    .flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return ['Braga AI Builders', 'braga-ai-builders', 'braga-brain-network', 'braga:', 'Europe/Lisbon', 'Lisbon time']
        .filter((needle) => source.includes(needle))
        .map((needle) => ({ path, needle }));
    });

  expect(violations).toEqual([]);
});

test('backup guidance covers every promoted persistent boundary', () => {
  const guide = readFileSync('docs/backup-restore.md', 'utf8');
  for (const name of [
    'idea_bookmarks',
    'post_tags',
    'idea_comments',
    'idea_comment_upvotes',
    'community_votes',
    'community_vote_options',
    'community_vote_ballots',
    'community_feature_flags',
    'avatars'
  ]) expect(guide).toContain(name);
});

test('deployment guide pins the immutable migration 023 artifact', () => {
  const migration = readFileSync('supabase/migrations/023_rolling_member_invites.sql');
  const digest = createHash('sha256').update(migration).digest('hex');
  expect(readFileSync('docs/deployment.md', 'utf8')).toContain(`Expected SHA-256: \`${digest}\``);
});

function sourceLineCount(path: string): number {
  const source = readFileSync(path, 'utf8');
  if (!source) return 0;
  return source.split('\n').length - Number(source.endsWith('\n'));
}

test('page and component modules stay within the 700-line refactor boundary', () => {
  const oversized = ['src/pages', 'src/components']
    .flatMap((directory) => files(directory, (path) => /\.(?:astro|[jt]sx?)$/.test(path)))
    .map((path) => ({ path, lines: sourceLineCount(path) }))
    .filter(({ lines }) => lines > 700);

  expect(oversized).toEqual([]);
});
