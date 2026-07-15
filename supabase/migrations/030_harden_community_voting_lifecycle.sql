begin;

alter table public.community_votes
  add column first_ballot_at timestamptz;

comment on column public.community_votes.first_ballot_at is
  'Permanent latch set by the first accepted ballot; never cleared even if attribution is later removed.';

update public.community_votes vote
set first_ballot_at = first_ballot.created_at
from (
  select ballot.vote_id, min(ballot.created_at) as created_at
  from public.community_vote_ballots ballot
  group by ballot.vote_id
) first_ballot
where vote.id = first_ballot.vote_id
  and vote.first_ballot_at is null;

create or replace function public.enforce_community_vote_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  valid_close_transition boolean := false;
begin
  if tg_op = 'DELETE' then
    if old.first_ballot_at is not null then
      raise exception 'Votes with ballots cannot be deleted' using errcode = '55000';
    end if;
    return old;
  end if;

  if old.first_ballot_at is null then
    if new.first_ballot_at is not null
      and (
        new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.closes_at is distinct from old.closes_at
        or new.status is distinct from old.status
        or new.published_at is distinct from old.published_at
        or new.closed_at is distinct from old.closed_at
        or new.created_by is distinct from old.created_by
        or new.created_at is distinct from old.created_at
      ) then
      raise exception 'The first-ballot latch cannot change vote content' using errcode = '55000';
    end if;
    return new;
  end if;

  valid_close_transition := old.status = 'published'
    and new.status = 'closed'
    and old.closed_at is null
    and new.closed_at is not null;

  if old.first_ballot_at is not null then
    if new.first_ballot_at is distinct from old.first_ballot_at
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.closes_at is distinct from old.closes_at
      or new.published_at is distinct from old.published_at
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      or (new.status is distinct from old.status and not valid_close_transition)
      or (new.closed_at is distinct from old.closed_at and not valid_close_transition) then
      raise exception 'Votes with ballots are permanent' using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_community_vote_option_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_vote_locked boolean := false;
  new_vote_locked boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select vote.first_ballot_at is not null into old_vote_locked
    from public.community_votes vote
    where vote.id = old.vote_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select vote.first_ballot_at is not null into new_vote_locked
    from public.community_votes vote
    where vote.id = new.vote_id;
  end if;

  if coalesce(old_vote_locked, false) or coalesce(new_vote_locked, false) then
    raise exception 'Options for votes with ballots are permanent' using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_community_vote_after_ballot on public.community_votes;
create trigger protect_community_vote_after_ballot
before update or delete on public.community_votes
for each row execute function public.enforce_community_vote_lock();

drop trigger if exists protect_community_vote_options_after_ballot on public.community_vote_options;
create trigger protect_community_vote_options_after_ballot
before insert or update or delete on public.community_vote_options
for each row execute function public.enforce_community_vote_option_lock();
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
    vote.published_at desc nulls last,
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
      and vote.first_ballot_at is null
      and not exists (select 1 from public.community_vote_ballots ballot where ballot.vote_id = vote.id)
    ) as can_edit,
    (
      vote.first_ballot_at is null
      and not exists (select 1 from public.community_vote_ballots ballot where ballot.vote_id = vote.id)
    ) as can_delete
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
  if p_closes_at is null or p_closes_at <= clock_timestamp() then
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
    case when p_publish then clock_timestamp() else null end
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
  if p_closes_at is null or p_closes_at <= clock_timestamp() then
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
  if p_closes_at <= clock_timestamp() then
    raise exception 'Vote closing time must still be in the future' using errcode = '22023';
  end if;
  if selected_vote.status = 'closed'
    or (selected_vote.status = 'published' and selected_vote.closes_at <= clock_timestamp()) then
    raise exception 'Closed votes cannot be edited' using errcode = '55000';
  end if;
  if selected_vote.first_ballot_at is not null
    or exists (select 1 from public.community_vote_ballots ballot where ballot.vote_id = target_vote_id) then
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
        when selected_vote.status = 'draft' and p_publish then clock_timestamp()
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
  set status = 'closed', closed_at = clock_timestamp()
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
  if selected_vote.first_ballot_at is not null
    or exists (select 1 from public.community_vote_ballots ballot where ballot.vote_id = target_vote_id) then
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
  if selected_vote.status <> 'published' or selected_vote.closes_at <= clock_timestamp() then
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

  update public.community_votes
  set first_ballot_at = coalesce(first_ballot_at, clock_timestamp())
  where community_votes.id = target_vote_id;

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
      updated_at = clock_timestamp();

  return target_option_id;
end;
$$;

revoke all on function public.enforce_community_vote_lock() from public, anon, authenticated;
revoke all on function public.enforce_community_vote_option_lock() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
