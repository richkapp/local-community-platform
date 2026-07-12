# AGENTS.md — Local Community Platform

## Project

This repository is the theme-neutral open-source platform used by Braga AI Builders and designed for forks by any local or interest-based community. Braga AI Builders is the reference deployment; AI is not a requirement of the software.

This repository is the canonical upstream. The live Braga deployment is maintained separately at `richkapp/braga-ai-builders` and receives upstream changes only through reviewed sync pull requests. Braga-specific experiments belong downstream; only generalized, configurable features belong here.

Core scope:

- configurable community-access, passwordless email magic-link authentication;
- member profiles, settings, and a public-safe member directory;
- public posts with upvote-only voting, categories, and tags;
- external community event pages;
- organizer tools for invites, events, post moderation, and admin-only member access.

## Workspace

- Use Bun. Do not use npm, Yarn, or pnpm unless a tool specifically requires `npx` for a one-off CLI.
- Before work, read this file, `CHANGELOG.md`, and relevant current documentation.
- Preserve dirty worktrees and inspect Git status before changing files.

## Architecture

- Astro provides layouts and server routes; React islands handle interactive/authenticated UI.
- Supabase provides Auth, Postgres, Row Level Security, and Edge Functions.
- Vercel is the supported frontend host for v0.1.x. Other adapters require an explicit configuration change.
- `src/config/community.ts` is the single source for public community identity, theme language, and links.
- `supabase/migrations/` is the source of truth for schema, grants, RLS, views, and RPCs.
- Every installation owns separate provider accounts, projects, credentials, and member data.

## Product and security rules

- Keep profiles private by default and separate public profile fields from private account data.
- Do not add password authentication; use the configured community-access magic-link flow.
- Require explicit consent before sending a transactional login/signup email.
- Do not use member emails for marketing.
- Keep post voting upvote-only.
- Keep event creation, moderation, and full member access organizer-only.
- Use service-role keys only inside trusted Edge Functions or maintainer operations.
- Every Supabase client operation in React needs loading and safe error states.
- Add static or executable checks for new authorization boundaries.
- Never commit production credentials, auth links, sessions, member exports, or `.env` files.

## Commands

```bash
bun install
bun run dev
bun test
bun run build
bun run verify
```

## Delivery

- Use feature branches and pull requests; do not push application work directly to `main`.
- Keep upstream changes theme-neutral. Do not merge Braga's downstream `main` into this repository.
- When promoting a Braga-born feature upstream, remove Braga assumptions, add generic configuration and safe defaults, and document the reusable community problem.
- Treat optional external services as disabled until each installation supplies its own configuration.
- `bun run verify` is the required merge gate.
- Keep contributor and self-hosting docs aligned with environment, schema, or deployment changes.
- Verify deployed routes and authorization boundaries before reporting a release complete.
- Production email tests require explicit approval and a controlled deliverable inbox; never use disposable or non-deliverable addresses.
