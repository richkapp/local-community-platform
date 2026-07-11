create extension if not exists pgcrypto;

create type public.member_role as enum ('member', 'admin');
create type public.idea_status as enum ('open', 'selected', 'closed', 'hidden');
create type public.event_status as enum ('draft', 'published', 'cancelled', 'completed');
create type public.registration_status as enum ('registered', 'waitlisted', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text not null default 'New builder',
  bio text not null default '',
  avatar_url text,
  website_url text,
  linkedin_url text,
  github_url text,
  x_url text,
  role public.member_role not null default 'member',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format check (handle is null or handle ~ '^[a-z0-9][a-z0-9-]{2,30}$')
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  max_uses integer,
  uses_count integer not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invites_code_format check (code ~ '^[a-z0-9][a-z0-9-]{3,80}$'),
  constraint invites_max_uses_positive check (max_uses is null or max_uses > 0),
  constraint invites_uses_nonnegative check (uses_count >= 0)
);

create table public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invites(id) on delete cascade,
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  request_ip inet,
  user_agent text
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null,
  month_key text not null,
  status public.idea_status not null default 'open',
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ideas_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{2,100}$'),
  constraint ideas_title_length check (char_length(title) between 4 and 120),
  constraint ideas_body_length check (char_length(body) between 10 and 2000),
  constraint ideas_month_key_format check (month_key ~ '^\\d{4}-\\d{2}$')
);

create table public.idea_votes (
  idea_id uuid not null references public.ideas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_name text,
  location_url text,
  capacity integer,
  status public.event_status not null default 'draft',
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{2,100}$'),
  constraint events_capacity_positive check (capacity is null or capacity > 0)
);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.registration_status not null default 'registered',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create or replace view public.idea_vote_counts as
select ideas.id as idea_id, count(idea_votes.user_id)::integer as upvote_count
from public.ideas
left join public.idea_votes on idea_votes.idea_id = ideas.id
group by ideas.id;

create or replace view public.event_registration_counts as
select events.id as event_id,
  count(event_registrations.id) filter (where event_registrations.status in ('registered', 'waitlisted'))::integer as registration_count
from public.events
left join public.event_registrations on event_registrations.event_id = events.id
group by events.id;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger ideas_set_updated_at before update on public.ideas
for each row execute function public.set_updated_at();

create trigger events_set_updated_at before update on public.events
for each row execute function public.set_updated_at();

create trigger event_registrations_set_updated_at before update on public.event_registrations
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
begin
  base_handle := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1), 'builder'), '[^a-zA-Z0-9]+', '-', 'g'));
  base_handle := trim(both '-' from base_handle);
  if char_length(base_handle) < 3 then
    base_handle := 'builder-' || substr(new.id::text, 1, 8);
  end if;

  insert into public.profiles (id, handle, display_name)
  values (new.id, base_handle || '-' || substr(new.id::text, 1, 4), coalesce(new.raw_user_meta_data->>'display_name', 'New builder'))
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
