-- Explicit Data API privileges. Supabase project creation disabled "Automatically expose new tables",
-- so RLS policies are not enough by themselves; PostgREST roles also need grants.

grant usage on schema public to anon, authenticated;

grant select on table public.profiles to anon, authenticated;
grant insert, update on table public.profiles to authenticated;

grant select, insert, update, delete on table public.ideas to authenticated;
grant select on table public.ideas to anon;

grant select, insert, delete on table public.idea_votes to authenticated;

grant select on table public.events to anon, authenticated;
grant insert, update, delete on table public.events to authenticated;

grant select, insert, update, delete on table public.event_registrations to authenticated;

grant select on table public.idea_vote_counts to anon, authenticated;
grant select on table public.event_registration_counts to anon, authenticated;

-- Admin-only tables still need authenticated grants so admin users can pass RLS.
grant select, insert, update, delete on table public.invites to authenticated;
grant select, insert, update, delete on table public.invite_redemptions to authenticated;

grant execute on function public.is_admin() to authenticated;
