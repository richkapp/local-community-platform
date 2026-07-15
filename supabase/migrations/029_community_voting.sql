begin;

create table public.community_votes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  status text not null default 'draft',
  closes_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_votes_title_length check (char_length(btrim(title)) between 4 and 140),
  constraint community_votes_description_length check (char_length(btrim(description)) between 10 and 4000),
  constraint community_votes_status_check check (status in ('draft', 'published', 'closed')),
  constraint community_votes_state_timestamps check (
    (status = 'draft' and published_at is null and closed_at is null)
    or (status = 'published' and published_at is not null and closed_at is null)
    or (status = 'closed' and published_at is not null and closed_at is not null)
  )
);

create table public.community_vote_options (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.community_votes(id) on delete cascade,
  label text not null,
  position smallint not null,
  created_at timestamptz not null default now(),
  constraint community_vote_options_label_length check (char_length(btrim(label)) between 1 and 180),
  constraint community_vote_options_position_check check (position between 1 and 10),
  constraint community_vote_options_vote_position_key unique (vote_id, position),
  constraint community_vote_options_vote_id_id_key unique (vote_id, id)
);

create unique index community_vote_options_label_lower_key
  on public.community_vote_options (vote_id, lower(btrim(label)));

create table public.community_vote_ballots (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.community_votes(id) on delete cascade,
  option_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_vote_ballots_member_key unique (vote_id, user_id),
  constraint community_vote_ballots_option_key foreign key (vote_id, option_id)
    references public.community_vote_options(vote_id, id) on delete cascade
);

create index community_votes_catalog_idx
  on public.community_votes (status, created_at desc);
create index community_votes_closes_at_idx
  on public.community_votes (closes_at)
  where status = 'published';
create index community_vote_ballots_option_idx
  on public.community_vote_ballots (option_id);

create trigger community_votes_set_updated_at
before update on public.community_votes
for each row execute function public.set_updated_at();

create trigger community_vote_ballots_set_updated_at
before update on public.community_vote_ballots
for each row execute function public.set_updated_at();

alter table public.community_votes enable row level security;
alter table public.community_vote_options enable row level security;
alter table public.community_vote_ballots enable row level security;

revoke all on table public.community_votes from public, anon, authenticated;
revoke all on table public.community_vote_options from public, anon, authenticated;
revoke all on table public.community_vote_ballots from public, anon, authenticated;

create or replace function public.normalize_community_vote_options(p_options text[])
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text[] := array[]::text[];
  candidate text;
  raw_option text;
begin
  if p_options is null or cardinality(p_options) < 2 or cardinality(p_options) > 10 then
    raise exception 'Votes require between 2 and 10 options' using errcode = '22023';
  end if;

  foreach raw_option in array p_options loop
    candidate := btrim(coalesce(raw_option, ''));
    if char_length(candidate) < 1 or char_length(candidate) > 180 then
      raise exception 'Vote options must be between 1 and 180 characters' using errcode = '22023';
    end if;
    if exists (
      select 1
      from unnest(normalized) as existing(label)
      where lower(existing.label) = lower(candidate)
    ) then
      raise exception 'Vote options must be distinct' using errcode = '22023';
    end if;
    normalized := array_append(normalized, candidate);
  end loop;

  return normalized;
end;
$$;

create or replace function public.list_public_community_votes()
returns table (
  id uuid,
  title text,
  description text,
  status text,
  closes_at timestamptz,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  ballot_count bigint,
  options jsonb,
  viewer_option_id uuid,
  viewer_is_anonymous boolean,
  viewer_can_vote boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    vote.id,
    vote.title,
    vote.description,
    case
      when vote.status = 'published' and vote.closes_at <= now() then 'closed'
      else vote.status
    end as status,
    vote.closes_at,
    vote.published_at,
    vote.closed_at,
    vote.created_at,
    vote.updated_at,
    (select count(*) from public.community_vote_ballots ballot where ballot.vote_id = vote.id) as ballot_count,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', option.id,
          'label', option.label,
          'position', option.position,
          'ballot_count', (select count(*) from public.community_vote_ballots option_ballot where option_ballot.option_id = option.id),
          'named_voters', coalesce((
            select jsonb_agg(
              jsonb_build_object('display_name', profile.display_name)
              order by lower(profile.display_name), profile.display_name
            )
            from public.community_vote_ballots named_ballot
            join public.profiles profile on profile.id = named_ballot.user_id
            where named_ballot.option_id = option.id
              and named_ballot.is_anonymous = false
          ), '[]'::jsonb)
        )
        order by option.position
      )
      from public.community_vote_options option
      where option.vote_id = vote.id
    ), '[]'::jsonb) as options,
    (
      select viewer_ballot.option_id
      from public.community_vote_ballots viewer_ballot
      where viewer_ballot.vote_id = vote.id
        and viewer_ballot.user_id = auth.uid()
    ) as viewer_option_id,
    (
      select viewer_ballot.is_anonymous
      from public.community_vote_ballots viewer_ballot
      where viewer_ballot.vote_id = vote.id
        and viewer_ballot.user_id = auth.uid()
    ) as viewer_is_anonymous,
    (
      vote.status = 'published'
      and vote.closes_at > now()
      and public.is_active_member()
    ) as viewer_can_vote
  from public.community_votes vote
  where vote.status in ('published', 'closed')
  order by
    case when vote.status = 'published' and vote.closes_at > now() then 0 else 1 end,
    vote.created_at desc;
$$;

create or replace function public.admin_list_community_votes()
returns table (
  id uuid,
  title text,
  description text,
  status text,
  closes_at timestamptz,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  ballot_count bigint,
  options jsonb,
  can_edit boolean,
  can_delete boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  return query
  select
    vote.id,
    vote.title,
    vote.description,
    case
      when vote.status = 'published' and vote.closes_at <= now() then 'closed'
      else vote.status
    end as status,
    vote.closes_at,
    vote.published_at,
    vote.closed_at,
    vote.created_at,
    vote.updated_at,
    (select count(*) from public.community_vote_ballots ballot where ballot.vote_id = vote.id) as ballot_count,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', option.id,
          'label', option.label,
          'position', option.position,
          'ballot_count', (select count(*) from public.community_vote_ballots option_ballot where option_ballot.option_id = option.id)
        )
        order by option.position
      )
      from public.community_vote_options option
      where option.vote_id = vote.id
    ), '[]'::jsonb) as options,
    (
      vote.status in ('draft', 'published')
      and (vote.status = 'draft' or vote.closes_at > now())
      and not exists (select 1 from public.community_vote_ballots ballot where ballot.vote_id = vote.id)
    ) as can_edit,
    not exists (select 1 from public.community_vote_ballots ballot where ballot.vote_id = vote.id) as can_delete
  from public.community_votes vote
  order by vote.created_at desc;
end;
$$;

create or replace function public.admin_create_community_vote(
  p_title text,
  p_description text,
  p_closes_at timestamptz,
  p_options text[],
  p_publish boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_title text := btrim(coalesce(p_title, ''));
  normalized_description text := btrim(coalesce(p_description, ''));
  normalized_options text[];
  result_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;
  if char_length(normalized_title) < 4 or char_length(normalized_title) > 140 then
    raise exception 'Vote titles must be between 4 and 140 characters' using errcode = '22023';
  end if;
  if char_length(normalized_description) < 10 or char_length(normalized_description) > 4000 then
    raise exception 'Vote descriptions must be between 10 and 4000 characters' using errcode = '22023';
  end if;
  if p_closes_at is null or p_closes_at <= now() then
    raise exception 'Vote closing time must be in the future' using errcode = '22023';
  end if;

  normalized_options := public.normalize_community_vote_options(p_options);

  insert into public.community_votes (
    title,
    description,
    status,
    closes_at,
    created_by,
    published_at
  ) values (
    normalized_title,
    normalized_description,
    case when p_publish then 'published' else 'draft' end,
    p_closes_at,
    auth.uid(),
    case when p_publish then now() else null end
  )
  returning community_votes.id into result_id;

  insert into public.community_vote_options (vote_id, label, position)
  select result_id, option_row.label, option_row.ordinality::smallint
  from unnest(normalized_options) with ordinality as option_row(label, ordinality);

  return result_id;
end;
$$;

create or replace function public.admin_update_community_vote(
  target_vote_id uuid,
  p_title text,
  p_description text,
  p_closes_at timestamptz,
  p_options text[],
  p_publish boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_vote public.community_votes%rowtype;
  normalized_title text := btrim(coalesce(p_title, ''));
  normalized_description text := btrim(coalesce(p_description, ''));
  normalized_options text[];
begin
  if not public.is_admin() then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;
  if char_length(normalized_title) < 4 or char_length(normalized_title) > 140 then
    raise exception 'Vote titles must be between 4 and 140 characters' using errcode = '22023';
  end if;
  if char_length(normalized_description) < 10 or char_length(normalized_description) > 4000 then
    raise exception 'Vote descriptions must be between 10 and 4000 characters' using errcode = '22023';
  end if;
  if p_closes_at is null or p_closes_at <= now() then
    raise exception 'Vote closing time must be in the future' using errcode = '22023';
  end if;

  normalized_options := public.normalize_community_vote_options(p_options);

  select * into selected_vote
  from public.community_votes
  where community_votes.id = target_vote_id
  for update;

  if not found then
    raise exception 'Vote not found' using errcode = 'P0002';
  end if;
  if selected_vote.status = 'closed'
    or (selected_vote.status = 'published' and selected_vote.closes_at <= now()) then
    raise exception 'Closed votes cannot be edited' using errcode = '55000';
  end if;
  if exists (select 1 from public.community_vote_ballots ballot where ballot.vote_id = target_vote_id) then
    raise exception 'Votes with ballots cannot be edited' using errcode = '55000';
  end if;

  delete from public.community_vote_options where vote_id = target_vote_id;
  insert into public.community_vote_options (vote_id, label, position)
  select target_vote_id, option_row.label, option_row.ordinality::smallint
  from unnest(normalized_options) with ordinality as option_row(label, ordinality);

  update public.community_votes
  set title = normalized_title,
      description = normalized_description,
      closes_at = p_closes_at,
      status = case when selected_vote.status = 'draft' and p_publish then 'published' else selected_vote.status end,
      published_at = case
        when selected_vote.status = 'draft' and p_publish then now()
        else selected_vote.published_at
      end
  where community_votes.id = target_vote_id;

  return target_vote_id;
end;
$$;

create or replace function public.admin_close_community_vote(target_vote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_vote public.community_votes%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  select * into selected_vote
  from public.community_votes
  where community_votes.id = target_vote_id
  for update;

  if not found then
    raise exception 'Vote not found' using errcode = 'P0002';
  end if;
  if selected_vote.status <> 'published' then
    raise exception 'Only published votes can be closed' using errcode = '55000';
  end if;

  update public.community_votes
  set status = 'closed', closed_at = now()
  where community_votes.id = target_vote_id;

  return target_vote_id;
end;
$$;

create or replace function public.admin_delete_community_vote(target_vote_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_vote public.community_votes%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  select * into selected_vote
  from public.community_votes
  where community_votes.id = target_vote_id
  for update;

  if not found then
    raise exception 'Vote not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.community_vote_ballots ballot where ballot.vote_id = target_vote_id) then
    raise exception 'Votes with ballots cannot be deleted' using errcode = '55000';
  end if;

  delete from public.community_votes where community_votes.id = target_vote_id;
  return true;
end;
$$;

create or replace function public.submit_community_ballot(
  target_vote_id uuid,
  target_option_id uuid,
  p_is_anonymous boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_vote public.community_votes%rowtype;
begin
  if current_user_id is null or public.is_anonymous_user() then
    raise exception 'Community account required' using errcode = '42501';
  end if;
  if not public.is_active_member() then
    raise exception 'Active member access required' using errcode = '42501';
  end if;

  select * into selected_vote
  from public.community_votes
  where community_votes.id = target_vote_id
  for update;

  if not found then
    raise exception 'Vote not found' using errcode = 'P0002';
  end if;
  if selected_vote.status <> 'published' or selected_vote.closes_at <= now() then
    raise exception 'Voting is closed' using errcode = '55000';
  end if;
  if not exists (
    select 1
    from public.community_vote_options option
    where option.vote_id = target_vote_id
      and option.id = target_option_id
  ) then
    raise exception 'Choose a valid vote option' using errcode = '22023';
  end if;

  insert into public.community_vote_ballots (
    vote_id,
    option_id,
    user_id,
    is_anonymous
  ) values (
    target_vote_id,
    target_option_id,
    current_user_id,
    coalesce(p_is_anonymous, false)
  )
  on conflict (vote_id, user_id) do update
  set option_id = excluded.option_id,
      is_anonymous = excluded.is_anonymous,
      updated_at = now();

  return target_option_id;
end;
$$;

revoke all on function public.normalize_community_vote_options(text[]) from public, anon, authenticated;
revoke all on function public.list_public_community_votes() from public, anon, authenticated;
revoke all on function public.admin_list_community_votes() from public, anon, authenticated;
revoke all on function public.admin_create_community_vote(text, text, timestamptz, text[], boolean) from public, anon, authenticated;
revoke all on function public.admin_update_community_vote(uuid, text, text, timestamptz, text[], boolean) from public, anon, authenticated;
revoke all on function public.admin_close_community_vote(uuid) from public, anon, authenticated;
revoke all on function public.admin_delete_community_vote(uuid) from public, anon, authenticated;
revoke all on function public.submit_community_ballot(uuid, uuid, boolean) from public, anon, authenticated;

grant execute on function public.list_public_community_votes() to anon, authenticated;
grant execute on function public.admin_list_community_votes() to authenticated;
grant execute on function public.admin_create_community_vote(text, text, timestamptz, text[], boolean) to authenticated;
grant execute on function public.admin_update_community_vote(uuid, text, text, timestamptz, text[], boolean) to authenticated;
grant execute on function public.admin_close_community_vote(uuid) to authenticated;
grant execute on function public.admin_delete_community_vote(uuid) to authenticated;
grant execute on function public.submit_community_ballot(uuid, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
