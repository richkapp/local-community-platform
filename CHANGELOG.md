# Changelog

## Unreleased

Repository governance and downstream separation:

- Established Local Community Platform as the canonical theme-neutral upstream and moved the live Braga deployment source to `richkapp/braga-ai-builders`.
- Preserved shared Git history while keeping Braga as a separately reviewed downstream rather than an automatically synchronized deployment.
- Documented where features belong, how Braga-born features are generalized upstream, and how upstream releases are synced back without moving credentials or production data.

Generalized community capabilities promoted from the Braga reference deployment:

- Replaced the shared signup code with existing-member sign-in, one-time bootstrap onboarding, rolling single-use member invitations, and bounded organizer campaign links.
- Added private post bookmarks, member post filters, member-created tags, nested comments, participation controls, and URL-only native post sharing.
- Added native profile-avatar uploads with client-side WebP processing, opaque Storage paths, owner-bound policies, and account-deletion cleanup.
- Added optional public community voting with organizer-controlled visibility, time-bounded single-choice ballots, live results, and per-ballot anonymity.
- Added configurable Terms and Privacy templates; installations must replace and review legal configuration for their own operator and jurisdiction.
- Added installation-configured locale/timezone formatting, collision-safe avatar-bucket setup, fail-closed legacy invite classification, and complete backup/restore guidance for the promoted data model.

Performance and delivery hardening:

- Pre-rendered fixed routes for CDN delivery while keeping parameterized and API routes on demand.
- Added Astro client navigation with hover-intent prefetching and a persistent global shell.
- Consolidated browser auth, admin status, and Voting visibility into one shared session store.
- Replaced the Posts request waterfall with a privacy-safe aggregate feed RPC that preserves both member and anonymous upvotes.
- Skipped organizer checks for signed-out visitors and lazy-loaded the bug-report dialog.
- Preserved Astro ClientRouter history metadata and closed persisted overlays during navigation.
- Added focused frontend, migration, performance-architecture, output-manifest, and authorization contracts for the new boundaries.

## 0.1.2 — 2026-07-11

Theme-neutral repository identity and configuration:

- Renamed the open-source project from Braga AI Builders to Local Community Platform while preserving Braga AI Builders as the reference deployment.
- Repositioned the project for any local or interest-based community, not only AI groups.
- Moved Braga's AI-specific landing-page language into `src/config/community.ts` so forks can replace the theme without rewriting page components.
- Updated the package name, repository links, self-hosting examples, metadata, and generic profile fallbacks.

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
