begin;

-- Migration 026 validates all future writes. Normalize any duplicate arrays
-- inherited from the older fixed allowlist before tightening the creation path.
with tag_positions as (
  select ideas.id, item.tag, min(item.position) as first_position
  from public.ideas
  cross join lateral unnest(ideas.tags) with ordinality as item(tag, position)
  group by ideas.id, item.tag
), normalized as (
  select tag_positions.id, array_agg(tag_positions.tag order by tag_positions.first_position) as tags
  from tag_positions
  group by tag_positions.id
)
update public.ideas
set tags = normalized.tags
from normalized
where public.ideas.id = normalized.id
  and cardinality(public.ideas.tags) <> cardinality(normalized.tags);

-- Serialize tag creation with member role/suspension changes as well as other
-- tag creations for the same account. Authorization is re-checked under the
-- shared member-admin lock so a concurrent suspension cannot lose the race.
create or replace function public.create_post_tag(p_label text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  clean_label text := regexp_replace(btrim(coalesce(p_label, '')), '[[:space:]]+', ' ', 'g');
  clean_slug text;
begin
  if viewer_id is null or public.is_anonymous_user() then
    raise exception 'active member account required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('member-admin:' || viewer_id::text, 0));

  if not public.is_active_member() then
    raise exception 'active member account required' using errcode = '42501';
  end if;

  if char_length(clean_label) not between 2 and 28 then
    raise exception 'tag labels must be 2 to 28 characters' using errcode = '22023';
  end if;

  if clean_label !~ '^[[:alnum:]]([[:alnum:] -]*[[:alnum:]])$' then
    raise exception 'tag label needs letters or numbers and may use spaces or hyphens' using errcode = '22023';
  end if;

  clean_slug := lower(regexp_replace(clean_label, '[^[:alnum:]]+', '-', 'g'));
  clean_slug := btrim(clean_slug, '-');
  if char_length(clean_slug) not between 2 and 40 then
    raise exception 'tag label needs letters or numbers' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.post_tags
    where post_tags.slug = clean_slug
       or lower(post_tags.label) = lower(clean_label)
  ) then
    raise exception 'tag already exists' using errcode = '23505';
  end if;

  if (
    select count(*)
    from public.post_tags
    where post_tags.created_by = viewer_id
      and not post_tags.is_system
  ) >= 3 then
    raise exception 'custom tag lifetime limit reached' using errcode = '22023';
  end if;

  insert into public.post_tags (slug, label, created_by, is_system)
  values (clean_slug, clean_label, viewer_id, false);

  return clean_slug;
exception
  when unique_violation then
    raise exception 'tag already exists' using errcode = '23505';
end;
$$;

commit;
