begin;

-- Keep public idea participation separate from member identities. These rows are
-- only written through the rate-limited Edge Function; public clients never get
-- write access to the underlying tables or RPCs.
alter table public.ideas
  alter column author_id drop not null,
  add column anonymous_visitor_id uuid;

alter table public.ideas
  add constraint ideas_author_identity check (
    (author_id is not null and anonymous_visitor_id is null)
    or (author_id is null and anonymous_visitor_id is not null)
  );

create index ideas_anonymous_visitor_id_idx on public.ideas (anonymous_visitor_id)
  where anonymous_visitor_id is not null;

create table public.anonymous_idea_votes (
  idea_id uuid not null references public.ideas(id) on delete cascade,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (idea_id, visitor_id)
);

create index anonymous_idea_votes_visitor_id_idx on public.anonymous_idea_votes (visitor_id);

create table public.anonymous_idea_activity (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  request_ip_hash text not null,
  action text not null check (action in ('create', 'vote')),
  created_at timestamptz not null default now()
);

create index anonymous_idea_activity_visitor_idx on public.anonymous_idea_activity (visitor_id, action, created_at desc);
create index anonymous_idea_activity_ip_idx on public.anonymous_idea_activity (request_ip_hash, action, created_at desc);

alter table public.anonymous_idea_votes enable row level security;
alter table public.anonymous_idea_activity enable row level security;
revoke all on table public.anonymous_idea_votes, public.anonymous_idea_activity from anon, authenticated;

create or replace view public.idea_vote_counts as
select
  ideas.id as idea_id,
  count(votes.idea_id)::integer as upvote_count
from public.ideas
left join (
  select idea_id from public.idea_votes
  union all
  select idea_id from public.anonymous_idea_votes
) as votes on votes.idea_id = ideas.id
group by ideas.id;

grant select on table public.idea_vote_counts to anon, authenticated;

create or replace function public.post_anonymous_idea(
  p_visitor_id uuid,
  p_title text,
  p_body text,
  p_slug text,
  p_month_key text,
  p_request_ip_hash text
)
returns public.ideas
language plpgsql
security definer
set search_path = public
as $$
declare
  created_idea public.ideas%rowtype;
begin
  if p_visitor_id is null or p_request_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid visitor session';
  end if;
  if char_length(btrim(p_title)) not between 4 and 120 or char_length(btrim(p_body)) not between 10 and 2000 then
    raise exception 'invalid idea';
  end if;
  if (select count(*) from public.anonymous_idea_activity where visitor_id = p_visitor_id and action = 'create' and created_at >= now() - interval '1 day') >= 3 then
    raise exception 'visitor create rate limit';
  end if;
  if (select count(*) from public.anonymous_idea_activity where request_ip_hash = p_request_ip_hash and action = 'create' and created_at >= now() - interval '1 hour') >= 20 then
    raise exception 'network create rate limit';
  end if;

  insert into public.ideas (slug, title, body, month_key, author_id, anonymous_visitor_id)
  values (btrim(p_slug), btrim(p_title), btrim(p_body), p_month_key, null, p_visitor_id)
  returning * into created_idea;

  insert into public.anonymous_idea_activity (visitor_id, request_ip_hash, action)
  values (p_visitor_id, p_request_ip_hash, 'create');

  return created_idea;
end;
$$;

create or replace function public.toggle_anonymous_idea_vote(
  p_visitor_id uuid,
  p_idea_id uuid,
  p_request_ip_hash text
)
returns table (voted boolean, upvote_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_voted boolean;
begin
  if p_visitor_id is null or p_request_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid visitor session';
  end if;
  if not exists (select 1 from public.ideas where id = p_idea_id and status = 'open') then
    raise exception 'idea is not open for voting';
  end if;

  if exists (select 1 from public.anonymous_idea_votes where idea_id = p_idea_id and visitor_id = p_visitor_id) then
    delete from public.anonymous_idea_votes where idea_id = p_idea_id and visitor_id = p_visitor_id;
    next_voted := false;
  else
    if (select count(*) from public.anonymous_idea_activity where visitor_id = p_visitor_id and action = 'vote' and created_at >= now() - interval '1 hour') >= 40 then
      raise exception 'visitor vote rate limit';
    end if;
    if (select count(*) from public.anonymous_idea_activity where request_ip_hash = p_request_ip_hash and action = 'vote' and created_at >= now() - interval '1 hour') >= 200 then
      raise exception 'network vote rate limit';
    end if;
    insert into public.anonymous_idea_votes (idea_id, visitor_id) values (p_idea_id, p_visitor_id);
    insert into public.anonymous_idea_activity (visitor_id, request_ip_hash, action) values (p_visitor_id, p_request_ip_hash, 'vote');
    next_voted := true;
  end if;

  return query
  select next_voted, count(votes.idea_id)::integer
  from (
    select idea_id from public.idea_votes where idea_id = p_idea_id
    union all
    select idea_id from public.anonymous_idea_votes where idea_id = p_idea_id
  ) as votes;
end;
$$;

revoke all on function public.post_anonymous_idea(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.toggle_anonymous_idea_vote(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.post_anonymous_idea(uuid, text, text, text, text, text) to service_role;
grant execute on function public.toggle_anonymous_idea_vote(uuid, uuid, text) to service_role;

commit;
