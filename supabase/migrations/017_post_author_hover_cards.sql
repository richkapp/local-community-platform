begin;

-- Enrich the public post-author view for profile hover cards. Private profiles
-- remain excluded, so this exposes only fields already available in the public
-- member directory.
create or replace view public.idea_public_authors as
select
  ideas.id as idea_id,
  profiles.handle,
  profiles.display_name,
  profiles.avatar_url,
  profiles.bio,
  profiles.website_url,
  profiles.linkedin_url,
  profiles.github_url,
  profiles.x_url
from public.ideas
join public.profiles on profiles.id = ideas.author_id
where profiles.is_public = true
  and ideas.status <> 'hidden';

grant select on public.idea_public_authors to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
