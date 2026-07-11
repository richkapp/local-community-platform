begin;

revoke update on table public.ideas from authenticated;
grant update (title, body, status) on table public.ideas to authenticated;

drop policy if exists "Authors update open ideas" on public.ideas;
create policy "Authors update open ideas" on public.ideas
for update
using (author_id = auth.uid() and status = 'open')
with check (author_id = auth.uid() and status = 'open');

notify pgrst, 'reload schema';

commit;
