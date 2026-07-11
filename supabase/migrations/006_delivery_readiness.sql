begin;

-- Final production hardening for the community-delivery rollout. Migration 005
-- establishes the baseline objects; this forward migration narrows mutation
-- grants and makes invite delivery retry-safe.

-- Members may edit only public profile fields. Role changes remain a
-- service-role/maintenance operation even when a client crafts direct REST.
revoke update on table public.profiles from authenticated;
grant update (
  handle,
  display_name,
  bio,
  avatar_url,
  website_url,
  linkedin_url,
  github_url,
  is_public
) on table public.profiles to authenticated;

-- Authors can edit an open idea but cannot select, close, or hide it themselves.
drop policy if exists "Authors update open ideas" on public.ideas;
create policy "Authors update open ideas" on public.ideas
for update to authenticated
using (author_id = auth.uid() and status = 'open')
with check (author_id = auth.uid() and status = 'open');

-- Normalize meaningful text rather than accepting strings made only of spaces.
alter table public.ideas
  add constraint ideas_title_trimmed_length
    check (char_length(btrim(title)) between 4 and 120) not valid,
  add constraint ideas_body_trimmed_length
    check (char_length(btrim(body)) between 10 and 2000) not valid;

alter table public.event_registrations
  add constraint event_registration_note_length
    check (char_length(note) <= 500) not valid;

alter table public.ideas validate constraint ideas_title_trimmed_length;
alter table public.ideas validate constraint ideas_body_trimmed_length;
alter table public.event_registrations validate constraint event_registration_note_length;

-- Event registration is RPC-only. This removes the production bypass where a
-- member could insert directly into a draft/closed/full event.
drop policy if exists "Members register for events" on public.event_registrations;
drop policy if exists "Members cancel own registration" on public.event_registrations;
revoke insert, update on table public.event_registrations from authenticated;

drop function if exists public.register_for_event(uuid, text);

create function public.register_for_event(
  target_event_id uuid,
  registration_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  selected_event public.events%rowtype;
  existing_registration public.event_registrations%rowtype;
  active_count integer;
  result_id uuid;
  normalized_note text := btrim(coalesce(registration_note, ''));
begin
  if current_user_id is null then
    raise exception 'authentication required';
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

create or replace function public.cancel_event_registration(target_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  result_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  update public.event_registrations
  set status = 'cancelled', updated_at = now()
  where event_id = target_event_id
    and user_id = current_user_id
    and status in ('registered', 'waitlisted')
  returning id into result_id;

  if result_id is null then
    raise exception 'active registration not found';
  end if;

  return result_id;
end;
$$;

revoke all on function public.register_for_event(uuid, text) from public, anon;
revoke all on function public.cancel_event_registration(uuid) from public, anon;
grant execute on function public.register_for_event(uuid, text) to authenticated, service_role;
grant execute on function public.cancel_event_registration(uuid) to authenticated, service_role;

-- Retry-safe invite delivery. Existing production rows are treated as completed
-- redemptions; new rows move through reserved -> completed/failed.
alter table public.invite_redemptions
  add column if not exists delivery_status text,
  add column if not exists failed_at timestamptz,
  add column if not exists consumes_capacity boolean;

update public.invite_redemptions
set delivery_status = case when completed_at is not null then 'completed' else 'failed' end,
    consumes_capacity = false
where delivery_status is null or consumes_capacity is null;

alter table public.invite_redemptions
  alter column delivery_status set default 'completed',
  alter column delivery_status set not null,
  alter column consumes_capacity set default false,
  alter column consumes_capacity set not null;

alter table public.invite_redemptions
  add constraint invite_redemptions_delivery_status_check
    check (delivery_status in ('reserved', 'completed', 'failed')) not valid;
alter table public.invite_redemptions validate constraint invite_redemptions_delivery_status_check;

create unique index if not exists invite_redemptions_invite_email_unique
on public.invite_redemptions (invite_id, lower(email));

create or replace function public.reserve_invite_for_email(
  invite_code text,
  invite_email text,
  request_ip text default null,
  request_user_agent text default null
)
returns table (redemption_id uuid, code text, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := lower(btrim(invite_code));
  normalized_email text := lower(btrim(invite_email));
  selected_invite public.invites%rowtype;
  existing_redemption public.invite_redemptions%rowtype;
  active_reservations integer;
  recent_ip_requests integer;
  parsed_ip inet;
begin
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid email';
  end if;

  begin
    parsed_ip := nullif(btrim(request_ip), '')::inet;
  exception when invalid_text_representation then
    parsed_ip := null;
  end;

  select * into selected_invite
  from public.invites
  where public.invites.code = normalized_code
  for update;

  if not found
    or selected_invite.revoked_at is not null
    or (selected_invite.expires_at is not null and selected_invite.expires_at <= now()) then
    raise exception 'invite is not active';
  end if;

  select * into existing_redemption
  from public.invite_redemptions
  where invite_id = selected_invite.id
    and lower(public.invite_redemptions.email) = normalized_email
  for update;

  if existing_redemption.id is not null then
    if existing_redemption.requested_at > now() - interval '10 minutes'
      and existing_redemption.delivery_status in ('reserved', 'completed') then
      raise exception 'wait before requesting another link';
    end if;

    update public.invite_redemptions
    set requested_at = now(),
        request_ip = parsed_ip,
        user_agent = left(request_user_agent, 500),
        delivery_status = 'reserved',
        failed_at = null,
        consumes_capacity = (existing_redemption.completed_at is null)
    where id = existing_redemption.id
    returning id into redemption_id;

    code := selected_invite.code;
    email := normalized_email;
    return next;
    return;
  end if;

  if parsed_ip is not null then
    select count(*)::integer into recent_ip_requests
    from public.invite_redemptions
    where public.invite_redemptions.request_ip = parsed_ip
      and requested_at > now() - interval '10 minutes';
    if recent_ip_requests >= 10 then
      raise exception 'too many invite requests';
    end if;
  end if;

  select count(*)::integer into active_reservations
  from public.invite_redemptions
  where invite_id = selected_invite.id
    and delivery_status = 'reserved'
    and consumes_capacity
    and requested_at > now() - interval '15 minutes';

  if selected_invite.max_uses is not null
    and selected_invite.uses_count + active_reservations >= selected_invite.max_uses then
    raise exception 'invite use limit reached';
  end if;

  insert into public.invite_redemptions (
    invite_id,
    email,
    requested_at,
    request_ip,
    user_agent,
    delivery_status,
    consumes_capacity
  ) values (
    selected_invite.id,
    normalized_email,
    now(),
    parsed_ip,
    left(request_user_agent, 500),
    'reserved',
    true
  )
  returning id into redemption_id;

  code := selected_invite.code;
  email := normalized_email;
  return next;
end;
$$;

create or replace function public.complete_invite_redemption(target_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_redemption public.invite_redemptions%rowtype;
  selected_invite public.invites%rowtype;
begin
  select * into selected_redemption
  from public.invite_redemptions
  where id = target_redemption_id
  for update;

  if not found or selected_redemption.delivery_status <> 'reserved' then
    raise exception 'invite reservation not found';
  end if;

  select * into selected_invite
  from public.invites
  where id = selected_redemption.invite_id
  for update;

  if selected_redemption.consumes_capacity then
    if selected_invite.max_uses is not null and selected_invite.uses_count >= selected_invite.max_uses then
      raise exception 'invite use limit reached';
    end if;
    update public.invites set uses_count = uses_count + 1 where id = selected_invite.id;
  end if;

  update public.invite_redemptions
  set delivery_status = 'completed',
      completed_at = coalesce(completed_at, now()),
      failed_at = null,
      consumes_capacity = false
  where id = target_redemption_id;
end;
$$;

create or replace function public.fail_invite_redemption(target_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invite_redemptions
  set delivery_status = 'failed',
      failed_at = now(),
      consumes_capacity = false
  where id = target_redemption_id
    and delivery_status = 'reserved';
end;
$$;

revoke all on function public.reserve_invite_for_email(text, text, text, text) from public, anon, authenticated;
revoke all on function public.complete_invite_redemption(uuid) from public, anon, authenticated;
revoke all on function public.fail_invite_redemption(uuid) from public, anon, authenticated;
grant execute on function public.reserve_invite_for_email(text, text, text, text) to service_role;
grant execute on function public.complete_invite_redemption(uuid) to service_role;
grant execute on function public.fail_invite_redemption(uuid) to service_role;

-- Remove the one-phase function so invite capacity cannot be consumed before
-- email acceptance through an old client.
drop function if exists public.redeem_invite_for_email(text, text, text, text);

update public.invites
set revoked_at = coalesce(revoked_at, now())
where code = 'braga-whatsapp';

notify pgrst, 'reload schema';

commit;
