begin;

-- Member-directory visibility is explicit opt-in. Accounts created before this
-- privacy default existed are also made private unless their owner re-enables
-- directory visibility in Settings.
alter table public.profiles
  alter column is_public set default false;

update public.profiles
set is_public = false
where is_public = true;

commit;
