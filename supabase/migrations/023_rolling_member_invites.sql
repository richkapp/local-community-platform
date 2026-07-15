begin;

-- Classify new referral links while preserving bounded organizer-created rows.
alter table public.invites
  add column if not exists invite_kind text not null default 'system';

-- Preserve bounded organizer-created links as admin campaigns. Historical admin
-- UI rows did not record created_by, so assign those bounded rows to the oldest
-- active organizer. Explicitly known bootstrap/public-access rows stay system
-- links and are revoked below.
with legacy_campaign_owner as (
  select id
  from public.profiles
  where role in ('admin', 'super_admin')
    and suspended_at is null
  order by case when role = 'super_admin' then 0 else 1 end, created_at
  limit 1
)
update public.invites i
set created_by = owner.id,
    invite_kind = 'admin_campaign'
from legacy_campaign_owner owner
where i.created_by is null
  and i.max_uses between 1 and 50
  and i.code not in ('braga-whatsapp', 'local-development-only')
  and lower(i.label) not in ('default whatsapp group invite', 'local development invite');

update public.invites
set invite_kind = 'admin_campaign'
where created_by is not null
  and max_uses between 1 and 50;

-- Retire only the explicitly known bootstrap links. Unknown active rows must be
-- classified by the installation owner rather than silently disabled.
update public.invites
set revoked_at = coalesce(revoked_at, now())
where invite_kind = 'system'
  and revoked_at is null
  and (
    code in ('braga-whatsapp', 'local-development-only')
    or lower(label) in ('default whatsapp group invite', 'local development invite')
  );

do $$
declare
  unclassified_count integer;
begin
  select count(*)::integer into unclassified_count
  from public.invites
  where invite_kind = 'system'
    and revoked_at is null
    and (expires_at is null or expires_at > now())
    and (max_uses is null or uses_count < max_uses);

  if unclassified_count > 0 then
    raise exception 'Migration 023 found % active invite(s) that cannot be classified safely. Rollback is automatic; reconcile those rows with separately reviewed installation-specific SQL, then rerun the unchanged migration.', unclassified_count
      using errcode = 'P0001';
  end if;
end;
$$;

alter table public.invites
  drop constraint if exists invites_kind_check,
  drop constraint if exists invites_kind_limits_check;

alter table public.invites
  add constraint invites_kind_check
    check (invite_kind in ('system', 'member_single', 'admin_campaign')) not valid,
  add constraint invites_kind_limits_check
    check (
      invite_kind = 'system'
      or (invite_kind = 'member_single' and max_uses = 1 and created_by is not null)
      or (invite_kind = 'admin_campaign' and max_uses is not null and max_uses between 1 and 50 and created_by is not null)
    ) not valid;

alter table public.invites validate constraint invites_kind_check;
alter table public.invites validate constraint invites_kind_limits_check;

create index if not exists invites_member_pool_idx
  on public.invites (created_by, created_at)
  where invite_kind = 'member_single' and revoked_at is null and uses_count = 0;

-- A delivery attempt is pending until a newly created auth user confirms the
-- link. Pending capacity prevents oversubscription without
-- treating a click or typo as a used invitation.
alter table public.invite_redemptions
  add column if not exists delivered_at timestamptz,
  add column if not exists claim_expires_at timestamptz,
  add column if not exists expected_user_id uuid,
  add column if not exists awaiting_new_account boolean not null default false;

alter table public.invite_redemptions
  drop constraint if exists invite_redemptions_delivery_status_check;

alter table public.invite_redemptions
  add constraint invite_redemptions_delivery_status_check
    check (delivery_status in ('reserved', 'delivered', 'completed', 'failed')) not valid;

alter table public.invite_redemptions validate constraint invite_redemptions_delivery_status_check;

create index if not exists invite_redemptions_pending_idx
  on public.invite_redemptions (invite_id, claim_expires_at)
  where delivery_status in ('reserved', 'delivered') and consumes_capacity;

-- All browser-side invite mutation now goes through constrained RPCs. Admin
-- reads retain their existing RLS policy; the service role remains available to
-- the invite-delivery Edge Function.
revoke insert, update, delete on table public.invites from authenticated;
revoke insert, update, delete on table public.invite_redemptions from authenticated;

create or replace function public.replenish_member_invite_pool(target_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_invite_count integer;
begin
  if target_member_id is null then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('member-invites:' || target_member_id::text, 0));

  if not exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = target_member_id
      and p.suspended_at is null
      and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous, false)
  ) then
    update public.invites
    set revoked_at = coalesce(revoked_at, now())
    where invite_kind = 'member_single'
      and created_by = target_member_id
      and revoked_at is null
      and uses_count = 0;
    return;
  end if;

  select count(*)::integer into active_invite_count
  from public.invites
  where invite_kind = 'member_single'
    and created_by = target_member_id
    and uses_count = 0
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  while active_invite_count < 5 loop
    insert into public.invites (code, label, max_uses, created_by, invite_kind)
    values (
      'member-' || replace(gen_random_uuid()::text, '-', ''),
      'Friend invite',
      1,
      target_member_id,
      'member_single'
    );
    active_invite_count := active_invite_count + 1;
  end loop;
end;
$$;

revoke all on function public.replenish_member_invite_pool(uuid) from public, anon, authenticated;
grant execute on function public.replenish_member_invite_pool(uuid) to service_role;

-- Confirmed, non-anonymous members receive their pool at profile creation. The
-- explicit backfill covers everyone who joined before this migration.
create or replace function public.handle_member_profile_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.replenish_member_invite_pool(new.id);
  return new;
end;
$$;

revoke all on function public.handle_member_profile_invites() from public, anon, authenticated;
drop trigger if exists on_member_profile_invites_created on public.profiles;
create trigger on_member_profile_invites_created
after insert on public.profiles
for each row execute function public.handle_member_profile_invites();

do $$
declare
  member_record record;
begin
  for member_record in
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.suspended_at is null
      and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous, false)
  loop
    perform public.replenish_member_invite_pool(member_record.id);
  end loop;
end;
$$;

create or replace function public.get_my_member_invites()
returns table (
  invite_id uuid,
  code text,
  status text,
  created_at timestamptz,
  status_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or public.is_anonymous_user() then
    raise exception 'community account required' using errcode = '42501';
  end if;
  if not public.is_active_member() then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  update public.invite_redemptions r
  set delivery_status = 'failed',
      failed_at = now(),
      consumes_capacity = false,
      awaiting_new_account = false,
      expected_user_id = null
  from public.invites i
  where r.invite_id = i.id
    and i.invite_kind = 'member_single'
    and i.created_by = current_user_id
    and r.delivery_status in ('reserved', 'delivered')
    and r.consumes_capacity
    and r.claim_expires_at <= now();

  perform public.replenish_member_invite_pool(current_user_id);

  return query
  with current_pool as (
    select
      i.id as invite_id,
      i.code,
      case when exists (
        select 1
        from public.invite_redemptions pending
        where pending.invite_id = i.id
          and pending.delivery_status in ('reserved', 'delivered')
          and pending.consumes_capacity
          and pending.claim_expires_at > now()
      ) then 'pending' else 'available' end as status,
      i.created_at,
      (
        select max(coalesce(pending.delivered_at, pending.requested_at))
        from public.invite_redemptions pending
        where pending.invite_id = i.id
          and pending.delivery_status in ('reserved', 'delivered')
          and pending.consumes_capacity
          and pending.claim_expires_at > now()
      ) as status_at,
      0 as sort_group,
      i.created_at as sort_at
    from public.invites i
    where i.invite_kind = 'member_single'
      and i.created_by = current_user_id
      and i.uses_count = 0
      and i.revoked_at is null
      and (i.expires_at is null or i.expires_at > now())
  ),
  recent_used as (
    select
      i.id as invite_id,
      i.code,
      'used'::text as status,
      i.created_at,
      used.completed_at as status_at,
      1 as sort_group,
      used.completed_at as sort_at
    from public.invites i
    join lateral (
      select max(r.completed_at) as completed_at
      from public.invite_redemptions r
      where r.invite_id = i.id
        and r.delivery_status = 'completed'
        and r.user_id is not null
    ) used on used.completed_at is not null
    where i.invite_kind = 'member_single'
      and i.created_by = current_user_id
      and i.uses_count >= 1
    order by used.completed_at desc
    limit 5
  ),
  invite_rows as (
    select * from current_pool
    union all
    select * from recent_used
  )
  select rows.invite_id, rows.code, rows.status, rows.created_at, rows.status_at
  from invite_rows rows
  order by rows.sort_group, rows.sort_at desc;
end;
$$;

revoke all on function public.get_my_member_invites() from public, anon;
grant execute on function public.get_my_member_invites() to authenticated;

create or replace function public.create_admin_invite(
  requested_code text,
  requested_label text,
  requested_max_uses integer,
  requested_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := lower(btrim(coalesce(requested_code, '')));
  normalized_label text := btrim(coalesce(requested_label, ''));
  result_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;
  if normalized_code = '' then
    normalized_code := 'admin-' || replace(gen_random_uuid()::text, '-', '');
  end if;
  if normalized_code !~ '^[a-z0-9][a-z0-9-]{3,80}$' then
    raise exception 'Invite code must be 4–81 lowercase letters, numbers, or hyphens' using errcode = '22023';
  end if;
  if char_length(normalized_label) not between 1 and 120 then
    raise exception 'Invite label is required and must be at most 120 characters' using errcode = '22023';
  end if;
  if requested_max_uses is null or requested_max_uses not between 1 and 50 then
    raise exception 'Invite capacity must be between 1 and 50' using errcode = '22023';
  end if;
  if requested_expires_at is not null and requested_expires_at <= now() then
    raise exception 'Invite expiry must be in the future' using errcode = '22023';
  end if;

  insert into public.invites (
    code,
    label,
    max_uses,
    expires_at,
    created_by,
    invite_kind
  ) values (
    normalized_code,
    normalized_label,
    requested_max_uses,
    requested_expires_at,
    current_user_id,
    'admin_campaign'
  )
  returning id into result_id;

  return result_id;
end;
$$;

create or replace function public.revoke_admin_invite(target_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_kind text;
  selected_creator uuid;
begin
  if not public.is_admin() then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  update public.invites
  set revoked_at = coalesce(revoked_at, now())
  where id = target_invite_id
  returning invite_kind, created_by into selected_kind, selected_creator;

  if not found then
    raise exception 'Invite not found' using errcode = 'P0002';
  end if;

  if selected_kind = 'member_single' and selected_creator is not null then
    perform public.replenish_member_invite_pool(selected_creator);
  end if;

  return true;
end;
$$;

revoke all on function public.create_admin_invite(text, text, integer, timestamptz) from public, anon;
revoke all on function public.revoke_admin_invite(uuid) from public, anon;
grant execute on function public.create_admin_invite(text, text, integer, timestamptz) to authenticated;
grant execute on function public.revoke_admin_invite(uuid) to authenticated;

create or replace function public.list_member_invites_for_admin()
returns table (
  invite_id uuid,
  code text,
  creator_id uuid,
  creator_label text,
  status text,
  created_at timestamptz,
  status_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  return query
  select
    i.id,
    i.code,
    i.created_by,
    coalesce(nullif(p.display_name, ''), nullif(p.handle, ''), 'Member'),
    case when pending.status_at is null then 'available' else 'pending' end,
    i.created_at,
    pending.status_at
  from public.invites i
  join public.profiles p on p.id = i.created_by
  left join lateral (
    select max(coalesce(r.delivered_at, r.requested_at)) as status_at
    from public.invite_redemptions r
    where r.invite_id = i.id
      and r.delivery_status in ('reserved', 'delivered')
      and r.consumes_capacity
      and r.claim_expires_at > now()
  ) pending on true
  where i.invite_kind = 'member_single'
    and i.uses_count = 0
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
  order by lower(coalesce(nullif(p.display_name, ''), nullif(p.handle, ''), 'Member')), i.created_at
  limit 500;
end;
$$;

revoke all on function public.list_member_invites_for_admin() from public, anon;
grant execute on function public.list_member_invites_for_admin() to authenticated;

-- Reserve an invitation before asking GoTrue to send. The reservation is held
-- for 15 minutes while the request is armed, then extended before delivery.
create or replace function public.reserve_invite_for_email(
  invite_code text,
  invite_email text,
  request_ip text default null,
  request_user_agent text default null
)
returns table (redemption_id uuid, code text, email text)
language plpgsql
security definer
set search_path = ''
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

  if selected_invite.invite_kind = 'member_single' and selected_invite.uses_count >= 1 then
    raise exception 'invite is exhausted';
  end if;

  if selected_invite.invite_kind = 'member_single' and not exists (
    select 1
    from public.profiles
    where profiles.id = selected_invite.created_by
      and profiles.suspended_at is null
  ) then
    raise exception 'invite creator is suspended';
  end if;

  update public.invite_redemptions
  set delivery_status = 'failed',
      failed_at = now(),
      consumes_capacity = false,
      awaiting_new_account = false,
      expected_user_id = null
  where public.invite_redemptions.invite_id = selected_invite.id
    and delivery_status in ('reserved', 'delivered')
    and consumes_capacity
    and claim_expires_at <= now();

  select * into existing_redemption
  from public.invite_redemptions
  where public.invite_redemptions.invite_id = selected_invite.id
    and lower(public.invite_redemptions.email) = normalized_email
  for update;

  if existing_redemption.id is not null then
    if existing_redemption.delivery_status = 'delivered'
      and existing_redemption.awaiting_new_account
      and existing_redemption.consumes_capacity
      and existing_redemption.claim_expires_at > now() then
      raise exception 'wait before requesting another link';
    end if;

    if existing_redemption.requested_at > now() - interval '10 minutes'
      and existing_redemption.delivery_status in ('reserved', 'delivered', 'completed') then
      raise exception 'wait before requesting another link';
    end if;

    select count(*)::integer into active_reservations
    from public.invite_redemptions
    where public.invite_redemptions.invite_id = selected_invite.id
      and id <> existing_redemption.id
      and delivery_status in ('reserved', 'delivered')
      and consumes_capacity
      and claim_expires_at > now();

    if selected_invite.max_uses is not null
      and selected_invite.uses_count + active_reservations >= selected_invite.max_uses
      and existing_redemption.user_id is null then
      raise exception 'invite use limit reached';
    end if;

    update public.invite_redemptions
    set requested_at = now(),
        request_ip = parsed_ip,
        user_agent = left(request_user_agent, 500),
        delivery_status = 'reserved',
        delivered_at = null,
        failed_at = null,
        claim_expires_at = now() + interval '15 minutes',
        awaiting_new_account = false,
        expected_user_id = null,
        consumes_capacity = (existing_redemption.user_id is null)
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
  where public.invite_redemptions.invite_id = selected_invite.id
    and delivery_status in ('reserved', 'delivered')
    and consumes_capacity
    and claim_expires_at > now();

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
    consumes_capacity,
    claim_expires_at,
    awaiting_new_account
  ) values (
    selected_invite.id,
    normalized_email,
    now(),
    parsed_ip,
    left(request_user_agent, 500),
    'reserved',
    true,
    now() + interval '15 minutes',
    false
  )
  returning id into redemption_id;

  code := selected_invite.code;
  email := normalized_email;
  return next;
end;
$$;

create or replace function public.mark_invite_delivery(
  target_redemption_id uuid,
  new_account_created boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_redemption public.invite_redemptions%rowtype;
begin
  select * into selected_redemption
  from public.invite_redemptions
  where id = target_redemption_id
  for update;

  if not found then
    raise exception 'invite reservation not found';
  end if;
  if selected_redemption.delivery_status = 'completed' then
    return;
  end if;

  if new_account_created then
    if selected_redemption.delivery_status = 'delivered' then
      return;
    end if;
    if selected_redemption.delivery_status <> 'reserved' then
      raise exception 'invite reservation not found';
    end if;

    update public.invite_redemptions
    set delivery_status = 'delivered',
        delivered_at = now(),
        claim_expires_at = now() + interval '24 hours',
        awaiting_new_account = true,
        consumes_capacity = true,
        failed_at = null
    where id = target_redemption_id;
  else
    if selected_redemption.delivery_status not in ('reserved', 'delivered') then
      raise exception 'invite reservation not found';
    end if;

    update public.invite_redemptions
    set delivery_status = 'completed',
        delivered_at = now(),
        completed_at = coalesce(completed_at, now()),
        claim_expires_at = null,
        awaiting_new_account = false,
        expected_user_id = null,
        consumes_capacity = false,
        failed_at = null
    where id = target_redemption_id;
  end if;
end;
$$;

-- Rebind an abandoned, still-unconfirmed Auth row to the current invitation
-- before sending its OTP. Confirmed members return false and never consume.
create or replace function public.prepare_existing_invite_user(target_redemption_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_redemption public.invite_redemptions%rowtype;
  selected_code text;
  selected_user auth.users%rowtype;
begin
  select * into selected_redemption
  from public.invite_redemptions
  where id = target_redemption_id;

  if not found then
    raise exception 'invite reservation not found';
  end if;
  if selected_redemption.delivery_status = 'completed' then
    return false;
  end if;
  if selected_redemption.delivery_status not in ('reserved', 'delivered')
    or (selected_redemption.delivery_status = 'delivered' and not selected_redemption.awaiting_new_account)
    or selected_redemption.claim_expires_at <= now() then
    raise exception 'invite reservation not found';
  end if;

  select code into selected_code
  from public.invites
  where id = selected_redemption.invite_id;

  select * into selected_user
  from auth.users
  where lower(email) = lower(selected_redemption.email)
  order by created_at
  limit 1
  for update;

  if not found or selected_user.email_confirmed_at is not null then
    return false;
  end if;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'invite_code', selected_code,
        'invite_flow', 'rolling_v1',
        'SignupSource', 'invite'
      ),
      updated_at = now()
  where id = selected_user.id;

  update public.invite_redemptions
  set expected_user_id = selected_user.id
  where id = target_redemption_id
    and delivery_status in ('reserved', 'delivered')
    and (delivery_status = 'reserved' or awaiting_new_account)
    and claim_expires_at > now();

  if not found then
    raise exception 'invite reservation not found';
  end if;

  return true;
end;
$$;

create or replace function public.fail_invite_redemption(target_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invite_redemptions
  set delivery_status = 'failed',
      failed_at = now(),
      claim_expires_at = null,
      awaiting_new_account = false,
      expected_user_id = null,
      consumes_capacity = false
  where id = target_redemption_id
    and delivery_status in ('reserved', 'delivered');
end;
$$;

-- Internal, idempotent completion shared by the auth trigger and client backup.
create or replace function public.complete_invite_for_user(
  target_user_id uuid,
  target_email text,
  target_invite_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(target_email));
  normalized_code text := lower(btrim(target_invite_code));
  selected_invite public.invites%rowtype;
  selected_redemption public.invite_redemptions%rowtype;
begin
  select * into selected_invite
  from public.invites
  where code = normalized_code
  for update;

  if not found then
    raise exception 'invite is not active';
  end if;

  select * into selected_redemption
  from public.invite_redemptions
  where invite_id = selected_invite.id
    and lower(email) = normalized_email
    and user_id = target_user_id
    and delivery_status = 'completed'
  for update;

  if found then
    return true;
  end if;

  if selected_invite.revoked_at is not null
    or (selected_invite.expires_at is not null and selected_invite.expires_at <= now()) then
    raise exception 'invite is not active';
  end if;

  if selected_invite.invite_kind = 'member_single' and not exists (
    select 1
    from public.profiles
    where profiles.id = selected_invite.created_by
      and profiles.suspended_at is null
  ) then
    raise exception 'invite creator is suspended';
  end if;

  select * into selected_redemption
  from public.invite_redemptions
  where invite_id = selected_invite.id
    and lower(email) = normalized_email
    and delivery_status = 'delivered'
    and awaiting_new_account
    and consumes_capacity
    and claim_expires_at > now()
  for update;

  if not found then
    return false;
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = target_user_id
      and lower(u.email) = normalized_email
      and u.email_confirmed_at is not null
      and (
        u.created_at >= selected_redemption.requested_at
        or selected_redemption.expected_user_id = target_user_id
      )
  ) then
    return false;
  end if;

  if selected_invite.max_uses is not null and selected_invite.uses_count >= selected_invite.max_uses then
    raise exception 'invite use limit reached';
  end if;

  update public.invites
  set uses_count = uses_count + 1
  where id = selected_invite.id;

  update public.invite_redemptions
  set delivery_status = 'completed',
      completed_at = now(),
      user_id = target_user_id,
      claim_expires_at = null,
      awaiting_new_account = false,
      consumes_capacity = false,
      failed_at = null
  where id = selected_redemption.id;

  if selected_invite.invite_kind = 'member_single' and selected_invite.created_by is not null then
    perform public.replenish_member_invite_pool(selected_invite.created_by);
  end if;

  return true;
end;
$$;

create or replace function public.claim_my_pending_invite()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  current_code text;
  current_flow text;
  current_created_at timestamptz;
begin
  if current_user_id is null or public.is_anonymous_user() then
    raise exception 'community account required' using errcode = '42501';
  end if;

  select lower(u.email), lower(btrim(u.raw_user_meta_data ->> 'invite_code')), u.raw_user_meta_data ->> 'invite_flow', u.created_at
  into current_email, current_code, current_flow, current_created_at
  from auth.users u
  where u.id = current_user_id
    and u.email_confirmed_at is not null;

  if current_email is null or nullif(current_code, '') is null or current_flow is distinct from 'rolling_v1' then
    return false;
  end if;

  -- This RPC is only the immediate post-auth race fallback. Older members may
  -- retain historical invite metadata and must never re-claim a legacy code.
  if current_created_at < now() - interval '5 minutes' then
    return false;
  end if;

  return public.complete_invite_for_user(current_user_id, current_email, current_code);
end;
$$;

create or replace function public.handle_confirmed_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_code text := lower(btrim(new.raw_user_meta_data ->> 'invite_code'));
  invite_flow text := new.raw_user_meta_data ->> 'invite_flow';
  claimed boolean;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;
  if nullif(invite_code, '') is not null then
    claimed := public.complete_invite_for_user(new.id, lower(new.email), invite_code);

    -- The pre-023 Edge Function arms delivery only after GoTrue returns. If a
    -- legacy invite confirms first, confirmation itself proves delivery: bind
    -- the still-live reservation to this newly confirmed user and retry.
    if not claimed and invite_flow is distinct from 'rolling_v1' then
      update public.invite_redemptions r
      set delivery_status = 'delivered',
          delivered_at = now(),
          claim_expires_at = greatest(coalesce(r.claim_expires_at, now()), now() + interval '24 hours'),
          awaiting_new_account = true,
          consumes_capacity = true,
          expected_user_id = new.id,
          failed_at = null
      from public.invites i
      where r.invite_id = i.id
        and i.code = invite_code
        and lower(r.email) = lower(new.email)
        and r.delivery_status = 'reserved'
        and r.claim_expires_at > now();

      if found then
        claimed := public.complete_invite_for_user(new.id, lower(new.email), invite_code);
      end if;
    end if;

    if not claimed then
      raise exception 'invite confirmation is not pending';
    end if;
    perform public.replenish_member_invite_pool(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed_invite_insert on auth.users;
create trigger on_auth_user_confirmed_invite_insert
after insert on auth.users
for each row execute function public.handle_confirmed_invite();

drop trigger if exists on_auth_user_confirmed_invite_update on auth.users;
create trigger on_auth_user_confirmed_invite_update
after update of email_confirmed_at on auth.users
for each row execute function public.handle_confirmed_invite();

revoke all on function public.reserve_invite_for_email(text, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_invite_delivery(uuid, boolean) from public, anon, authenticated;
revoke all on function public.prepare_existing_invite_user(uuid) from public, anon, authenticated;
revoke all on function public.fail_invite_redemption(uuid) from public, anon, authenticated;
revoke all on function public.complete_invite_for_user(uuid, text, text) from public, anon, authenticated;
revoke all on function public.claim_my_pending_invite() from public, anon;
revoke all on function public.handle_confirmed_invite() from public, anon, authenticated;

grant execute on function public.reserve_invite_for_email(text, text, text, text) to service_role;
grant execute on function public.mark_invite_delivery(uuid, boolean) to service_role;
grant execute on function public.prepare_existing_invite_user(uuid) to service_role;
grant execute on function public.fail_invite_redemption(uuid) to service_role;
grant execute on function public.complete_invite_for_user(uuid, text, text) to service_role;
grant execute on function public.claim_my_pending_invite() to authenticated;

-- Expand/contract compatibility: the currently deployed Edge Function calls this
-- legacy RPC after GoTrue accepts the invite. Keep it as an adapter until the
-- new Edge Function has been verified in production, then remove it separately.
create or replace function public.complete_invite_redemption(target_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_user boolean;
  rebound_user boolean := false;
  current_status text;
begin
  select exists (
    select 1
    from auth.users u
    where lower(u.email) = lower(r.email)
      and u.created_at < r.requested_at
  ), r.delivery_status
  into existing_user, current_status
  from public.invite_redemptions r
  where r.id = target_redemption_id;

  if not found then
    raise exception 'invite reservation not found';
  end if;
  if current_status = 'completed' then
    return;
  end if;

  if existing_user then
    rebound_user := public.prepare_existing_invite_user(target_redemption_id);
  end if;
  perform public.mark_invite_delivery(target_redemption_id, true);
  if existing_user and not rebound_user then
    perform public.mark_invite_delivery(target_redemption_id, false);
  end if;
end;
$$;

revoke all on function public.complete_invite_redemption(uuid) from public, anon, authenticated;
grant execute on function public.complete_invite_redemption(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
