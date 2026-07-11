begin;

-- Keep stable anonymous visitor identifiers out of the Data API while retaining
-- the public fields the post feed, detail page, and author controls require.
revoke select on table public.ideas from anon, authenticated;
grant select (
  id,
  slug,
  title,
  body,
  month_key,
  status,
  created_at,
  updated_at,
  category,
  tags
) on table public.ideas to anon, authenticated;

-- Expose author ownership only as a capability bit. The underlying auth user
-- UUID never crosses the public Data API boundary.
create or replace function public.list_visible_ideas()
returns table (
  id uuid,
  slug text,
  title text,
  body text,
  month_key text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  category text,
  tags text[],
  viewer_can_edit boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ideas.id,
    ideas.slug,
    ideas.title,
    ideas.body,
    ideas.month_key,
    ideas.status,
    ideas.created_at,
    ideas.updated_at,
    ideas.category,
    ideas.tags,
    (auth.uid() is not null and ideas.author_id = auth.uid() and ideas.status = 'open') as viewer_can_edit
  from public.ideas
  where ideas.status <> 'hidden' or public.is_admin();
$$;

revoke all on function public.list_visible_ideas() from public;
grant execute on function public.list_visible_ideas() to anon, authenticated;

-- External RSVP pages are the source of truth; attendee counts are not public.
revoke all on table public.event_registration_counts from anon, authenticated;

-- Re-check capacity before retrying a previously failed/uncompleted redemption.
-- The invite row remains locked while capacity and active reservations are read.
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

    if existing_redemption.completed_at is null then
      select count(*)::integer into active_reservations
      from public.invite_redemptions
      where invite_id = selected_invite.id
        and id <> existing_redemption.id
        and delivery_status = 'reserved'
        and consumes_capacity
        and requested_at > now() - interval '15 minutes';

      if selected_invite.max_uses is not null
        and selected_invite.uses_count + active_reservations >= selected_invite.max_uses then
        raise exception 'invite use limit reached';
      end if;
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

revoke all on function public.reserve_invite_for_email(text, text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_invite_for_email(text, text, text, text) to service_role;

commit;
