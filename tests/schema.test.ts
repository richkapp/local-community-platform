import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const schema = readFileSync('supabase/migrations/001_initial_schema.sql', 'utf8');
const rls = readFileSync('supabase/migrations/002_rls_policies.sql', 'utf8');

test('core community tables are defined', () => {
  for (const table of ['profiles', 'invites', 'invite_redemptions', 'ideas', 'idea_votes', 'events', 'event_registrations']) {
    expect(schema).toContain(`create table public.${table}`);
  }
});

test('one upvote per member per idea is enforced', () => {
  expect(schema).toContain('primary key (idea_id, user_id)');
});

test('RLS is enabled on user-owned tables', () => {
  for (const table of ['profiles', 'ideas', 'idea_votes', 'events', 'event_registrations']) {
    expect(rls).toContain(`alter table public.${table} enable row level security`);
  }
});

test('service-role-only tables are admin protected by policy', () => {
  expect(rls).toContain('Admins manage invites');
  expect(rls).toContain('Admins read invite redemptions');
});
