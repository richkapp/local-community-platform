begin;

alter table public.profiles
  add column if not exists x_url text;

alter table public.profiles
  drop constraint if exists profiles_x_url_http;

alter table public.profiles
  add constraint profiles_x_url_http check (public.is_http_url(x_url));

create or replace view public.public_profiles as
select
  handle,
  display_name,
  bio,
  avatar_url,
  website_url,
  linkedin_url,
  github_url,
  x_url
from public.profiles
where is_public = true;

grant select (x_url) on table public.profiles to anon, authenticated;
grant update (x_url) on table public.profiles to authenticated;
grant select on table public.public_profiles to anon, authenticated;

notify pgrst, 'reload schema';

commit;
