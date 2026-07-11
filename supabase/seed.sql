-- Local development data only. Production migrations do not execute seed.sql.
-- Use a deliberately non-production code so screenshots/docs never normalize a
-- shared community invite.
insert into public.invites (code, label, max_uses)
values ('local-development-only', 'Local development invite', 50)
on conflict (code) do update
set label = excluded.label,
    max_uses = excluded.max_uses,
    revoked_at = null;

insert into public.events (
  slug,
  title,
  description,
  starts_at,
  location_name,
  capacity,
  status
)
values (
  'local-builder-night',
  'Local Builder Night',
  'Local-only sample event used after supabase db reset.',
  now() + interval '14 days',
  'Braga (local sample)',
  40,
  'published'
)
on conflict (slug) do nothing;
