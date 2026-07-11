begin;

-- Public idea cards need author display data without exposing profile IDs,
-- role, email-adjacent auth data, or private profiles.
create or replace view public.idea_public_authors as
select
  ideas.id as idea_id,
  profiles.handle,
  profiles.display_name,
  profiles.avatar_url
from public.ideas
join public.profiles on profiles.id = ideas.author_id
where profiles.is_public = true
  and ideas.status <> 'hidden';

grant select on public.idea_public_authors to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
