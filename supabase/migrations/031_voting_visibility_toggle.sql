begin;

create table public.community_feature_flags (
  feature_key text primary key,
  is_enabled boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_feature_flags_key_check
    check (feature_key ~ '^[a-z][a-z0-9_]{1,63}$')
);

comment on table public.community_feature_flags is
  'Private runtime feature visibility controlled through narrow public/admin RPCs.';

insert into public.community_feature_flags (feature_key, is_enabled)
values ('voting', true)
on conflict (feature_key) do nothing;

create trigger community_feature_flags_set_updated_at
before update on public.community_feature_flags
for each row execute function public.set_updated_at();

alter table public.community_feature_flags enable row level security;
revoke all on table public.community_feature_flags from public, anon, authenticated;
grant all privileges on table public.community_feature_flags to service_role;

create or replace function public.get_voting_feature_access()
returns table (
  is_enabled boolean,
  viewer_is_admin boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select flag.is_enabled
      from public.community_feature_flags flag
      where flag.feature_key = 'voting'
    ), false) as is_enabled,
    public.is_admin() as viewer_is_admin;
$$;

create or replace function public.admin_set_voting_feature_enabled(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'Voting visibility must be on or off' using errcode = '22023';
  end if;

  insert into public.community_feature_flags (
    feature_key,
    is_enabled,
    updated_by
  ) values (
    'voting',
    p_enabled,
    auth.uid()
  )
  on conflict (feature_key) do update
  set is_enabled = excluded.is_enabled,
      updated_by = excluded.updated_by;

  return p_enabled;
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
  with access as (
    select
      coalesce((
        select flag.is_enabled
        from public.community_feature_flags flag
        where flag.feature_key = 'voting'
      ), false) as is_enabled,
      public.is_admin() as viewer_is_admin
  )
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
      and access.is_enabled
    ) as viewer_can_vote
  from public.community_votes vote
  cross join access
  where vote.status in ('published', 'closed')
    and (access.is_enabled or access.viewer_is_admin)
  order by
    case when vote.status = 'published' and vote.closes_at > now() then 0 else 1 end,
    vote.published_at desc nulls last,
    vote.created_at desc;
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
  voting_is_enabled boolean := false;
begin
  if current_user_id is null or public.is_anonymous_user() then
    raise exception 'Community account required' using errcode = '42501';
  end if;
  if not public.is_active_member() then
    raise exception 'Active member access required' using errcode = '42501';
  end if;

  select flag.is_enabled into voting_is_enabled
  from public.community_feature_flags flag
  where flag.feature_key = 'voting'
  for share;

  if not coalesce(voting_is_enabled, false) then
    raise exception 'Voting is unavailable' using errcode = '55000';
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

revoke all on function public.get_voting_feature_access() from public, anon, authenticated;
revoke all on function public.admin_set_voting_feature_enabled(boolean) from public, anon, authenticated;
revoke all on function public.list_public_community_votes() from public, anon, authenticated;
revoke all on function public.submit_community_ballot(uuid, uuid, boolean) from public, anon, authenticated;

grant execute on function public.get_voting_feature_access() to anon, authenticated;
grant execute on function public.admin_set_voting_feature_enabled(boolean) to authenticated;
grant execute on function public.list_public_community_votes() to anon, authenticated;
grant execute on function public.submit_community_ballot(uuid, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
