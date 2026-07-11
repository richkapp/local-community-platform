# 2026-07-09 checkout handoff — security review hardening

This handoff captures unfinished work from the post-deploy review batch. It is **not shipped** yet.

## Current live state

- Production URL: `https://braga-ai-builders.vercel.app`
- GitHub repo: `https://github.com/0rderfl0w/braga-ai-builders`
- Supabase project: maintainer-controlled production project
- Last pushed commit before this WIP: `9d7ad6c`

## Why this exists

Three review agents found pre-ship issues after the first deployment. The critical/high findings to preserve:

1. **Self-service admin escalation** — members can update `profiles.role` and become admin unless role updates are blocked server-side.
2. **Public invite bypass** — public links and seed data expose `braga-whatsapp`, making signup effectively public.
3. **Invite race/cooldown gap** — Edge Function validates invite, sends email, then increments `uses_count`; concurrent requests can oversubscribe and repeated requests are not throttled well.
4. **Profile URL XSS** — profile URL fields need server-side `https?://` constraints and safe external-link rendering.
5. **Event registration bypass** — direct table inserts can register for draft/closed/full/completed events unless routed through a guarded RPC.
6. **Aggregate view/runtime mismatch** — React islands embedded plain views as PostgREST relationships; browsers likely fail unless counts are queried separately or exposed via supported relationships/RPC.
7. **Missing not-found states** — bad idea/event slugs loaded forever.
8. **Member detail route stub** — `/members/:handle` did not load that member.

## WIP already written locally

Uncommitted files exist on `main`. Do **not** assume they are correct or shipped.

Major WIP pieces:

- `supabase/migrations/005_security_hardening.sql`
  - URL constraints for profile links.
  - `public.public_profiles` view.
  - role-change trigger/policies/column grants.
  - `redeem_invite_for_email(...)` RPC for atomic invite reservation + cooldown.
  - `register_for_event(...)` RPC for event status/window/capacity checks.
  - filtered aggregate views.
  - revokes old `braga-whatsapp` seed invite.
- `supabase/functions/request-invite-magic-link/index.ts`
  - switched to `redeem_invite_for_email` before sending magic link.
- Frontend/client WIP:
  - removed hardcoded `/join/braga-whatsapp` links in touched files.
  - added separate count queries for ideas/events.
  - added upvote hydration and duplicate-insert tolerance.
  - added idea/event not-found states.
  - started safe public-profile view usage and safe external links.
  - added shared slug helper.
  - added `MemberProfile.tsx` but **page wiring still needs to be finished**.

## Known incomplete work

Before shipping this WIP:

1. Wire `src/pages/join.astro`, `src/pages/join/[code].astro`, `src/pages/members/[handle].astro`, and `src/components/Nav.astro` to the private-invite/member-profile behavior.
2. Update `supabase/config.toml` to remove broad `https://*.vercel.app/auth/confirm` and use exact trusted redirect URLs.
3. Remove or change `supabase/seed.sql` so it does not seed a production-looking public `braga-whatsapp` invite.
4. Update tests to assert:
   - members cannot change `role`;
   - public profile reads are through safe fields/view;
   - `register_for_event` and `redeem_invite_for_email` exist and direct registration insert policy is gone;
   - no hardcoded public `/join/braga-whatsapp` links remain.
5. Run `bun run verify` and fix TypeScript/LSP issues. Earlier tool output hinted stale diagnostics around old aggregate fields; verify for real.
6. Apply `005_security_hardening.sql` to production Supabase only after local verify passes.
7. Redeploy the Edge Function after applying the migration.
8. Push to GitHub and redeploy Vercel production.
9. Live-smoke routes + Supabase function again.

## Procedure reminder

Use maintainer-approved deployment authentication only. Do not place browser sessions or deployment credentials in repository documentation.
