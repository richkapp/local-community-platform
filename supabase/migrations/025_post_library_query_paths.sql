begin;

-- Personal post history resolves by author_id. Keep that path indexed without
-- spending index space on anonymous posts, whose author_id is always null.
create index if not exists ideas_author_id_idx
  on public.ideas (author_id)
  where author_id is not null;

-- Bookmark creation needs the target post to remain visible and undeleted until
-- the foreign-key insert completes. A shared row lock provides that guarantee
-- without serializing independent members bookmarking the same popular post.
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
  for share;

  if not found or not (target.status <> 'hidden' or public.is_admin()) then
    raise exception 'post not available' using errcode = '22023';
  end if;

  insert into public.idea_bookmarks (user_id, idea_id)
  values (viewer_id, target_idea_id)
  on conflict (user_id, idea_id) do nothing;
  return true;
end;
$$;

commit;
