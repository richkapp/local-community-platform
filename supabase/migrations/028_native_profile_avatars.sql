begin;

-- Native avatars use one opaque, stable object per member. The random path keeps
-- auth user ids out of public asset URLs while Storage policies still bind the
-- object to the authenticated profile that reserved it.
alter table public.profiles
  add column if not exists avatar_path text;

alter table public.profiles
  drop constraint if exists profiles_avatar_path_format;

alter table public.profiles
  add constraint profiles_avatar_path_format check (
    avatar_path is null
    or avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
  );

do $$
declare
  avatar_bucket storage.buckets%rowtype;
begin
  select * into avatar_bucket
  from storage.buckets
  where id = 'avatars';

  if found then
    if avatar_bucket.public is distinct from true
      or avatar_bucket.file_size_limit is distinct from 524288
      or avatar_bucket.allowed_mime_types is distinct from array['image/webp']::text[] then
      raise exception 'Existing avatars bucket has incompatible visibility or upload limits. Audit it and reconcile through separately reviewed forward SQL before applying migration 028.'
        using errcode = 'P0001';
    end if;
  else
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', true, 524288, array['image/webp']);
  end if;
end;
$$;

create or replace function public.reserve_my_avatar_path()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_path text;
begin
  if not public.is_active_member() then
    raise exception 'Active member account required' using errcode = '42501';
  end if;

  update public.profiles
  set avatar_path = coalesce(avatar_path, gen_random_uuid()::text || '.webp')
  where id = auth.uid()
  returning avatar_path into result_path;

  if result_path is null then
    raise exception 'Member profile not found' using errcode = 'P0002';
  end if;

  return result_path;
end;
$$;

create or replace function public.confirm_my_avatar_upload(p_path text)
returns table (
  avatar_path text,
  avatar_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_path text;
  result_path text;
  result_updated_at timestamptz;
begin
  if not public.is_active_member() then
    raise exception 'Active member account required' using errcode = '42501';
  end if;

  select profiles.avatar_path
  into current_path
  from public.profiles
  where profiles.id = auth.uid()
  for update;

  if current_path is null or current_path <> p_path then
    raise exception 'Avatar path does not belong to this member' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from storage.objects
    where objects.bucket_id = 'avatars'
      and objects.name = current_path
      and objects.owner_id = auth.uid()::text
  ) then
    raise exception 'Avatar upload is missing' using errcode = 'P0002';
  end if;

  update public.profiles
  set avatar_path = current_path,
      avatar_url = null
  where id = auth.uid()
  returning profiles.avatar_path, profiles.updated_at
  into result_path, result_updated_at;

  return query select result_path, result_updated_at;
end;
$$;

create or replace function public.clear_my_avatar_path(p_path text)
returns table (
  avatar_path text,
  avatar_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_path text;
  result_path text;
  result_updated_at timestamptz;
begin
  if not public.is_active_member() then
    raise exception 'Active member account required' using errcode = '42501';
  end if;

  select profiles.avatar_path
  into current_path
  from public.profiles
  where profiles.id = auth.uid()
  for update;

  if current_path is null then
    if p_path is not null then
      raise exception 'Avatar path does not belong to this member' using errcode = '42501';
    end if;
  elsif current_path <> p_path then
    raise exception 'Avatar path does not belong to this member' using errcode = '42501';
  elsif exists (
    select 1
    from storage.objects
    where objects.bucket_id = 'avatars'
      and objects.name = current_path
  ) then
    raise exception 'Delete the avatar object before clearing the profile' using errcode = '23514';
  end if;

  update public.profiles
  set avatar_path = null,
      avatar_url = null
  where id = auth.uid()
  returning profiles.avatar_path, profiles.updated_at
  into result_path, result_updated_at;

  return query select result_path, result_updated_at;
end;
$$;

-- Upsert needs metadata SELECT plus INSERT/UPDATE. Every write policy resolves
-- the one opaque path previously reserved on the caller's active profile.
drop policy if exists "Members read own avatar metadata" on storage.objects;
create policy "Members read own avatar metadata"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and name = (
    select profiles.avatar_path
    from public.profiles
    where profiles.id = auth.uid()
  )
);

drop policy if exists "Active members upload own avatar" on storage.objects;
create policy "Active members upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and public.is_active_member()
  and name = (
    select profiles.avatar_path
    from public.profiles
    where profiles.id = auth.uid()
  )
);

drop policy if exists "Active members replace own avatar" on storage.objects;
create policy "Active members replace own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and public.is_active_member()
  and name = (
    select profiles.avatar_path
    from public.profiles
    where profiles.id = auth.uid()
  )
)
with check (
  bucket_id = 'avatars'
  and public.is_active_member()
  and name = (
    select profiles.avatar_path
    from public.profiles
    where profiles.id = auth.uid()
  )
);

drop policy if exists "Active members delete own avatar" on storage.objects;
create policy "Active members delete own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and public.is_active_member()
  and name = (
    select profiles.avatar_path
    from public.profiles
    where profiles.id = auth.uid()
  )
);

-- Account deletion removes the avatar through the Storage API first. Give only
-- super admins the metadata/delete permissions needed for that cleanup.
drop policy if exists "Super admins read avatar metadata" on storage.objects;
create policy "Super admins read avatar metadata"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and public.is_super_admin()
);

drop policy if exists "Super admins delete member avatars" on storage.objects;
create policy "Super admins delete member avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and public.is_super_admin()
);

-- Append only public-safe avatar metadata. Legacy avatar_url values continue to
-- render until a member uploads or removes a native avatar.
create or replace view public.public_profiles as
select
  handle,
  display_name,
  bio,
  avatar_url,
  website_url,
  linkedin_url,
  github_url,
  x_url,
  avatar_path,
  updated_at as avatar_updated_at
from public.profiles
where is_public = true;

create or replace view public.idea_public_authors as
select
  ideas.id as idea_id,
  profiles.handle,
  profiles.display_name,
  profiles.avatar_url,
  profiles.bio,
  profiles.website_url,
  profiles.linkedin_url,
  profiles.github_url,
  profiles.x_url,
  profiles.avatar_path,
  profiles.updated_at as avatar_updated_at
from public.ideas
join public.profiles on profiles.id = ideas.author_id
where profiles.is_public = true
  and ideas.status <> 'hidden';

-- Keep organizer member cards in sync without exposing the avatar path through
-- any broader table grant.
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
  profile_updated_at timestamptz,
  avatar_path text,
  avatar_updated_at timestamptz
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
    p.updated_at,
    p.avatar_path,
    p.updated_at
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

-- Enforce cleanup at the database boundary too. The short table lock closes
-- the race where the target could upload again between cleanup and deletion.
create or replace function public.super_admin_delete_member(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_target_role public.member_role;
  current_avatar_path text;
begin
  if not public.is_super_admin() then
    raise exception 'Super-admin access required' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'You cannot delete your own account' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('member-admin:' || target_user_id::text, 0));
  select profiles.role, profiles.avatar_path
  into current_target_role, current_avatar_path
  from public.profiles
  where profiles.id = target_user_id
  for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if current_target_role = 'super_admin' then
    raise exception 'Super-admin accounts cannot be deleted here' using errcode = '42501';
  end if;

  lock table storage.objects in share row exclusive mode;
  if current_avatar_path is not null and exists (
    select 1
    from storage.objects
    where objects.bucket_id = 'avatars'
      and objects.name = current_avatar_path
  ) then
    raise exception 'Delete the member avatar before deleting the account' using errcode = '23514';
  end if;

  delete from auth.users where id = target_user_id;
  if not found then
    raise exception 'Auth account not found' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.reserve_my_avatar_path() from public, anon;
revoke all on function public.confirm_my_avatar_upload(text) from public, anon;
revoke all on function public.clear_my_avatar_path(text) from public, anon;
revoke all on function public.admin_list_members() from public, anon;
revoke all on function public.super_admin_delete_member(uuid) from public, anon;
grant execute on function public.reserve_my_avatar_path() to authenticated;
grant execute on function public.confirm_my_avatar_upload(text) to authenticated;
grant execute on function public.clear_my_avatar_path(text) to authenticated;
grant execute on function public.admin_list_members() to authenticated;
grant execute on function public.super_admin_delete_member(uuid) to authenticated;

grant select (avatar_path) on table public.profiles to authenticated;
revoke update (avatar_url) on table public.profiles from authenticated;
grant select on table public.public_profiles to anon, authenticated;
grant select on table public.idea_public_authors to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
