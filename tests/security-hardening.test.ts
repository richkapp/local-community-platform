import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

describe('delivery security contracts', () => {
  test('active UI and seed never expose the retired shared invite', async () => {
    const paths = [
      'src/pages/index.astro',
      'src/pages/join/[code].astro',
      'src/components/Nav.astro',
      'supabase/seed.sql'
    ];
    for (const path of paths) expect(await read(path)).not.toContain('braga-whatsapp');
  });

  test('auth redirects trust exact hosts instead of a Vercel wildcard', async () => {
    const config = await read('supabase/config.toml');
    expect(config).not.toContain('https://*.vercel.app');
    expect(config).toContain('https://braga-ai-builders.vercel.app/auth/confirm');
  });

  test('member profiles are opt-in and anonymous sessions stay out of member-only features', async () => {
    const schema = await read('supabase/migrations/001_initial_schema.sql');
    const privacy = await read('supabase/migrations/009_private_profiles_by_default.sql');
    const anonymous = await read('supabase/migrations/010_anonymous_ideas.sql');
    const config = await read('supabase/config.toml');
    const edge = await read('supabase/functions/anonymous-ideas/index.ts');
    const migration = await read('supabase/migrations/011_anonymous_ideas_via_edge.sql');
    expect(schema).toContain('is_public boolean not null default false');
    expect(privacy).toContain('alter column is_public set default false');
    expect(anonymous).toContain("auth.jwt() ->> 'is_anonymous'");
    expect(migration).toContain('post_anonymous_idea');
    expect(migration).toContain('toggle_anonymous_idea_vote');
    expect(edge).toContain("action: 'create'");
    expect(config).toContain('[functions.anonymous-ideas]');
  });

  test('member profile and registration mutations are column/RPC scoped', async () => {
    const sql = await read('supabase/migrations/006_delivery_readiness.sql');
    expect(sql).toContain('revoke update on table public.profiles from authenticated');
    expect(sql).toContain('revoke insert, update on table public.event_registrations from authenticated');
    expect(sql).toContain('create function public.register_for_event');
    expect(sql).toContain('create or replace function public.cancel_event_registration');
    expect(sql).toContain("status = 'open'");
  });

  test('invite delivery is reserved, completed, or failed explicitly', async () => {
    const sql = await read('supabase/migrations/006_delivery_readiness.sql');
    const fn = await read('supabase/functions/request-invite-magic-link/index.ts');
    expect(sql).toContain('reserve_invite_for_email');
    expect(sql).toContain('complete_invite_redemption');
    expect(sql).toContain('fail_invite_redemption');
    expect(fn).toContain('/rest/v1/rpc/reserve_invite_for_email');
    expect(fn).toContain('/rest/v1/rpc/complete_invite_redemption');
    expect(fn).toContain('/rest/v1/rpc/fail_invite_redemption');
    expect(fn).toContain("payload.context === 'ideas'");
    expect(fn).toContain('IDEA_SIGNUP_INVITE_CODE');
    expect(fn).toContain('payload.emailConsent !== true');
    expect(fn).toContain('You must agree to receive the one-time magic-link email.');
    expect(fn).not.toContain("'Access-Control-Allow-Origin': '*'");
  });

  test('public post reads hide visitor identifiers and invite retries check capacity before delivery', async () => {
    const migration = await read('supabase/migrations/018_public_data_and_invite_capacity.sql');
    const ideas = await read('src/lib/ideas.ts');
    const feed = await read('src/components/ideas/IdeaFeed.tsx');
    const detail = await read('src/components/ideas/IdeaDetail.tsx');
    const publicGrant = migration.slice(migration.indexOf('grant select ('), migration.indexOf(') on table public.ideas'));
    expect(migration).toContain('revoke select on table public.ideas from anon, authenticated');
    expect(publicGrant).not.toContain('anonymous_visitor_id');
    expect(publicGrant).not.toContain('author_id');
    expect(migration).toContain('create or replace function public.list_visible_ideas()');
    expect(migration).toContain('viewer_can_edit boolean');
    expect(migration).toContain('revoke all on table public.event_registration_counts from anon, authenticated');
    expect(migration).toContain('id <> existing_redemption.id');
    expect(migration.indexOf("raise exception 'invite use limit reached'"))
      .toBeLessThan(migration.indexOf('update public.invite_redemptions'));
    expect(ideas).toContain('PUBLIC_IDEA_COLUMNS');
    expect(ideas).not.toContain("PUBLIC_IDEA_COLUMNS = 'id, slug, title, body, month_key, status, author_id");
    expect(feed).not.toContain("from('ideas').select('*')");
    expect(feed).toContain("rpc('list_visible_ideas')");
    expect(detail).not.toContain(".select('*')");
  });

  test('idea authors can edit content while only admins can change lifecycle state', async () => {
    const migration = await read('supabase/migrations/014_idea_edit_permissions.sql');
    expect(migration).toContain('grant update (title, body, status)');
    expect(migration).toContain("status = 'open'");
    expect(migration).toContain('author_id = auth.uid()');
  });

  test('the full member database is exposed only through an admin-guarded RPC', async () => {
    const migration = await read('supabase/migrations/015_admin_member_directory.sql');
    expect(migration).toContain('if not public.is_admin()');
    expect(migration).toContain('join auth.users');
    expect(migration).toContain('revoke all on function public.admin_list_members() from public, anon');
    expect(migration).toContain('grant execute on function public.admin_list_members() to authenticated');
  });

  test('RIP categories and tags are constrained across direct and anonymous writes', async () => {
    const migration = await read('supabase/migrations/016_rip_categories_tags.sql');
    const edge = await read('supabase/functions/anonymous-ideas/index.ts');
    expect(migration).toContain("category in ('idea', 'resource', 'perspective')");
    expect(migration).toContain("'community-challenge'");
    expect(migration).toContain('grant update (title, body, category, tags, status)');
    expect(migration).toContain('p_category text');
    expect(migration).toContain('p_tags text[]');
    expect(edge).toContain('p_category: payload.category');
    expect(edge).toContain('p_tags: payload.tags');
  });

  test('post author hover cards expose only already-public profile fields', async () => {
    const migration = await read('supabase/migrations/017_post_author_hover_cards.sql');
    expect(migration).toContain('profiles.is_public = true');
    expect(migration).toContain('profiles.bio');
    expect(migration).toContain('profiles.website_url');
    expect(migration).toContain('profiles.linkedin_url');
    expect(migration).toContain('profiles.github_url');
    expect(migration).toContain('profiles.x_url');
    expect(migration).not.toContain('auth.users');
  });
});
