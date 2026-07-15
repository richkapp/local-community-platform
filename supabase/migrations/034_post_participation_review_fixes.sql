begin;

create or replace function public.super_admin_set_post_participation_setting(
  p_feature_key text,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'Super-admin access required' using errcode = '42501';
  end if;

  perform 1
  from public.profiles as profile
  where profile.id = viewer_id
    and profile.role = 'super_admin'
    and profile.suspended_at is null
  for share;

  if not found then
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
  values (p_feature_key, p_enabled, viewer_id)
  on conflict (feature_key) do update
  set is_enabled = excluded.is_enabled,
      updated_at = now(),
      updated_by = excluded.updated_by;

  return p_enabled;
end;
$$;

create or replace function public.list_idea_comments(target_idea_id uuid)
returns table (
  id uuid,
  parent_id uuid,
  body text,
  created_at timestamptz,
  is_anonymous boolean,
  author_handle text,
  author_display_name text,
  author_avatar_url text,
  author_avatar_path text,
  author_avatar_updated_at timestamptz,
  upvote_count integer,
  viewer_has_upvoted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    comment.id,
    comment.parent_id,
    comment.body,
    comment.created_at,
    (
      comment.is_anonymous
      or (comment.author_id is not null and profile.id is null)
    ) as is_anonymous,
    case when comment.is_anonymous then null else profile.handle end,
    case when comment.is_anonymous then null else profile.display_name end,
    case when comment.is_anonymous then null else profile.avatar_url end,
    case when comment.is_anonymous then null else profile.avatar_path end,
    case when comment.is_anonymous then null else profile.updated_at end,
    coalesce(votes.upvote_count, 0),
    coalesce(votes.viewer_has_upvoted, false)
  from public.idea_comments as comment
  join public.ideas as idea on idea.id = comment.idea_id
  left join public.profiles as profile
    on profile.id = comment.author_id
   and profile.is_public = true
   and profile.suspended_at is null
  left join lateral (
    select
      count(*)::integer as upvote_count,
      bool_or(upvote.user_id = auth.uid()) as viewer_has_upvoted
    from public.idea_comment_upvotes as upvote
    where upvote.comment_id = comment.id
  ) as votes on true
  where comment.idea_id = target_idea_id
    and (idea.status <> 'hidden' or public.is_admin())
  order by comment.created_at, comment.id;
$$;

notify pgrst, 'reload schema';

commit;
