begin;

alter table public.profiles
  add column if not exists suspended_at timestamptz;

create index if not exists profiles_suspended_at_idx
  on public.profiles (suspended_at)
  where suspended_at is not null;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
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
  select exists (
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
  select exists (
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
    and profiles.suspended_at is null;
$$;

revoke all on function public.is_active_member() from public, anon;
revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.current_member_role() from public, anon;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.current_member_role() to authenticated;

-- Suspended accounts may still read public content, but cannot mutate community data.
drop policy if exists "Members update own non-role profile fields" on public.profiles;
create policy "Members update own non-role profile fields" on public.profiles
for update to authenticated
using (id = auth.uid() and public.is_active_member())
with check (id = auth.uid() and role = 'member' and public.is_active_member());

drop policy if exists "Members create ideas" on public.ideas;
create policy "Members create ideas" on public.ideas
for insert to authenticated
with check (author_id = auth.uid() and status = 'open' and public.is_active_member());

drop policy if exists "Authors update open ideas" on public.ideas;
create policy "Authors update open ideas" on public.ideas
for update to authenticated
using (author_id = auth.uid() and status = 'open' and public.is_active_member())
with check (author_id = auth.uid() and status = 'open' and public.is_active_member());

drop policy if exists "Members upvote as themselves" on public.idea_votes;
create policy "Members upvote as themselves" on public.idea_votes
for insert to authenticated
with check (user_id = auth.uid() and public.is_active_member());

drop policy if exists "Members remove own upvote" on public.idea_votes;
create policy "Members remove own upvote" on public.idea_votes
for delete to authenticated
using (user_id = auth.uid() and public.is_active_member());

drop policy if exists "Members cancel own registration" on public.event_registrations;
create policy "Members cancel own registration" on public.event_registrations
for update to authenticated
using (user_id = auth.uid() and public.is_active_member())
with check (user_id = auth.uid() and status = 'cancelled' and public.is_active_member());

create or replace function public.register_for_event(
  target_event_id uuid,
  registration_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_event public.events%rowtype;
  existing_registration public.event_registrations%rowtype;
  active_count integer;
  result_id uuid;
  normalized_note text := btrim(coalesce(registration_note, ''));
begin
  if current_user_id is null or public.is_anonymous_user() then
    raise exception 'community account required';
  end if;
  if not public.is_active_member() then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  if char_length(normalized_note) > 500 then
    raise exception 'registration note is too long';
  end if;

  select * into selected_event
  from public.events
  where id = target_event_id
  for update;

  if not found or selected_event.status <> 'published' then
    raise exception 'event is not open for registration';
  end if;
  if selected_event.registration_opens_at is not null and selected_event.registration_opens_at > now() then
    raise exception 'registration is not open yet';
  end if;
  if selected_event.registration_closes_at is not null and selected_event.registration_closes_at < now() then
    raise exception 'registration is closed';
  end if;
  if selected_event.starts_at <= now() then
    raise exception 'registration is closed';
  end if;

  select * into existing_registration
  from public.event_registrations
  where event_id = target_event_id and user_id = current_user_id
  for update;

  if found and existing_registration.status in ('registered', 'waitlisted') then
    raise exception 'already registered';
  end if;

  select count(*)::integer into active_count
  from public.event_registrations
  where event_id = target_event_id
    and status in ('registered', 'waitlisted');

  if selected_event.capacity is not null and active_count >= selected_event.capacity then
    raise exception 'event is full';
  end if;

  if existing_registration.id is not null then
    update public.event_registrations
    set status = 'registered', note = normalized_note, updated_at = now()
    where id = existing_registration.id
    returning id into result_id;
  else
    insert into public.event_registrations (event_id, user_id, status, note)
    values (target_event_id, current_user_id, 'registered', normalized_note)
    returning id into result_id;
  end if;

  return result_id;
end;
$$;

-- Return private account data to organizers, including suspension state.
drop function if exists public.admin_list_members();
create function public.admin_list_members()
returns table (
  id uuid,
  email text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  auth_created_at timestamptz,
  handle text,
  display_name text,
  bio text,
  avatar_url text,
  website_url text,
  linkedin_url text,
  github_url text,
  x_url text,
  role text,
  is_public boolean,
  suspended_at timestamptz,
  profile_created_at timestamptz,
  profile_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    u.email::text,
    u.email_confirmed_at,
    u.last_sign_in_at,
    u.created_at,
    p.handle,
    p.display_name,
    p.bio,
    p.avatar_url,
    p.website_url,
    p.linkedin_url,
    p.github_url,
    p.x_url,
    p.role::text,
    p.is_public,
    p.suspended_at,
    p.created_at,
    p.updated_at
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

create or replace function public.super_admin_set_member_role(
  target_user_id uuid,
  target_role public.member_role
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_target_role public.member_role;
begin
  if not public.is_super_admin() then
    raise exception 'Super-admin access required' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  if target_role is null or target_role::text not in ('member', 'admin') then
    raise exception 'Only member and admin roles can be assigned' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('member-admin:' || target_user_id::text, 0));
  select role into current_target_role
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if current_target_role = 'super_admin' then
    raise exception 'Super-admin accounts cannot be changed here' using errcode = '42501';
  end if;

  update public.profiles
  set role = target_role
  where id = target_user_id;

  return target_role::text;
end;
$$;

create or replace function public.super_admin_set_member_suspension(
  target_user_id uuid,
  should_suspend boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_target_role public.member_role;
  result_suspended_at timestamptz;
begin
  if not public.is_super_admin() then
    raise exception 'Super-admin access required' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'You cannot suspend your own account' using errcode = '42501';
  end if;
  if should_suspend is null then
    raise exception 'Suspension state is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('member-admin:' || target_user_id::text, 0));
  select role into current_target_role
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if current_target_role = 'super_admin' then
    raise exception 'Super-admin accounts cannot be suspended here' using errcode = '42501';
  end if;

  result_suspended_at := case when should_suspend then now() else null end;

  update public.profiles
  set suspended_at = result_suspended_at
  where id = target_user_id;

  update auth.users
  set banned_until = case when should_suspend then now() + interval '100 years' else null end,
      updated_at = now()
  where id = target_user_id;

  if not found then
    raise exception 'Auth account not found' using errcode = 'P0002';
  end if;

  return result_suspended_at;
end;
$$;

create or replace function public.super_admin_delete_member(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_target_role public.member_role;
begin
  if not public.is_super_admin() then
    raise exception 'Super-admin access required' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'You cannot delete your own account' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('member-admin:' || target_user_id::text, 0));
  select role into current_target_role
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if current_target_role = 'super_admin' then
    raise exception 'Super-admin accounts cannot be deleted here' using errcode = '42501';
  end if;

  delete from auth.users where id = target_user_id;
  if not found then
    raise exception 'Auth account not found' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.admin_list_members() from public, anon;
revoke all on function public.super_admin_set_member_role(uuid, public.member_role) from public, anon;
revoke all on function public.super_admin_set_member_suspension(uuid, boolean) from public, anon;
revoke all on function public.super_admin_delete_member(uuid) from public, anon;
grant execute on function public.admin_list_members() to authenticated;
grant execute on function public.super_admin_set_member_role(uuid, public.member_role) to authenticated;
grant execute on function public.super_admin_set_member_suspension(uuid, boolean) to authenticated;
grant execute on function public.super_admin_delete_member(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
