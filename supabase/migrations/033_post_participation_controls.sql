begin;

insert into public.community_feature_flags (feature_key, is_enabled)
values
  ('allow_anonymous_posts', true),
  ('allow_signed_out_posts', true),
  ('allow_anonymous_comments', true),
  ('allow_anonymous_replies', true)
on conflict (feature_key) do nothing;

create or replace function public.get_post_participation_settings()
returns table (
  allow_anonymous_posts boolean,
  allow_signed_out_posts boolean,
  allow_anonymous_comments boolean,
  allow_anonymous_replies boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select flag.is_enabled from public.community_feature_flags flag where flag.feature_key = 'allow_anonymous_posts'), false),
    coalesce((select flag.is_enabled from public.community_feature_flags flag where flag.feature_key = 'allow_signed_out_posts'), false),
    coalesce((select flag.is_enabled from public.community_feature_flags flag where flag.feature_key = 'allow_anonymous_comments'), false),
    coalesce((select flag.is_enabled from public.community_feature_flags flag where flag.feature_key = 'allow_anonymous_replies'), false);
$$;

create or replace function public.super_admin_set_post_participation_setting(
  p_feature_key text,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super-admin access required' using errcode = '42501';
  end if;
  if p_feature_key is null or p_feature_key not in (
    'allow_anonymous_posts',
    'allow_signed_out_posts',
    'allow_anonymous_comments',
    'allow_anonymous_replies'
  ) then
    raise exception 'Unknown post participation setting' using errcode = '22023';
  end if;
  if p_enabled is null then
    raise exception 'Post participation setting must be on or off' using errcode = '22023';
  end if;

  insert into public.community_feature_flags (feature_key, is_enabled, updated_by)
  values (p_feature_key, p_enabled, auth.uid())
  on conflict (feature_key) do update
  set is_enabled = excluded.is_enabled,
      updated_at = now(),
      updated_by = excluded.updated_by;

  return p_enabled;
end;
$$;

-- Preserve the conversation when an account or parent comment is removed.
alter table public.idea_comments
  drop constraint idea_comments_author_id_fkey,
  alter column author_id drop not null,
  add constraint idea_comments_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete set null;

alter table public.idea_comments
  drop constraint idea_comments_parent_id_idea_id_fkey,
  add constraint idea_comments_parent_id_idea_id_fkey
    foreign key (parent_id, idea_id)
    references public.idea_comments(id, idea_id)
    on delete set null (parent_id);

create or replace function public.post_anonymous_idea(
  p_visitor_id uuid,
  p_title text,
  p_body text,
  p_slug text,
  p_month_key text,
  p_category text,
  p_tags text[],
  p_request_ip_hash text
)
returns public.ideas
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_idea public.ideas%rowtype;
  clean_category text := lower(btrim(coalesce(p_category, '')));
  clean_tags text[] := coalesce(p_tags, '{}');
  anonymous_posts_enabled boolean := false;
  signed_out_posts_enabled boolean := false;
begin
  if p_visitor_id is null or p_request_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid visitor session';
  end if;

  select flag.is_enabled into anonymous_posts_enabled
  from public.community_feature_flags flag
  where flag.feature_key = 'allow_anonymous_posts'
  for share;

  select flag.is_enabled into signed_out_posts_enabled
  from public.community_feature_flags flag
  where flag.feature_key = 'allow_signed_out_posts'
  for share;

  if not coalesce(anonymous_posts_enabled, false) then
    raise exception 'anonymous posts are disabled' using errcode = '55000';
  end if;
  if not coalesce(signed_out_posts_enabled, false) then
    raise exception 'logged-out posts are disabled' using errcode = '55000';
  end if;

  if char_length(btrim(p_title)) not between 4 and 120
    or char_length(btrim(p_body)) not between 10 and 2000 then
    raise exception 'invalid idea';
  end if;
  if clean_category not in ('idea', 'resource', 'perspective') then
    raise exception 'invalid category';
  end if;
  if cardinality(clean_tags) > 6
    or (select count(*) from unnest(clean_tags) as item(tag))
      <> (select count(distinct tag) from unnest(clean_tags) as item(tag))
    or exists (
      select 1
      from unnest(clean_tags) as item(tag)
      where not exists (
        select 1 from public.post_tags where post_tags.slug = item.tag
      )
    ) then
    raise exception 'invalid tags';
  end if;
  if (
    select count(*)
    from public.anonymous_idea_activity
    where visitor_id = p_visitor_id
      and action = 'create'
      and created_at >= now() - interval '1 day'
  ) >= 3 then
    raise exception 'visitor create rate limit';
  end if;
  if (
    select count(*)
    from public.anonymous_idea_activity
    where request_ip_hash = p_request_ip_hash
      and action = 'create'
      and created_at >= now() - interval '1 hour'
  ) >= 20 then
    raise exception 'network create rate limit';
  end if;

  insert into public.ideas (
    slug,
    title,
    body,
    month_key,
    category,
    tags,
    author_id,
    anonymous_visitor_id
  ) values (
    btrim(p_slug),
    btrim(p_title),
    btrim(p_body),
    p_month_key,
    clean_category,
    clean_tags,
    null,
    p_visitor_id
  )
  returning * into created_idea;

  insert into public.anonymous_idea_activity (visitor_id, request_ip_hash, action)
  values (p_visitor_id, p_request_ip_hash, 'create');

  return created_idea;
end;
$$;

create or replace function public.post_member_anonymous_idea(
  p_title text,
  p_body text,
  p_slug text,
  p_month_key text,
  p_category text,
  p_tags text[]
)
returns public.ideas
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  created_idea public.ideas%rowtype;
  clean_category text := lower(btrim(coalesce(p_category, '')));
  clean_tags text[] := coalesce(p_tags, '{}');
  anonymous_posts_enabled boolean := false;
begin
  if viewer_id is null or public.is_anonymous_user() then
    raise exception 'active member account required' using errcode = '42501';
  end if;

  perform 1
  from public.profiles as profile
  where profile.id = viewer_id
  for share;

  if not found or not public.is_active_member() then
    raise exception 'active member account required' using errcode = '42501';
  end if;

  select flag.is_enabled into anonymous_posts_enabled
  from public.community_feature_flags flag
  where flag.feature_key = 'allow_anonymous_posts'
  for share;

  if not coalesce(anonymous_posts_enabled, false) then
    raise exception 'anonymous posts are disabled' using errcode = '55000';
  end if;

  if char_length(btrim(p_title)) not between 4 and 120
    or char_length(btrim(p_body)) not between 10 and 2000 then
    raise exception 'invalid idea';
  end if;
  if clean_category not in ('idea', 'resource', 'perspective') then
    raise exception 'invalid category';
  end if;
  if cardinality(clean_tags) > 6
    or (select count(*) from unnest(clean_tags) as item(tag))
      <> (select count(distinct tag) from unnest(clean_tags) as item(tag))
    or exists (
      select 1
      from unnest(clean_tags) as item(tag)
      where not exists (
        select 1 from public.post_tags where post_tags.slug = item.tag
      )
    ) then
    raise exception 'invalid tags';
  end if;

  insert into public.ideas (
    slug,
    title,
    body,
    month_key,
    category,
    tags,
    author_id,
    anonymous_visitor_id
  ) values (
    btrim(p_slug),
    btrim(p_title),
    btrim(p_body),
    p_month_key,
    clean_category,
    clean_tags,
    null,
    gen_random_uuid()
  )
  returning * into created_idea;

  return created_idea;
end;
$$;

create or replace function public.create_idea_comment(
  target_idea_id uuid,
  target_parent_id uuid,
  comment_body text,
  post_anonymously boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  normalized_body text := btrim(comment_body);
  selected_status public.idea_status;
  parent_idea_id uuid;
  anonymous_setting_key text;
  anonymous_mode_enabled boolean := false;
  created_comment_id uuid;
begin
  if viewer_id is null or public.is_anonymous_user() then
    raise exception 'active member account required' using errcode = '42501';
  end if;

  perform 1
  from public.profiles as profile
  where profile.id = viewer_id
  for share;

  if not found or not public.is_active_member() then
    raise exception 'active member account required' using errcode = '42501';
  end if;

  if target_idea_id is null or post_anonymously is null then
    raise exception 'comment arguments are required' using errcode = '22023';
  end if;

  if normalized_body is null or char_length(normalized_body) not between 1 and 1500 then
    raise exception 'comment must be between 1 and 1500 characters' using errcode = '22023';
  end if;

  select idea.status into selected_status
  from public.ideas as idea
  where idea.id = target_idea_id
  for no key update;

  if not found or selected_status = 'hidden' then
    raise exception 'post not available' using errcode = '22023';
  end if;

  if target_parent_id is not null then
    select parent.idea_id into parent_idea_id
    from public.idea_comments as parent
    where parent.id = target_parent_id
    for share;

    if parent_idea_id is null or parent_idea_id <> target_idea_id then
      raise exception 'reply target is not part of this post' using errcode = '22023';
    end if;
  end if;

  if post_anonymously then
    anonymous_setting_key := case
      when target_parent_id is null then 'allow_anonymous_comments'
      else 'allow_anonymous_replies'
    end;

    select flag.is_enabled into anonymous_mode_enabled
    from public.community_feature_flags flag
    where flag.feature_key = anonymous_setting_key
    for share;

    if not coalesce(anonymous_mode_enabled, false) then
      raise exception '% are disabled', case
        when target_parent_id is null then 'anonymous comments'
        else 'anonymous replies'
      end using errcode = '55000';
    end if;
  end if;

  insert into public.idea_comments (
    idea_id,
    parent_id,
    author_id,
    body,
    is_anonymous
  ) values (
    target_idea_id,
    target_parent_id,
    viewer_id,
    normalized_body,
    post_anonymously
  )
  returning id into created_comment_id;

  return created_comment_id;
end;
$$;

revoke all on function public.get_post_participation_settings() from public;
revoke all on function public.super_admin_set_post_participation_setting(text, boolean) from public, anon;
revoke all on function public.post_anonymous_idea(uuid, text, text, text, text, text, text[], text) from public, anon, authenticated;
revoke all on function public.post_member_anonymous_idea(text, text, text, text, text, text[]) from public, anon;

grant execute on function public.get_post_participation_settings() to anon, authenticated;
grant execute on function public.super_admin_set_post_participation_setting(text, boolean) to authenticated;
grant execute on function public.post_anonymous_idea(uuid, text, text, text, text, text, text[], text) to service_role;
grant execute on function public.post_member_anonymous_idea(text, text, text, text, text, text[]) to authenticated;

notify pgrst, 'reload schema';

commit;
