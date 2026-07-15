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

  test('native avatars are size-limited, owner-bound, and public only through opted-in profiles', async () => {
    const migration = await read('supabase/migrations/028_native_profile_avatars.sql');
    expect(migration).toContain("values ('avatars', 'avatars', true, 524288, array['image/webp'])");
    expect(migration).toContain('Existing avatars bucket has incompatible visibility or upload limits');
    expect(migration).not.toContain('on conflict (id) do update');
    expect(migration).toContain("avatar_path ~ '^[0-9a-f]{8}");
    expect(migration).toContain('create or replace function public.reserve_my_avatar_path()');
    expect(migration).toContain('create or replace function public.confirm_my_avatar_upload(p_path text)');
    expect(migration).toContain('create or replace function public.clear_my_avatar_path(p_path text)');
    expect(migration.match(/public\.is_active_member\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain('from storage.objects');
    expect(migration).toContain('objects.owner_id = auth.uid()::text');
    expect(migration).toContain('create policy "Super admins read avatar metadata"');
    expect(migration).toContain('create policy "Super admins delete member avatars"');
    expect(migration).toContain('lock table storage.objects in share row exclusive mode');
    expect(migration).toContain('Delete the member avatar before deleting the account');
    expect(migration).toContain("bucket_id = 'avatars'");
    expect(migration).toContain('select profiles.avatar_path');
    expect(migration).toContain('where profiles.id = auth.uid()');
    expect(migration).toContain('Delete the avatar object before clearing the profile');
    expect(migration).toContain('where is_public = true');
    expect(migration).toContain('profiles.is_public = true');
    expect(migration).toContain('revoke all on function public.reserve_my_avatar_path() from public, anon');
    expect(migration).toContain('grant execute on function public.clear_my_avatar_path(text) to authenticated');
    expect(migration).toContain('revoke update (avatar_url) on table public.profiles from authenticated');
    expect(migration).not.toContain('grant update (avatar_path)');
  });

  test('community voting is RPC-only, identity-private, and serialized across lifecycle changes', async () => {
    const migration = await read('supabase/migrations/029_community_voting.sql');
    const publicProjection = migration.slice(
      migration.indexOf('create or replace function public.list_public_community_votes()'),
      migration.indexOf('create or replace function public.admin_list_community_votes()')
    );
    expect(migration).toContain('revoke all on table public.community_votes from public, anon, authenticated');
    expect(migration).toContain('revoke all on table public.community_vote_options from public, anon, authenticated');
    expect(migration).toContain('revoke all on table public.community_vote_ballots from public, anon, authenticated');
    expect(migration).toContain('grant execute on function public.list_public_community_votes() to anon, authenticated');
    expect(migration).toContain('grant execute on function public.submit_community_ballot(uuid, uuid, boolean) to authenticated');
    expect(migration.match(/if not public\.is_admin\(\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(migration).toContain('if not public.is_active_member() then');
    expect(migration.match(/for update;/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain('on conflict (vote_id, user_id) do update');
    expect(migration).toContain('selected_vote.closes_at <= now()');
    expect(migration).toContain('named_ballot.is_anonymous = false');
    expect(publicProjection).toContain("jsonb_build_object('display_name', profile.display_name)");
    expect(publicProjection).not.toContain("jsonb_build_object('user_id'");
    expect(publicProjection).not.toContain('profile.email');
    expect(migration).toContain('Votes with ballots cannot be edited');
    expect(migration).toContain('Votes with ballots cannot be deleted');
  });

  test('community voting deadlines and edit locks survive waits and ballot cleanup', async () => {
    const migration = await read('supabase/migrations/030_harden_community_voting_lifecycle.sql');
    const submitFunction = migration.slice(
      migration.indexOf('create or replace function public.submit_community_ballot('),
      migration.indexOf("revoke all on function public.enforce_community_vote_lock()")
    );
    expect(migration).toContain('add column first_ballot_at timestamptz');
    expect(migration).toContain('set first_ballot_at = first_ballot.created_at');
    expect(migration).toContain('min(ballot.created_at) as created_at');
    expect(migration).toContain('create trigger protect_community_vote_after_ballot');
    expect(migration).toContain('create trigger protect_community_vote_options_after_ballot');
    expect(migration).toContain("raise exception 'Votes with ballots are permanent'");
    expect(migration).toContain("raise exception 'Options for votes with ballots are permanent'");
    expect(migration).toContain('vote.first_ballot_at is null');
    expect(migration).toContain('selected_vote.first_ballot_at is not null');
    expect(migration).toContain('selected_vote.closes_at <= clock_timestamp()');
    expect(submitFunction).toContain('set first_ballot_at = coalesce(first_ballot_at, clock_timestamp())');
    expect(submitFunction).not.toContain('selected_vote.closes_at <= now()');
  });

  test('voting visibility is private, admin-controlled, and enforced by public RPCs', async () => {
    const migration = await read('supabase/migrations/031_voting_visibility_toggle.sql');
    const publicList = migration.slice(
      migration.indexOf('create or replace function public.list_public_community_votes()'),
      migration.indexOf('create or replace function public.submit_community_ballot(')
    );
    const ballotSubmit = migration.slice(
      migration.indexOf('create or replace function public.submit_community_ballot('),
      migration.indexOf("revoke all on function public.get_voting_feature_access()")
    );
    expect(migration).toContain('create table public.community_feature_flags');
    expect(migration).toContain('alter table public.community_feature_flags enable row level security');
    expect(migration).toContain('revoke all on table public.community_feature_flags from public, anon, authenticated');
    expect(migration).toContain('grant all privileges on table public.community_feature_flags to service_role');
    expect(migration).toContain('create or replace function public.get_voting_feature_access()');
    expect(migration).toContain('create or replace function public.admin_set_voting_feature_enabled(p_enabled boolean)');
    expect(migration).toContain("if not public.is_admin() then");
    expect(migration).toContain('grant execute on function public.get_voting_feature_access() to anon, authenticated');
    expect(migration).toContain('grant execute on function public.admin_set_voting_feature_enabled(boolean) to authenticated');
    expect(publicList).toContain('and (access.is_enabled or access.viewer_is_admin)');
    expect(publicList).toContain('and access.is_enabled');
    expect(ballotSubmit).toContain('for share;');
    expect(ballotSubmit).toContain("raise exception 'Voting is unavailable'");
    expect(ballotSubmit).not.toContain('viewer_is_admin');
    expect(ballotSubmit.indexOf('for share;')).toBeLessThan(ballotSubmit.indexOf('for update;'));
  });

  test('post comments keep identities private and mutations member-only', async () => {
    const migration = await read('supabase/migrations/032_post_comments.sql');
    const publicList = migration.slice(
      migration.indexOf('create or replace function public.list_idea_comments('),
      migration.indexOf('create or replace function public.create_idea_comment(')
    );
    expect(migration).toContain('create table public.idea_comments');
    expect(migration).toContain('create table public.idea_comment_upvotes');
    expect(migration).toContain('foreign key (parent_id, idea_id)');
    expect(migration).toContain('references public.idea_comments(id, idea_id)');
    expect(migration).toContain('alter table public.idea_comments enable row level security');
    expect(migration).toContain('alter table public.idea_comment_upvotes enable row level security');
    expect(migration).toContain('revoke all on table public.idea_comments from public, anon, authenticated');
    expect(migration).toContain('revoke all on table public.idea_comment_upvotes from public, anon, authenticated');
    expect(migration).toContain('grant all privileges on table public.idea_comments to service_role');
    expect(migration).toContain('grant all privileges on table public.idea_comment_upvotes to service_role');
    expect(migration.match(/not public\.is_active_member\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration.match(/for share;/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain('for share of comment, idea;');
    expect(migration).toContain("raise exception 'reply target is not part of this post'");
    expect(migration).toContain("'idea-comment-upvote:' || viewer_id::text");
    expect(migration).toContain('grant execute on function public.list_idea_comments(uuid) to anon, authenticated');
    expect(migration).toContain('grant execute on function public.create_idea_comment(uuid, uuid, text, boolean) to authenticated');
    expect(migration).toContain('grant execute on function public.toggle_idea_comment_upvote(uuid) to authenticated');
    expect(publicList).toContain('profile.is_public = true');
    expect(publicList).toContain('(comment.is_anonymous or profile.id is null) as is_anonymous');
    expect(publicList).not.toContain('comment.author_id,');
    expect(publicList).not.toContain('upvote.user_id,');
  });

  test('post participation settings are super-admin controlled and enforced server-side', async () => {
    const migration = await read('supabase/migrations/033_post_participation_controls.sql');
    const reviewFix = await read('supabase/migrations/034_post_participation_review_fixes.sql');
    for (const key of [
      'allow_anonymous_posts',
      'allow_signed_out_posts',
      'allow_anonymous_comments',
      'allow_anonymous_replies'
    ]) expect(migration).toContain(key);
    expect(migration).toContain('if not public.is_super_admin() then');
    expect(migration).toContain("raise exception 'anonymous posts are disabled'");
    expect(migration).toContain("raise exception 'logged-out posts are disabled'");
    expect(migration).toContain("when target_parent_id is null then 'allow_anonymous_comments'");
    expect(migration).toContain("else 'allow_anonymous_replies'");
    expect(migration).toContain('on delete set null (parent_id)');
    expect(migration).toContain('on delete set null;');
    expect(migration).toContain('for share;');
    expect(migration).toContain('grant execute on function public.get_post_participation_settings() to anon, authenticated');
    expect(migration).toContain('grant execute on function public.super_admin_set_post_participation_setting(text, boolean) to authenticated');
    expect(migration).toContain('create or replace function public.post_member_anonymous_idea(');
    expect(migration).toContain('grant execute on function public.post_member_anonymous_idea(text, text, text, text, text, text[]) to authenticated');
    expect(migration).toContain('if viewer_id is null or public.is_anonymous_user() then');
    expect(reviewFix).toContain("and profile.role = 'super_admin'");
    expect(reviewFix).toContain('and profile.suspended_at is null');
    expect(reviewFix).toContain('for share;');
    expect(reviewFix).toContain('comment.author_id is not null and profile.id is null');
    expect(reviewFix).toContain("raise exception 'Super-admin access required'");
  });

  test('invite delivery is reserved, delivered, claimed, or failed explicitly', async () => {
    const baseline = await read('supabase/migrations/006_delivery_readiness.sql');
    const rolling = await read('supabase/migrations/023_rolling_member_invites.sql');
    const fn = await read('supabase/functions/request-invite-magic-link/index.ts');
    expect(baseline).toContain('reserve_invite_for_email');
    expect(rolling).toContain('mark_invite_delivery');
    expect(rolling).toContain('claim_my_pending_invite');
    expect(rolling).toContain('fail_invite_redemption');
    expect(fn).toContain('/rest/v1/rpc/reserve_invite_for_email');
    expect(fn).toContain('/rest/v1/rpc/mark_invite_delivery');
    expect(fn).toContain('/rest/v1/rpc/fail_invite_redemption');
    expect(fn).toContain("payload.context === 'signin'");
    expect(fn).toContain('create_user: false');
    expect(fn).not.toContain('IDEA_SIGNUP_INVITE_CODE');
    expect(fn).toContain('payload.emailConsent !== true');
    expect(fn).toContain('You must agree to receive the one-time magic-link email.');
    expect(fn).not.toContain("'Access-Control-Allow-Origin': '*'");
  });

  test('public post reads hide visitor identifiers and invite retries check capacity before delivery', async () => {
    const migration = await read('supabase/migrations/018_public_data_and_invite_capacity.sql');
    const aggregatedFeed = await read('supabase/migrations/035_aggregated_post_feed.sql');
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
    expect(ideas).toContain("rpc('list_post_feed'");
    expect(feed).toContain('listPostFeed(initialView)');
    expect(aggregatedFeed).toContain("security definer");
    expect(aggregatedFeed).not.toContain("'author_id'");
    expect(aggregatedFeed).not.toContain("'anonymous_visitor_id'");
    expect(detail).not.toContain(".select('*')");
  });

  test('the aggregated post feed is one privacy-safe, least-privilege request', async () => {
    const migration = await read('supabase/migrations/035_aggregated_post_feed.sql');
    expect(migration).toContain('create or replace function public.list_post_feed(p_view text');
    expect(migration).toContain("p_view not in ('all', 'mine', 'bookmarks')");
    expect(migration).toContain("idea.status <> 'hidden' or viewer_is_admin");
    expect(migration).toContain('author.is_public = true');
    expect(migration).toContain('author.suspended_at is null');
    expect(migration).toContain("'viewer_has_bookmarked'");
    expect(migration).toContain("'viewer_has_voted'");
    expect(migration).toContain("'comment_count'");
    expect(migration).toContain("'upvote_count'");
    expect(migration).toContain('revoke all on function public.list_post_feed(text) from public');
    expect(migration).toContain('grant execute on function public.list_post_feed(text) to anon, authenticated, service_role');
  });

  test('the aggregated post feed preserves member and anonymous upvote totals', async () => {
    const correction = await read('supabase/migrations/036_aggregated_post_feed_vote_counts.sql');
    expect(correction).toContain('create or replace function public.list_post_feed(p_view text');
    expect(correction).toContain('public.idea_vote_counts as vote_count');
    expect(correction).toContain("'upvote_count'");
    expect(correction).toContain('grant execute on function public.list_post_feed(text) to anon, authenticated, service_role');
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

  test('super-admin member controls are isolated, self-protecting, and suspend mutations immediately', async () => {
    const enumMigration = await read('supabase/migrations/020_super_admin_role.sql');
    const controls = await read('supabase/migrations/021_super_admin_member_controls.sql');
    expect(enumMigration).toContain("add value if not exists 'super_admin'");
    expect(controls).toContain("profiles.role in ('admin', 'super_admin')");
    expect(controls).toContain("profiles.role = 'super_admin'");
    expect(controls).toContain('profiles.suspended_at is null');
    expect(controls).toContain('create or replace function public.is_active_member()');
    expect(controls).toContain('create or replace function public.is_super_admin()');
    expect(controls).toContain('create or replace function public.super_admin_set_member_role');
    expect(controls).toContain('create or replace function public.super_admin_set_member_suspension');
    expect(controls).toContain('create or replace function public.super_admin_delete_member');
    expect(controls).toContain('if not public.is_super_admin()');
    expect(controls).toContain('target_user_id = current_user_id');
    expect(controls).toContain("current_target_role = 'super_admin'");
    expect(controls).toContain("target_role::text not in ('member', 'admin')");
    expect(controls).toContain('set banned_until = case when should_suspend');
    expect(controls).toContain('delete from auth.users where id = target_user_id');
    expect(controls.match(/public\.is_active_member\(\)/g)?.length).toBeGreaterThanOrEqual(10);
    expect(controls).toContain("raise exception 'account suspended'");
    expect(controls).toContain('grant execute on function public.super_admin_delete_member(uuid) to authenticated');
    const avatarControls = await read('supabase/migrations/028_native_profile_avatars.sql');
    expect(avatarControls).toContain('create or replace function public.super_admin_delete_member(target_user_id uuid)');
    expect(avatarControls).toContain('objects.name = current_avatar_path');
    expect(controls).not.toContain('richard@richkapp.com');
  });

  test('RIP categories and tags are constrained across direct and anonymous writes', async () => {
    const migration = await read('supabase/migrations/016_rip_categories_tags.sql');
    const dynamicTags = await read('supabase/migrations/026_member_created_post_tags.sql');
    const tagHardening = await read('supabase/migrations/027_post_tag_hardening.sql');
    const edge = await read('supabase/functions/anonymous-ideas/index.ts');
    expect(migration).toContain("category in ('idea', 'resource', 'perspective')");
    expect(migration).toContain("'community-challenge'");
    expect(migration).toContain('grant update (title, body, category, tags, status)');
    expect(migration).toContain('p_category text');
    expect(migration).toContain('p_tags text[]');
    expect(edge).toContain('p_category: payload.category');
    expect(edge).toContain('p_tags: payload.tags');
    expect(dynamicTags).toContain('create table public.post_tags');
    expect(dynamicTags).toContain('create unique index post_tags_label_lower_idx');
    expect(dynamicTags).toContain('revoke all on table public.post_tags from public, anon, authenticated');
    expect(dynamicTags).toContain('create or replace function public.list_post_tags()');
    expect(dynamicTags).toContain('create or replace function public.create_post_tag(p_label text)');
    expect(dynamicTags).toContain('pg_advisory_xact_lock');
    expect(dynamicTags).toContain('custom tag lifetime limit reached');
    expect(dynamicTags).toContain('viewer_custom_tag_limit');
    expect(dynamicTags).toContain('order by usage_count desc');
    expect(dynamicTags).toContain('drop constraint if exists ideas_tags_allowed');
    expect(dynamicTags).toContain('create trigger validate_idea_tags_before_write');
    expect(dynamicTags).toContain('cardinality(new.tags) > 6');
    expect(dynamicTags).toContain('from public.post_tags');
    expect(dynamicTags).toContain('grant execute on function public.list_post_tags() to anon, authenticated');
    expect(dynamicTags).toContain('grant execute on function public.create_post_tag(text) to authenticated');
    expect(dynamicTags).not.toContain('grant select on table public.post_tags to authenticated');
    expect(tagHardening).toContain("'member-admin:' || viewer_id::text");
    expect(tagHardening).toContain('if not public.is_active_member() then');
    expect(tagHardening).toContain('cardinality(public.ideas.tags) <> cardinality(normalized.tags)');
    expect(tagHardening).toContain('array_agg(tag_positions.tag order by tag_positions.first_position)');
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

  test('rolling member invitations replenish atomically after confirmed account creation', async () => {
    const migration = await read('supabase/migrations/023_rolling_member_invites.sql');
    const edge = await read('supabase/functions/request-invite-magic-link/index.ts');
    expect(migration).toContain("'member_single'");
    expect(migration).toContain("'admin_campaign'");
    expect(migration).toContain('max_uses = 1');
    expect(migration).toContain('max_uses between 1 and 50');
    expect(migration).toContain("set invite_kind = 'admin_campaign'");
    expect(migration).toContain('with legacy_campaign_owner as');
    expect(migration).toContain("i.code not in ('braga-whatsapp', 'local-development-only')");
    expect(migration).toContain("where invite_kind = 'system'");
    expect(migration).toContain('active invite(s) that cannot be classified safely');
    expect(migration).toContain("code in ('braga-whatsapp', 'local-development-only')");
    expect(migration).toContain('create or replace function public.replenish_member_invite_pool');
    expect(migration).toContain('while active_invite_count < 5 loop');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('create or replace function public.handle_member_profile_invites');
    expect(migration).toContain('after insert on public.profiles');
    expect(migration).toContain('and not coalesce(u.is_anonymous, false)');
    expect(migration).toContain('perform public.replenish_member_invite_pool(member_record.id)');
    expect(migration).toContain('create or replace function public.get_my_member_invites');
    expect(migration).toContain('create or replace function public.claim_my_pending_invite');
    expect(migration).toContain("current_flow is distinct from 'rolling_v1'");
    expect(migration).toContain("current_created_at < now() - interval '5 minutes'");
    expect(migration).toContain('after update of email_confirmed_at on auth.users');
    expect(migration).toContain("delivery_status = 'delivered'");
    expect(migration).toContain("selected_invite.invite_kind = 'member_single' and selected_invite.uses_count >= 1");
    expect(migration).toContain("existing_redemption.claim_expires_at > now()");
    expect(migration).toContain('u.created_at >= selected_redemption.requested_at');
    expect(migration).toContain("if not claimed and invite_flow is distinct from 'rolling_v1' then");
    expect(migration).toContain("r.delivery_status = 'reserved'");
    expect(migration).toContain("if not claimed then");
    expect(migration).toContain("raise exception 'invite confirmation is not pending'");
    expect(migration).toContain('uses_count = uses_count + 1');
    expect(migration).toContain('perform public.replenish_member_invite_pool(selected_invite.created_by)');
    expect(migration).toContain('profiles.suspended_at is null');
    expect(migration).toContain('revoke insert, update, delete on table public.invites from authenticated');
    expect(migration).toContain('revoke insert, update, delete on table public.invite_redemptions from authenticated');
    expect(migration).toContain('create or replace function public.complete_invite_redemption');
    expect(migration).toContain('create or replace function public.prepare_existing_invite_user');
    expect(migration).toContain("if selected_redemption.delivery_status = 'completed' then");
    expect(migration).toContain('expected_user_id = target_user_id');
    expect(migration).toContain('perform public.mark_invite_delivery(target_redemption_id, true)');
    expect(migration).toContain('rebound_user := public.prepare_existing_invite_user(target_redemption_id)');
    expect(migration).toContain('u.created_at < r.requested_at');
    expect(migration).not.toContain('drop function if exists public.complete_invite_redemption');
    expect(edge).toContain("invite_flow: 'rolling_v1'");
    expect(edge.indexOf('await markInviteDelivery(supabaseUrl, serviceRoleKey, reserved.redemption_id, true)')).toBeLessThan(edge.indexOf('const newAccountCreated = await sendInvitedLink'));
    expect(edge).toContain("'/rest/v1/rpc/mark_invite_delivery'");
    expect(edge).toContain("'/rest/v1/rpc/prepare_existing_invite_user'");
    expect(edge).toContain('const existingUser = [400, 422].includes');
    expect(edge).toContain('keeping the pending claim until expiry');
    expect(edge).not.toContain("'/rest/v1/rpc/complete_invite_redemption'");
  });

  test('admin invitation campaigns enforce a database-backed 1–50 use limit', async () => {
    const migration = await read('supabase/migrations/023_rolling_member_invites.sql');
    const admin = await read('src/lib/admin.ts');
    expect(migration).toContain('create or replace function public.create_admin_invite');
    expect(migration).toContain('requested_max_uses is null or requested_max_uses not between 1 and 50');
    expect(migration).toContain("invite_kind = 'admin_campaign' and max_uses is not null and max_uses between 1 and 50");
    expect(migration).toContain('create or replace function public.revoke_admin_invite');
    expect(migration).toContain('create or replace function public.list_member_invites_for_admin');
    expect(migration).toContain("raise exception 'admin access required'");
    expect(migration).toContain('grant execute on function public.create_admin_invite');
    expect(admin).toContain("rpc('create_admin_invite'");
    expect(admin).toContain("rpc('revoke_admin_invite'");
    expect(admin).toContain("rpc('list_member_invites_for_admin'");
  });

  test('post bookmarks are private, unique, and limited to active signed-in members', async () => {
    const migration = await read('supabase/migrations/024_post_bookmarks.sql');
    const queryPaths = await read('supabase/migrations/025_post_library_query_paths.sql');
    expect(migration).toContain('create table public.idea_bookmarks');
    expect(migration).toContain('primary key (user_id, idea_id)');
    expect(migration).toContain('references auth.users(id) on delete cascade');
    expect(migration).toContain('references public.ideas(id) on delete cascade');
    expect(migration).toContain('alter table public.idea_bookmarks enable row level security');
    expect(migration).toContain('revoke all on table public.idea_bookmarks from public, anon, authenticated');
    expect(migration).toContain('create or replace function public.get_my_post_relationships');
    expect(migration).toContain('create or replace function public.set_idea_bookmark');
    expect(migration).toContain('create or replace function public.is_active_member()');
    expect(migration).toContain('create or replace function public.is_admin()');
    expect(migration).toContain('create or replace function public.is_super_admin()');
    expect(migration).toContain('select not public.is_anonymous_user()');
    expect(migration).toContain('create or replace function public.current_member_role()');
    expect(migration).toContain('public.is_active_member()');
    expect(migration).toContain("auth.jwt() ->> 'is_anonymous'");
    expect(migration).toContain("raise exception 'active member account required'");
    expect(migration).toContain("target.status <> 'hidden' or public.is_admin()");
    expect(migration).toContain('grant execute on function public.get_my_post_relationships(uuid) to authenticated');
    expect(migration).toContain('on conflict (user_id, idea_id) do nothing');
    expect(migration).toContain('grant execute on function public.set_idea_bookmark(uuid, boolean) to authenticated');
    expect(migration).toContain('and public.is_active_member()');
    expect(migration).not.toContain('grant select on table public.idea_bookmarks to authenticated');
    expect(queryPaths).toContain('create index if not exists ideas_author_id_idx');
    expect(queryPaths).toContain('on public.ideas (author_id)');
    expect(queryPaths).toContain('where author_id is not null');
    expect(queryPaths).toContain('create or replace function public.set_idea_bookmark');
    expect(queryPaths).toContain('for share');
    expect(queryPaths).not.toContain('for no key update');
  });

  test('bug reports use a rate-limited Edge Function and admin-only data access', async () => {
    const migration = await read('supabase/migrations/019_bug_reports.sql');
    const notifications = await read('supabase/migrations/022_bug_report_notifications.sql');
    const edge = await read('supabase/functions/bug-reports/index.ts');
    const config = await read('supabase/config.toml');
    expect(migration).toContain('create table public.bug_reports');
    expect(migration).toContain('alter table public.bug_reports enable row level security');
    expect(migration).toContain('create or replace function public.submit_bug_report');
    expect(migration).toContain('char_length(normalized_description) between 20 and 5000');
    expect(migration).toContain('p_website');
    expect(migration).toContain("created_at >= now() - interval '1 day'");
    expect(migration).toContain("created_at >= now() - interval '1 hour'");
    expect(migration.match(/pg_advisory_xact_lock/g)).toHaveLength(2);
    expect(migration).toContain('revoke all on table public.bug_reports from public, anon, authenticated');
    expect(migration).toContain('grant all privileges on table public.bug_reports to service_role');
    expect(migration).toContain('grant execute on function public.submit_bug_report');
    expect(migration).toContain('to service_role');
    expect(migration).toContain('Admins read bug reports');
    expect(migration).toContain('Admins update bug report status');
    expect(migration).toContain('grant update (status) on table public.bug_reports to authenticated');
    expect(migration).not.toContain('grant insert on table public.bug_reports to anon');
    expect(edge).toContain("'/rest/v1/rpc/submit_bug_report'");
    expect(edge).toContain("request.headers.get('x-forwarded-for')");
    expect(edge).toContain('if (!origin || !allowed.has(origin)) return null');
    expect(edge).toContain("name: 'HMAC'");
    expect(edge).toContain("crypto.subtle.sign('HMAC'");
    expect(edge).toContain('rawBody.length > 16_000');
    expect(edge).toContain("typeof parsed !== 'object' || Array.isArray(parsed)");
    expect(edge).toContain('allowedOrigins.has(parsed.origin)');
    expect(edge).toContain('not part of this community site');
    expect(notifications).toContain('create extension if not exists pg_net');
    expect(notifications).toContain('before insert on public.bug_reports');
    expect(notifications).toContain("url := 'https://api.resend.com/emails'");
    expect(notifications).toContain("'Idempotency-Key', 'bug-report/' || new.id");
    expect(notifications).toContain("where name = 'RESEND_API_KEY'");
    expect(notifications).toContain('exception\n  when others then');
    expect(notifications).toContain('revoke all on function public.enqueue_bug_report_notification() from public, anon, authenticated');
    expect(edge).not.toContain('RESEND_API_KEY');
    expect(edge).not.toContain("'Access-Control-Allow-Origin': '*'");
    expect(config).toContain('[functions.bug-reports]');
    expect(config).toContain('verify_jwt = false');
  });
});
