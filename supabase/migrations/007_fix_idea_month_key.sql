begin;

-- The original expression stored a double-escaped digit class and rejected
-- valid YYYY-MM keys such as 2026-07.
alter table public.ideas drop constraint if exists ideas_month_key_format;
alter table public.ideas
  add constraint ideas_month_key_format
  check (month_key ~ '^[0-9]{4}-[0-9]{2}$');

commit;
