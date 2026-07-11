# 2026-07-11 handoff — open-source v0.1.0

## Purpose

This is the release handoff for the first stable, forkable version of the local AI community platform used by Braga AI Builders.

## Product state

- The landing page welcomes everyone from everyday AI users to multi-agent builders.
- WhatsApp remains the live conversation; public posts preserve ideas, resources, and perspectives.
- Anyone can browse, post anonymously, and upvote.
- Members use the configured passwordless community-access flow and can attach public profiles to posts.
- Email requests require explicit consent to receive the transactional Supabase login/signup link and promise no marketing use.
- Profiles remain private by default; the public directory is opt-in.
- Public post authors link to their profiles and expose only public hover-card fields.
- Events are created by organizers and link to external RSVP pages.
- Organizers manage invites, events, posts, and an admin-only full member directory.
- Event registration management and the generic `/join` route are intentionally absent.

## Open-source state

- License: MIT.
- Public community identity and links: `src/config/community.ts`.
- Fork setup: `docs/self-hosting.md`.
- Deployment guide: `docs/deployment.md`.
- Contribution rules: `CONTRIBUTING.md`.
- Vulnerability reporting and security model: `SECURITY.md`.
- Each fork must use independent Supabase and frontend-hosting projects.
- Production member data and privileged credentials are not part of the repository.

## Backend state

- Forward migrations currently run through `017_post_author_hover_cards.sql`.
- Edge Functions:
  - `request-invite-magic-link`
  - `anonymous-ideas`
- Hosted function secrets must include exact redirect and community configuration described in `docs/self-hosting.md`.
- Public profiles and author cards expose only opted-in fields.
- The full member directory is available only through the admin-guarded RPC.

## Required release verification

```bash
bun install --frozen-lockfile
bun run verify
git diff --check
```

After deployment, smoke-check `/`, `/ideas`, `/events`, `/members`, `/signin`, the configured coded invite route, and organizer authorization. Confirm `/join` and `/admin/registrations` remain `404`.

## Operational rule

Production email delivery tests require explicit approval and a controlled deliverable inbox. Never use disposable or non-deliverable addresses.
