begin;

-- Migration 035 counted only signed-in member votes. Restore the established
-- public count contract, which includes both member and anonymous upvotes.
create or replace function public.list_post_feed(p_view text default 'all')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  viewer_role text := null;
  viewer_access text := 'signed-out';
  viewer_is_admin boolean := false;
  feed jsonb;
begin
  if p_view is null or p_view not in ('all', 'mine', 'bookmarks') then
    raise exception 'unknown post feed view' using errcode = '22023';
  end if;

  if viewer_id is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    select profile.role::text
    into viewer_role
    from public.profiles as profile
    where profile.id = viewer_id
      and profile.suspended_at is null;

    if viewer_role is not null then
      viewer_access := 'active';
      viewer_is_admin := viewer_role in ('admin', 'super_admin');
    else
      viewer_access := 'inactive';
    end if;
  end if;

  select coalesce(jsonb_agg(row.payload order by row.created_at desc), '[]'::jsonb)
  into feed
  from (
    select
      idea.created_at,
      jsonb_build_object(
        'id', idea.id,
        'slug', idea.slug,
        'title', idea.title,
        'body', idea.body,
        'month_key', idea.month_key,
        'status', idea.status::text,
        'created_at', idea.created_at,
        'updated_at', idea.updated_at,
        'category', idea.category,
        'tags', idea.tags,
        'viewer_can_edit', (
          viewer_access = 'active'
          and idea.author_id = viewer_id
          and idea.status = 'open'
        ),
        'viewer_is_author', (
          viewer_access = 'active'
          and idea.author_id = viewer_id
        ),
        'viewer_has_bookmarked', (bookmark.idea_id is not null),
        'viewer_bookmarked_at', bookmark.created_at,
        'viewer_has_voted', (
          viewer_id is not null
          and exists (
            select 1
            from public.idea_votes as vote
            where vote.idea_id = idea.id
              and vote.user_id = viewer_id
          )
        ),
        'upvote_count', coalesce(vote_count.upvote_count, 0),
        'comment_count', (
          select count(*)::integer
          from public.idea_comments as comment
          where comment.idea_id = idea.id
        ),
        'profiles', case when author.id is null then null else jsonb_build_object(
          'handle', author.handle,
          'display_name', author.display_name,
          'avatar_url', author.avatar_url,
          'avatar_path', author.avatar_path,
          'avatar_updated_at', author.updated_at,
          'bio', author.bio,
          'website_url', author.website_url,
          'linkedin_url', author.linkedin_url,
          'github_url', author.github_url,
          'x_url', author.x_url
        ) end
      ) as payload
    from public.ideas as idea
    left join public.idea_vote_counts as vote_count
      on vote_count.idea_id = idea.id
    left join public.profiles as author
      on author.id = idea.author_id
     and author.is_public = true
     and author.suspended_at is null
    left join public.idea_bookmarks as bookmark
      on viewer_access = 'active'
     and bookmark.user_id = viewer_id
     and bookmark.idea_id = idea.id
    where (idea.status <> 'hidden' or viewer_is_admin)
      and (
        p_view = 'all'
        or (p_view = 'mine' and viewer_access = 'active' and idea.author_id = viewer_id)
        or (p_view = 'bookmarks' and viewer_access = 'active' and bookmark.idea_id is not null)
      )
  ) as row;

  return jsonb_build_object(
    'viewer', jsonb_build_object(
      'access', viewer_access,
      'role', viewer_role
    ),
    'posts', feed
  );
end;
$$;

revoke all on function public.list_post_feed(text) from public;
grant execute on function public.list_post_feed(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
