insert into public.invites (code, label, max_uses, expires_at)
values ('braga-whatsapp', 'Default WhatsApp group invite', 250, now() + interval '180 days')
on conflict (code) do nothing;

insert into public.events (slug, title, description, starts_at, location_name, status, capacity)
values (
  'first-monthly-builder-night',
  'First Monthly Builder Night',
  'A casual Braga AI Builders meetup for sharing projects, choosing next sessions, and helping each other build.',
  now() + interval '21 days',
  'Braga, Portugal',
  'published',
  40
)
on conflict (slug) do nothing;
