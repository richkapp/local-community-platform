alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.invite_redemptions enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_votes enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  );
$$;

create policy "Public profiles are readable" on public.profiles
for select using (is_public = true or id = auth.uid() or public.is_admin());

create policy "Members insert own profile" on public.profiles
for insert with check (id = auth.uid());

create policy "Members update own profile" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Admins manage profiles" on public.profiles
for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins read invites" on public.invites
for select using (public.is_admin());

create policy "Admins manage invites" on public.invites
for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins read invite redemptions" on public.invite_redemptions
for select using (public.is_admin());

create policy "Admins manage invite redemptions" on public.invite_redemptions
for all using (public.is_admin()) with check (public.is_admin());

create policy "Published ideas are readable" on public.ideas
for select using (status <> 'hidden' or author_id = auth.uid() or public.is_admin());

create policy "Members create ideas" on public.ideas
for insert with check (author_id = auth.uid() and status = 'open');

create policy "Authors update open ideas" on public.ideas
for update using (author_id = auth.uid() and status = 'open') with check (author_id = auth.uid());

create policy "Admins manage ideas" on public.ideas
for all using (public.is_admin()) with check (public.is_admin());

create policy "Votes are readable" on public.idea_votes
for select using (auth.role() = 'authenticated');

create policy "Members upvote as themselves" on public.idea_votes
for insert with check (user_id = auth.uid());

create policy "Members remove own upvote" on public.idea_votes
for delete using (user_id = auth.uid());

create policy "Published events are readable" on public.events
for select using (status in ('published', 'completed') or public.is_admin());

create policy "Admins manage events" on public.events
for all using (public.is_admin()) with check (public.is_admin());

create policy "Members read own registrations" on public.event_registrations
for select using (user_id = auth.uid() or public.is_admin());

create policy "Members register themselves" on public.event_registrations
for insert with check (user_id = auth.uid());

create policy "Members update own registration" on public.event_registrations
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Admins manage registrations" on public.event_registrations
for all using (public.is_admin()) with check (public.is_admin());
