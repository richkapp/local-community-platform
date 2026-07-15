begin;

create table public.idea_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  parent_id uuid,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  constraint idea_comments_body_length check (char_length(body) between 1 and 1500),
  constraint idea_comments_body_trimmed check (body = btrim(body)),
  unique (id, idea_id),
  foreign key (parent_id, idea_id)
    references public.idea_comments(id, idea_id)
    on delete cascade
);

create index idea_comments_idea_created_idx
  on public.idea_comments (idea_id, created_at, id);
create index idea_comments_parent_created_idx
  on public.idea_comments (parent_id, created_at, id)
  where parent_id is not null;
create index idea_comments_author_created_idx
  on public.idea_comments (author_id, created_at desc);

create table public.idea_comment_upvotes (
  comment_id uuid not null references public.idea_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index idea_comment_upvotes_user_created_idx
  on public.idea_comment_upvotes (user_id, created_at desc, comment_id);

alter table public.idea_comments enable row level security;
alter table public.idea_comment_upvotes enable row level security;

-- Comment identities and votes remain private. Public clients receive only the
-- safe projections returned by the RPCs below.
revoke all on table public.idea_comments from public, anon, authenticated;
revoke all on table public.idea_comment_upvotes from public, anon, authenticated;
grant all privileges on table public.idea_comments to service_role;
grant all privileges on table public.idea_comment_upvotes to service_role;

create or replace function public.list_idea_comment_counts(target_idea_ids uuid[] default null)
returns table (
  idea_id uuid,
  comment_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    idea.id,
    count(comment.id)::integer
  from public.ideas as idea
  left join public.idea_comments as comment on comment.idea_id = idea.id
  where (idea.status <> 'hidden' or public.is_admin())
    and (target_idea_ids is null or idea.id = any(target_idea_ids))
  group by idea.id;
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
    (comment.is_anonymous or profile.id is null) as is_anonymous,
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
    where parent.id = target_parent_id;

    if parent_idea_id is null or parent_idea_id <> target_idea_id then
      raise exception 'reply target is not part of this post' using errcode = '22023';
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

create or replace function public.toggle_idea_comment_upvote(target_comment_id uuid)
returns table (
  viewer_has_upvoted boolean,
  upvote_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  selected_status public.idea_status;
  has_upvoted boolean;
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

  if target_comment_id is null then
    raise exception 'comment is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'idea-comment-upvote:' || viewer_id::text || ':' || target_comment_id::text,
    0
  ));

  select idea.status
  into selected_status
  from public.idea_comments as comment
  join public.ideas as idea on idea.id = comment.idea_id
  where comment.id = target_comment_id
  for share of comment, idea;

  if not found or selected_status = 'hidden' then
    raise exception 'comment not available' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.idea_comment_upvotes as upvote
    where upvote.comment_id = target_comment_id
      and upvote.user_id = viewer_id
  ) into has_upvoted;

  if has_upvoted then
    delete from public.idea_comment_upvotes
    where comment_id = target_comment_id
      and user_id = viewer_id;
    has_upvoted := false;
  else
    insert into public.idea_comment_upvotes (comment_id, user_id)
    values (target_comment_id, viewer_id);
    has_upvoted := true;
  end if;

  return query
  select
    has_upvoted,
    count(*)::integer
  from public.idea_comment_upvotes as upvote
  where upvote.comment_id = target_comment_id;
end;
$$;

revoke all on function public.list_idea_comment_counts(uuid[]) from public;
revoke all on function public.list_idea_comments(uuid) from public;
revoke all on function public.create_idea_comment(uuid, uuid, text, boolean) from public, anon;
revoke all on function public.toggle_idea_comment_upvote(uuid) from public, anon;

grant execute on function public.list_idea_comment_counts(uuid[]) to anon, authenticated;
grant execute on function public.list_idea_comments(uuid) to anon, authenticated;
grant execute on function public.create_idea_comment(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.toggle_idea_comment_upvote(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
