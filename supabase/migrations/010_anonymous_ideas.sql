begin;

-- Anonymous idea participation uses an authenticated Supabase identity with no
-- email, password, or directory presence. Keep member profiles and events
-- permanent-account-only at the database boundary.
create or replace function public.is_anonymous_user()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

create policy "Anonymous sessions cannot edit profiles"
on public.profiles as restrictive
for update to authenticated
using (true)
with check (not public.is_anonymous_user());

create policy "Anonymous sessions cannot insert profiles"
on public.profiles as restrictive
for insert to authenticated
with check (not public.is_anonymous_user());

create or replace function public.register_for_event(
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
  if current_user_id is null or public.is_anonymous_user() then
    raise exception 'community account required';
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

commit;
