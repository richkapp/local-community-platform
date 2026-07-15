begin;

create table public.post_tags (
  slug text primary key,
  label text not null,
  created_by uuid references auth.users(id) on delete set null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  constraint post_tags_slug_format check (
    char_length(slug) between 2 and 40
    and slug ~ '^[[:alnum:]]+(-[[:alnum:]]+)*$'
  ),
  constraint post_tags_label_length check (char_length(label) between 2 and 28)
);

create unique index post_tags_label_lower_idx on public.post_tags (lower(label));
create index post_tags_creator_idx on public.post_tags (created_by, created_at)
  where created_by is not null and not is_system;

insert into public.post_tags (slug, label, is_system)
values
  ('next-event', 'Next Event', true),
  ('news', 'News', true),
  ('community-challenge', 'Community Challenge', true),
  ('collaboration', 'Collaboration', true),
  ('learning', 'Learning', true),
  ('member-project', 'Member Project', true)
on conflict (slug) do update
set label = excluded.label,
    is_system = true;

alter table public.post_tags enable row level security;
revoke all on table public.post_tags from public, anon, authenticated;
grant all privileges on table public.post_tags to service_role;

alter table public.ideas
  drop constraint if exists ideas_tags_allowed;

create or replace function public.validate_idea_tags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.tags := coalesce(new.tags, '{}');

  if cardinality(new.tags) > 6 then
    raise exception 'a post can use at most 6 tags' using errcode = '22023';
  end if;

  if (select count(*) from unnest(new.tags) as item(tag))
    <> (select count(distinct tag) from unnest(new.tags) as item(tag)) then
    raise exception 'post tags must be distinct' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(new.tags) as item(tag)
    where not exists (
      select 1
      from public.post_tags
      where post_tags.slug = item.tag
    )
  ) then
    raise exception 'post tag is not registered' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_idea_tags_before_write on public.ideas;
create trigger validate_idea_tags_before_write
before insert or update of tags on public.ideas
for each row execute function public.validate_idea_tags();

create or replace function public.list_post_tags()
returns table (
  slug text,
  label text,
  usage_count bigint,
  is_system boolean,
  viewer_created boolean,
  viewer_custom_tag_count integer,
  viewer_custom_tag_limit integer,
  viewer_is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select auth.uid() as viewer_id,
      public.is_active_member() as is_active
  ),
  custom_count as (
    select count(*)::integer as total
    from public.post_tags
    cross join viewer
    where not post_tags.is_system
      and post_tags.created_by = viewer.viewer_id
  )
  select
    post_tags.slug,
    post_tags.label,
    count(ideas.id)::bigint as usage_count,
    post_tags.is_system,
    (viewer.is_active and coalesce(post_tags.created_by = viewer.viewer_id, false)) as viewer_created,
    custom_count.total as viewer_custom_tag_count,
    3 as viewer_custom_tag_limit,
    viewer.is_active as viewer_is_active
  from public.post_tags
  cross join viewer
  cross join custom_count
  left join public.ideas
    on post_tags.slug = any(ideas.tags)
   and ideas.status <> 'hidden'
  group by post_tags.slug, post_tags.label, post_tags.is_system, post_tags.created_by,
    viewer.viewer_id, viewer.is_active, custom_count.total
  order by usage_count desc, lower(post_tags.label), post_tags.slug;
$$;

create or replace function public.create_post_tag(p_label text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  clean_label text := regexp_replace(btrim(coalesce(p_label, '')), '[[:space:]]+', ' ', 'g');
  clean_slug text;
begin
  if viewer_id is null
    or public.is_anonymous_user()
    or not public.is_active_member() then
    raise exception 'active member account required' using errcode = '42501';
  end if;

  if char_length(clean_label) not between 2 and 28 then
    raise exception 'tag labels must be 2 to 28 characters' using errcode = '22023';
  end if;

  if clean_label !~ '^[[:alnum:]]([[:alnum:] -]*[[:alnum:]])$' then
    raise exception 'tag label needs letters or numbers and may use spaces or hyphens' using errcode = '22023';
  end if;

  clean_slug := lower(regexp_replace(clean_label, '[^[:alnum:]]+', '-', 'g'));
  clean_slug := btrim(clean_slug, '-');
  if char_length(clean_slug) not between 2 and 40 then
    raise exception 'tag label needs letters or numbers' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('post-tags:' || viewer_id::text, 0));

  if exists (
    select 1 from public.post_tags
    where post_tags.slug = clean_slug
       or lower(post_tags.label) = lower(clean_label)
  ) then
    raise exception 'tag already exists' using errcode = '23505';
  end if;

  if (
    select count(*)
    from public.post_tags
    where post_tags.created_by = viewer_id
      and not post_tags.is_system
  ) >= 3 then
    raise exception 'custom tag lifetime limit reached' using errcode = '22023';
  end if;

  insert into public.post_tags (slug, label, created_by, is_system)
  values (clean_slug, clean_label, viewer_id, false);

  return clean_slug;
exception
  when unique_violation then
    raise exception 'tag already exists' using errcode = '23505';
end;
$$;

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
begin
  if p_visitor_id is null or p_request_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid visitor session';
  end if;
  if char_length(btrim(p_title)) not between 4 and 120 or char_length(btrim(p_body)) not between 10 and 2000 then
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
  if (select count(*) from public.anonymous_idea_activity where visitor_id = p_visitor_id and action = 'create' and created_at >= now() - interval '1 day') >= 3 then
    raise exception 'visitor create rate limit';
  end if;
  if (select count(*) from public.anonymous_idea_activity where request_ip_hash = p_request_ip_hash and action = 'create' and created_at >= now() - interval '1 hour') >= 20 then
    raise exception 'network create rate limit';
  end if;

  insert into public.ideas (slug, title, body, month_key, category, tags, author_id, anonymous_visitor_id)
  values (btrim(p_slug), btrim(p_title), btrim(p_body), p_month_key, clean_category, clean_tags, null, p_visitor_id)
  returning * into created_idea;

  insert into public.anonymous_idea_activity (visitor_id, request_ip_hash, action)
  values (p_visitor_id, p_request_ip_hash, 'create');

  return created_idea;
end;
$$;

revoke all on function public.validate_idea_tags() from public, anon, authenticated;
revoke all on function public.list_post_tags() from public;
revoke all on function public.create_post_tag(text) from public, anon;
revoke all on function public.post_anonymous_idea(uuid, text, text, text, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.list_post_tags() to anon, authenticated;
grant execute on function public.create_post_tag(text) to authenticated;
grant execute on function public.post_anonymous_idea(uuid, text, text, text, text, text, text[], text) to service_role;

commit;
