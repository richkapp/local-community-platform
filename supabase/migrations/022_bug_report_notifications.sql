begin;

create extension if not exists pg_net with schema extensions;

alter table public.bug_reports
  add column if not exists notification_request_id bigint,
  add column if not exists notification_enqueued_at timestamptz;

comment on column public.bug_reports.notification_request_id is
  'Private pg_net request identifier for the Resend notification.';
comment on column public.bug_reports.notification_enqueued_at is
  'Time the Resend notification was queued after the report insert.';

create or replace function public.enqueue_bug_report_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resend_api_key text;
  notification_email text;
  from_email text;
  admin_url text;
  community_name text;
  email_body jsonb;
begin
  select decrypted_secret into resend_api_key
  from vault.decrypted_secrets
  where name = 'RESEND_API_KEY';

  select decrypted_secret into notification_email
  from vault.decrypted_secrets
  where name = 'BUG_REPORT_NOTIFICATION_EMAIL';

  select decrypted_secret into from_email
  from vault.decrypted_secrets
  where name = 'BUG_REPORT_FROM_EMAIL';

  select decrypted_secret into admin_url
  from vault.decrypted_secrets
  where name = 'BUG_REPORT_ADMIN_URL';

  select decrypted_secret into community_name
  from vault.decrypted_secrets
  where name = 'COMMUNITY_NAME';

  if nullif(resend_api_key, '') is null
    or nullif(notification_email, '') is null
    or nullif(from_email, '') is null
    or nullif(admin_url, '') is null
  then
    raise exception 'bug-report notification secrets are not configured';
  end if;

  community_name := coalesce(nullif(community_name, ''), 'Local Community Platform');

  email_body := jsonb_build_object(
    'from', from_email,
    'to', jsonb_build_array(notification_email),
    'subject', format('[%s] New bug report %s', community_name, new.id),
    'text', format(
      E'New bug report\n\nReport ID: %s\nStatus: %s\nName: %s\nEmail: %s\nPage: %s\n\nDescription:\n%s\n\nReview report: %s',
      new.id,
      new.status,
      coalesce(new.name, 'Not provided'),
      coalesce(new.email, 'Not provided'),
      coalesce(new.page_url, 'Not provided'),
      new.description,
      admin_url
    )
  );

  if new.email is not null then
    email_body := email_body || jsonb_build_object('reply_to', new.email);
  end if;

  select net.http_post(
    url := 'https://api.resend.com/emails',
    body := email_body,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_api_key,
      'Content-Type', 'application/json',
      'Idempotency-Key', 'bug-report/' || new.id
    ),
    timeout_milliseconds := 5000
  ) into new.notification_request_id;

  new.notification_enqueued_at := now();
  return new;
exception
  when others then
    new.notification_request_id := null;
    new.notification_enqueued_at := null;
    raise warning 'Bug-report notification could not be queued for report %', new.id;
    return new;
end;
$$;

revoke all on function public.enqueue_bug_report_notification() from public, anon, authenticated;

drop trigger if exists bug_reports_enqueue_notification on public.bug_reports;
create trigger bug_reports_enqueue_notification
before insert on public.bug_reports
for each row execute function public.enqueue_bug_report_notification();

notify pgrst, 'reload schema';

commit;
