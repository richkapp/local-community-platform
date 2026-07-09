import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

const required = [
  'AGENTS.md',
  'CHANGELOG.md',
  'README.md',
  'supabase/migrations/001_initial_schema.sql',
  'supabase/migrations/002_rls_policies.sql',
  'supabase/functions/request-invite-magic-link/index.ts',
  'src/pages/join/[code].astro',
  'src/pages/ideas.astro',
  'src/pages/events.astro',
  'src/pages/admin/index.astro'
];

test('required project files exist', () => {
  for (const file of required) {
    expect(existsSync(file), `${file} should exist`).toBe(true);
  }
});
