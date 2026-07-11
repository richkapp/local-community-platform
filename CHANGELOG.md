# Changelog

## 0.1.1 — 2026-07-11

Release-audit hardening for the first public template:

- Removed stable anonymous visitor identifiers and member auth UUIDs from public post reads.
- Made external-event attendee counts private.
- Fixed invite-capacity checks so exhausted retries fail before email delivery.
- Aligned authentication, external-RSVP, and historical-audit documentation with the live product.
- Added the missing idea-account invite environment variable to the setup template.
- Pinned Bun and direct dependencies and documented frozen-lockfile installs.
- Made the canonical site URL configurable through `PUBLIC_SITE_URL`.

## 0.1.0 — 2026-07-11

First stable open-source release of the platform running Braga AI Builders.

### Community experience

- Reframed the landing page around a broad spectrum of AI curiosity and practical use.
- Added clear WhatsApp and post-browsing paths, community memory, community-shaped events, and member attribution explanations.
- Simplified public language from internal idea/RIP terminology to posts.
- Added post categories, tags, filtering, anonymous posting, anonymous upvoting, author editing, and organizer moderation.
- Added clickable post authors with accessible hover cards and public social links.
- Added public external events with organizer import/edit controls and external RSVP links.
- Added profile social icons, X links, private-by-default visibility, and a prominent directory opt-in.
- Added explicit passwordless sign-in language and a required Supabase magic-link consent checkbox with a no-marketing promise.
- Added an open-source GitHub link in the footer.

### Organizer and security

- Added an admin-only member database that includes private profiles without exposing them publicly.
- Hardened profile role updates, invite redemption, event registration, post lifecycle changes, API grants, CORS, URL fields, and public author/profile views.
- Removed event-registration management from the organizer interface.
- Added safe not-found states and public-route server checks.
- Added GitHub verification workflow plus frontend and security contract coverage.

### Open source

- Centralized public community identity in `src/config/community.ts`.
- Added self-hosting, deployment, contribution, and security documentation.
- Kept production secrets and member data outside the repository.
- Prepared the repository for GitHub template use under the MIT license.

## 2026-07-09

- Created the initial Astro, React, Tailwind, Supabase, and Vercel application.
- Added the initial schema, RLS policies, invite function, profiles, posts, events, and organizer surfaces.
- Created the public GitHub repository and reference deployment.
