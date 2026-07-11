begin;

alter table public.events
  add column external_url text,
  add column image_url text;

alter table public.events
  add constraint events_external_url_https check (external_url is null or external_url ~ '^https://'),
  add constraint events_image_url_https check (image_url is null or image_url ~ '^https://');

commit;
