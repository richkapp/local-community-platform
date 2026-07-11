begin;

create type public.bug_report_status as enum ('new', 'in_review', 'done');

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  description text not null,
  page_url text,
  status public.bug_report_status not null default 'new',
  visitor_id uuid not null,
  request_ip_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bug_reports_name_length check (name is null or char_length(name) between 1 and 100),
  constraint bug_reports_email_format check (
    email is null or (
      char_length(email) <= 254
      and email ~* '^[^[:space:]@?&#:]+@([a-z0-9-]+\.)+[a-z0-9-]{2,63}$'
    )
  ),
  constraint bug_reports_description_length check (char_length(description) between 20 and 5000),
  constraint bug_reports_page_url_http check (
    page_url is null or (char_length(page_url) <= 2048 and public.is_http_url(page_url))
  ),
  constraint bug_reports_request_ip_hash_format check (request_ip_hash ~ '^[a-f0-9]{64}$')
);

create index bug_reports_status_created_at_idx on public.bug_reports (status, created_at desc);
create index bug_reports_visitor_created_at_idx on public.bug_reports (visitor_id, created_at desc);
create index bug_reports_ip_created_at_idx on public.bug_reports (request_ip_hash, created_at desc);

create trigger bug_reports_set_updated_at before update on public.bug_reports
for each row execute function public.set_updated_at();

alter table public.bug_reports enable row level security;

create policy "Admins read bug reports" on public.bug_reports
for select using (public.is_admin());

create policy "Admins update bug report status" on public.bug_reports
for update using (public.is_admin()) with check (public.is_admin());

revoke all on table public.bug_reports from public, anon, authenticated;
grant all privileges on table public.bug_reports to service_role;
grant select (id, name, email, description, page_url, status, created_at, updated_at)
  on table public.bug_reports to authenticated;
grant update (status) on table public.bug_reports to authenticated;

create or replace function public.submit_bug_report(
  p_visitor_id uuid,
  p_name text,
  p_email text,
  p_description text,
  p_page_url text,
  p_request_ip_hash text,
  p_website text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := nullif(btrim(coalesce(p_name, '')), '');
  normalized_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  normalized_description text := btrim(coalesce(p_description, ''));
  normalized_page_url text := nullif(btrim(coalesce(p_page_url, '')), '');
  created_report_id uuid;
begin
  if btrim(coalesce(p_website, '')) <> '' then
    raise exception 'invalid report';
  end if;

  if p_visitor_id is null or p_request_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid visitor session';
  end if;

  if normalized_name is not null and char_length(normalized_name) > 100 then
    raise exception 'invalid name';
  end if;

  if normalized_email is not null and (
    char_length(normalized_email) > 254
    or normalized_email !~* '^[^[:space:]@?&#:]+@([a-z0-9-]+\.)+[a-z0-9-]{2,63}$'
  ) then
    raise exception 'invalid email';
  end if;

  if not (char_length(normalized_description) between 20 and 5000) then
    raise exception 'invalid description';
  end if;

  if normalized_page_url is not null and (
    char_length(normalized_page_url) > 2048
    or not public.is_http_url(normalized_page_url)
  ) then
    raise exception 'invalid page url';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('bug-report-visitor:' || p_visitor_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('bug-report-network:' || p_request_ip_hash, 0));

  if (
    select count(*)
    from public.bug_reports
    where visitor_id = p_visitor_id
      and created_at >= now() - interval '1 day'
  ) >= 5 then
    raise exception 'visitor report rate limit';
  end if;

  if (
    select count(*)
    from public.bug_reports
    where request_ip_hash = p_request_ip_hash
      and created_at >= now() - interval '1 hour'
  ) >= 20 then
    raise exception 'network report rate limit';
  end if;

  insert into public.bug_reports (
    name,
    email,
    description,
    page_url,
    visitor_id,
    request_ip_hash
  ) values (
    normalized_name,
    normalized_email,
    normalized_description,
    normalized_page_url,
    p_visitor_id,
    p_request_ip_hash
  )
  returning id into created_report_id;

  return created_report_id;
end;
$$;

revoke all on function public.submit_bug_report(uuid, text, text, text, text, text, text)
from public, anon, authenticated;
grant execute on function public.submit_bug_report(uuid, text, text, text, text, text, text)
to service_role;

notify pgrst, 'reload schema';

commit;
