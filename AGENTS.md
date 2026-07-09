# AGENTS.md — Braga AI Builders

## Project

Braga AI Builders is an open-source community platform for a local WhatsApp-based AI builders group in Braga that meets once a month.

Core scope:

- invite-gated email magic-link auth
- accounts, profiles, settings, and public-safe member directory
- upvote-only idea feed for future monthly activities
- event pages and registrations
- small admin dashboard for organizers

## Active workspace

- Hetzner working root: `/home/deploy/projects/braga-ai-builders`
- Use Bun. Do not use npm/yarn/pnpm unless a tool hard-requires `npx` for one-off CLI execution.
- Before work, read this file, `CHANGELOG.md`, and the latest plan under `docs/plans/`.

## Provider accounts

- Supabase production account for this project: `bragabuilders.bash197@passinbox.com`.
- Vercel production account for this project: `zkapp@pm.me`.
- Z may have multiple Supabase/Vercel accounts. Confirm the account email before creating projects, linking projects, deploying, or changing settings.
- Vercel CLI may need `HOME=/home/deploy` to see host-level auth, but do not assume that auth is the Braga account until `vercel whoami` or the GUI confirms it.

## Architecture decisions

- Supabase Cloud is the v1 backend: Auth, Postgres, RLS, Storage, Edge Functions.
- Vercel is the v1 host.
- Hetzner is a development machine only, not the production backend and not required for contributors.
- Keep all schema and security policy in `supabase/migrations/`.
- Use service-role keys only inside Supabase Edge Functions or maintainer-only scripts.
- Do not add password auth in v1. Use email magic links only.
- Signup must be invite-gated. Public unrestricted signup is out of scope.
- Idea voting is upvote-only. Do not add downvotes or negative ranking.

## Commands

```bash
bun install
bun run dev
bun test
bun run build
bun run verify
```

## Implementation rules

- Default to Astro for static layout and React islands for authenticated/dynamic interactions.
- Every Supabase client operation in React needs loading and error states.
- Keep public profile fields separate from private account data.
- RLS tests or static policy checks must cover new tables/policies.
- Keep contributor docs updated when env vars, setup, or provider steps change.

## Deployment notes

- Production Supabase project should be created under `bragabuilders.bash197@passinbox.com`.
- Production Vercel project should be created under `zkapp@pm.me`.
- Add only browser-safe env vars with the `PUBLIC_` prefix to Vercel frontend environments.
- Set Edge Function secrets in Supabase, not Vercel.
- Verify deployed URLs with `curl` before reporting production live.
