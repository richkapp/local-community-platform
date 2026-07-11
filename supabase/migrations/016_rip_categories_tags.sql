begin;

alter table public.ideas
  add column category text not null default 'idea',
  add column tags text[] not null default '{}';

alter table public.ideas
  add constraint ideas_category_allowed check (category in ('idea', 'resource', 'perspective')),
  add constraint ideas_tags_allowed check (
    tags <@ array['next-event', 'news', 'community-challenge', 'collaboration', 'learning', 'member-project']::text[]
    and cardinality(tags) <= 6
  );

revoke update on table public.ideas from authenticated;
grant update (title, body, category, tags, status) on table public.ideas to authenticated;

drop function if exists public.post_anonymous_idea(uuid, text, text, text, text, text);

create function public.post_anonymous_idea(
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
set search_path = public
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
  if not (clean_tags <@ array['next-event', 'news', 'community-challenge', 'collaboration', 'learning', 'member-project']::text[]) or cardinality(clean_tags) > 6 then
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

revoke all on function public.post_anonymous_idea(uuid, text, text, text, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.post_anonymous_idea(uuid, text, text, text, text, text, text[], text) to service_role;

commit;
