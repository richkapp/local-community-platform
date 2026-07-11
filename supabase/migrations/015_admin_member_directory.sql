begin;

create or replace function public.admin_list_members()
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
  profile_created_at timestamptz,
  profile_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
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
    p.created_at,
    p.updated_at
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_members() from public, anon;
grant execute on function public.admin_list_members() to authenticated;

commit;
