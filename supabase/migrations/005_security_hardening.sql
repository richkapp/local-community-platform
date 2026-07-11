-- Launch hardening after pre-ship security/runtime review.
-- Keeps public data intentionally narrow and moves fragile client-side checks into DB-enforced seams.

-- URL fields must be ordinary http(s) links before any client renders them as href/src.
create or replace function public.is_http_url(value text)
returns boolean
language sql
immutable
as $$
  select value is null or value ~* '^https?://[^[:space:]]+$';
$$;

alter table public.profiles
  drop constraint if exists profiles_avatar_url_http,
  drop constraint if exists profiles_website_url_http,
  drop constraint if exists profiles_linkedin_url_http,
  drop constraint if exists profiles_github_url_http;

alter table public.profiles
  add constraint profiles_avatar_url_http check (public.is_http_url(avatar_url)),
  add constraint profiles_website_url_http check (public.is_http_url(website_url)),
  add constraint profiles_linkedin_url_http check (public.is_http_url(linkedin_url)),
  add constraint profiles_github_url_http check (public.is_http_url(github_url));

-- Do not expose authorization columns through public profile reads.
drop view if exists public.public_profiles;
create view public.public_profiles as
select
  handle,
  display_name,
  bio,
  avatar_url,
  website_url,
  linkedin_url,
  github_url
from public.profiles
where is_public = true;

-- Prevent members from self-promoting to admin even if a future grant/policy broadens updates.
create or replace function public.prevent_member_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Members cannot change their own role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_member_role_change on public.profiles;
create trigger profiles_prevent_member_role_change
before update on public.profiles
for each row execute function public.prevent_member_role_change();

-- Tighten profile RLS to safe public reads + self/admin, and require member-created rows to stay member.
drop policy if exists "Public profiles are readable" on public.profiles;
drop policy if exists "Members insert own profile" on public.profiles;
drop policy if exists "Members update own profile" on public.profiles;
drop policy if exists "Admins manage profiles" on public.profiles;

create policy "Safe public profiles are readable" on public.profiles
for select using (is_public = true or id = auth.uid() or public.is_admin());

create policy "Members insert own member profile" on public.profiles
for insert with check (id = auth.uid() and role = 'member');

create policy "Members update own non-role profile fields" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid() and role = 'member');

create policy "Admins manage profiles" on public.profiles
for all using (public.is_admin()) with check (public.is_admin());

-- Keep table privileges column-scoped where possible. RLS still decides rows.
revoke select on table public.profiles from anon, authenticated;
revoke update on table public.profiles from authenticated;
grant select (handle, display_name, bio, avatar_url, website_url, linkedin_url, github_url) on table public.profiles to anon;
grant select (id, handle, display_name, bio, avatar_url, website_url, linkedin_url, github_url, is_public, created_at, updated_at) on table public.profiles to authenticated;
grant update (handle, display_name, bio, avatar_url, website_url, linkedin_url, github_url, is_public) on table public.profiles to authenticated;
grant select on table public.public_profiles to anon, authenticated;

-- Atomic invite redemption + cooldown. The Edge Function sends email only after this reservation succeeds.
create unique index if not exists invite_redemptions_invite_email_unique
on public.invite_redemptions (invite_id, lower(email));

create or replace function public.redeem_invite_for_email(
  invite_code text,
  invite_email text,
  request_ip inet default null,
  request_user_agent text default null
)
returns table(invite_id uuid, code text, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invite public.invites%rowtype;
  existing_redemption public.invite_redemptions%rowtype;
  normalized_email text := lower(trim(invite_email));
  normalized_code text := lower(trim(invite_code));
begin
  if normalized_email = '' or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address';
  end if;

  if normalized_code = '' or normalized_code !~ '^[a-z0-9][a-z0-9-]{3,80}$' then
    raise exception 'Invite link is invalid';
  end if;

  select * into target_invite
  from public.invites
  where invites.code = normalized_code
  for update;

  if not found or target_invite.revoked_at is not null then
    raise exception 'Invite link is not active';
  end if;

  if target_invite.expires_at is not null and target_invite.expires_at < now() then
    raise exception 'Invite link has expired';
  end if;

  select * into existing_redemption
  from public.invite_redemptions
  where invite_redemptions.invite_id = target_invite.id
    and lower(invite_redemptions.email) = normalized_email
  for update;

  if found then
    if existing_redemption.requested_at > now() - interval '10 minutes' then
      raise exception 'Please wait before requesting another sign-in email.';
    end if;

    update public.invite_redemptions
    set requested_at = now(), request_ip = redeem_invite_for_email.request_ip, user_agent = request_user_agent
    where id = existing_redemption.id;

    return query select target_invite.id, target_invite.code, normalized_email;
    return;
  end if;

  if target_invite.max_uses is not null and target_invite.uses_count >= target_invite.max_uses then
    raise exception 'Invite link has reached its limit';
  end if;

  insert into public.invite_redemptions (invite_id, email, request_ip, user_agent)
  values (target_invite.id, normalized_email, redeem_invite_for_email.request_ip, request_user_agent);

  update public.invites
  set uses_count = uses_count + 1
  where id = target_invite.id;

  return query select target_invite.id, target_invite.code, normalized_email;
end;
$$;

revoke all on function public.redeem_invite_for_email(text, text, inet, text) from public, anon, authenticated;
grant execute on function public.redeem_invite_for_email(text, text, inet, text) to service_role;

-- Route member registrations through the guarded RPC rather than direct inserts.
drop policy if exists "Members register themselves" on public.event_registrations;
drop policy if exists "Members update own registration" on public.event_registrations;

create policy "Members cancel own registration" on public.event_registrations
for update using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'cancelled');

create or replace function public.register_for_event(
  target_event_id uuid,
  registration_note text default ''
)
returns public.event_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target_event public.events%rowtype;
  existing_registration public.event_registrations%rowtype;
  active_count integer;
  saved_registration public.event_registrations%rowtype;
begin
  if uid is null then
    raise exception 'You need to sign in first.';
  end if;

  select * into target_event
  from public.events
  where id = target_event_id
  for update;

  if not found or target_event.status <> 'published' then
    raise exception 'Registration is not open for this event.';
  end if;

  if target_event.registration_opens_at is not null and target_event.registration_opens_at > now() then
    raise exception 'Registration is not open yet.';
  end if;

  if target_event.registration_closes_at is not null and target_event.registration_closes_at < now() then
    raise exception 'Registration is closed.';
  end if;

  if target_event.starts_at <= now() then
    raise exception 'Registration is closed.';
  end if;

  select * into existing_registration
  from public.event_registrations
  where event_id = target_event_id and user_id = uid
  for update;

  if found and existing_registration.status in ('registered', 'waitlisted') then
    return existing_registration;
  end if;

  select count(*)::integer into active_count
  from public.event_registrations
  where event_id = target_event_id and status in ('registered', 'waitlisted');

  if target_event.capacity is not null and active_count >= target_event.capacity then
    raise exception 'This event is full.';
  end if;

  if found then
    update public.event_registrations
    set status = 'registered', note = coalesce(registration_note, ''), updated_at = now()
    where id = existing_registration.id
    returning * into saved_registration;
  else
    insert into public.event_registrations (event_id, user_id, note)
    values (target_event_id, uid, coalesce(registration_note, ''))
    returning * into saved_registration;
  end if;

  return saved_registration;
end;
$$;

revoke all on function public.register_for_event(uuid, text) from public, anon;
grant execute on function public.register_for_event(uuid, text) to authenticated;

-- Aggregate views expose only rows that are visible as public activity.
create or replace view public.idea_vote_counts as
select ideas.id as idea_id, count(idea_votes.user_id)::integer as upvote_count
from public.ideas
left join public.idea_votes on idea_votes.idea_id = ideas.id
where ideas.status <> 'hidden'
group by ideas.id;

create or replace view public.event_registration_counts as
select events.id as event_id,
  count(event_registrations.id) filter (where event_registrations.status in ('registered', 'waitlisted'))::integer as registration_count
from public.events
left join public.event_registrations on event_registrations.event_id = events.id
where events.status in ('published', 'completed')
group by events.id;

grant select on table public.idea_vote_counts to anon, authenticated;
grant select on table public.event_registration_counts to anon, authenticated;

-- The old public/default code was fine for local smoke tests but not for production invite-gating.
update public.invites
set revoked_at = coalesce(revoked_at, now())
where code = 'braga-whatsapp';
