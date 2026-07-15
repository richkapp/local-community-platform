begin;

create table public.idea_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  idea_id uuid not null references public.ideas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, idea_id)
);

create index idea_bookmarks_idea_id_idx
  on public.idea_bookmarks (idea_id);

create index idea_bookmarks_user_created_idx
  on public.idea_bookmarks (user_id, created_at desc, idea_id);

-- Anonymous Supabase identities use the reviewed Edge Function path. A profile
-- row created by the auth trigger must never make that temporary identity a
-- community member for direct table mutations or member-only capabilities.
create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.is_anonymous_user()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.suspended_at is null
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.is_anonymous_user()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'super_admin')
        and profiles.suspended_at is null
    );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.is_anonymous_user()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'super_admin'
        and profiles.suspended_at is null
    );
$$;

create or replace function public.current_member_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.role::text
  from public.profiles
  where profiles.id = auth.uid()
    and profiles.suspended_at is null
    and not public.is_anonymous_user();
$$;

alter table public.idea_bookmarks enable row level security;

-- Bookmark rows are private account state. Clients use the narrow RPCs below;
-- they never receive direct table privileges or another member's bookmark rows.
revoke all on table public.idea_bookmarks from public, anon, authenticated;
grant all privileges on table public.idea_bookmarks to service_role;

create or replace function public.get_my_post_relationships(target_idea_id uuid default null)
returns table (
  idea_id uuid,
  viewer_is_author boolean,
  viewer_has_bookmarked boolean,
  bookmarked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
begin
  -- Suspended, anonymous, or signed-out visitors retain the public feed but do
  -- not receive a personal library. Mutation remains explicitly denied below.
  if viewer_id is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or not public.is_active_member() then
    return;
  end if;

  return query
  select
    target.id,
    target.author_id = viewer_id,
    bookmark.idea_id is not null,
    bookmark.created_at
  from public.ideas as target
  left join public.idea_bookmarks as bookmark
    on bookmark.idea_id = target.id
   and bookmark.user_id = viewer_id
  where (target.author_id = viewer_id or bookmark.idea_id is not null)
    and (target.status <> 'hidden' or public.is_admin())
    and ($1 is null or target.id = $1)
  order by coalesce(bookmark.created_at, target.created_at) desc;
end;
$$;

create or replace function public.set_idea_bookmark(
  target_idea_id uuid,
  should_bookmark boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target public.ideas%rowtype;
begin
  if viewer_id is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or not public.is_active_member() then
    raise exception 'active member account required' using errcode = '42501';
  end if;

  if target_idea_id is null or should_bookmark is null then
    raise exception 'bookmark arguments are required' using errcode = '22023';
  end if;

  -- Removing is deliberately idempotent and remains possible if a bookmarked
  -- post was later hidden by moderation.
  if not should_bookmark then
    delete from public.idea_bookmarks
    where idea_bookmarks.user_id = viewer_id
      and idea_bookmarks.idea_id = target_idea_id;
    return false;
  end if;

  select ideas.* into target
  from public.ideas as ideas
  where ideas.id = target_idea_id
  for no key update;

  if not found or not (target.status <> 'hidden' or public.is_admin()) then
    raise exception 'post not available' using errcode = '22023';
  end if;

  insert into public.idea_bookmarks (user_id, idea_id)
  values (viewer_id, target_idea_id)
  on conflict (user_id, idea_id) do nothing;
  return true;
end;
$$;

-- A suspended author must not receive an edit capability the database will
-- reject. The public function still keeps both identity columns private.
create or replace function public.list_visible_ideas()
returns table (
  id uuid,
  slug text,
  title text,
  body text,
  month_key text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  category text,
  tags text[],
  viewer_can_edit boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ideas.id,
    ideas.slug,
    ideas.title,
    ideas.body,
    ideas.month_key,
    ideas.status,
    ideas.created_at,
    ideas.updated_at,
    ideas.category,
    ideas.tags,
    (
      auth.uid() is not null
      and public.is_active_member()
      and not public.is_anonymous_user()
      and ideas.author_id = auth.uid()
      and ideas.status = 'open'
    ) as viewer_can_edit
  from public.ideas
  where ideas.status <> 'hidden' or public.is_admin();
$$;

revoke all on function public.get_my_post_relationships(uuid) from public, anon;
revoke all on function public.set_idea_bookmark(uuid, boolean) from public, anon;
revoke all on function public.list_visible_ideas() from public;
grant execute on function public.get_my_post_relationships(uuid) to authenticated;
grant execute on function public.set_idea_bookmark(uuid, boolean) to authenticated;
grant execute on function public.list_visible_ideas() to anon, authenticated;

commit;
