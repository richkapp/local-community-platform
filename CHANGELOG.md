# Changelog

## Unreleased

## 0.4.1 — 2026-07-25

Review hardening:

- Restored keyboard focus to each new installation-stage heading after an organizer confirms the AI-reported checks.
- Added a 30-day browser-progress lifetime and a shared-device warning while preserving portable recovery files.
- Accepted and upgraded compatible `v0.3.0` and `v0.4.0` recovery payloads under the strict version-2 schema.
- Clarified that launcher milestones reflect organizer confirmation rather than independent provider-account inspection.
- Replaced cryptographic-sounding “pinned” claims with accurate tagged-release language.
- No database migration is required.

## 0.4.0 — 2026-07-25

Guided community creation:

- Added a public `/create` launcher that routes organizers by proven capability rather than AI brand or technical confidence alone.
- Added technical, capable-local-agent, browser-only, and helper handoff paths built from deterministic prompts; the launcher invokes no LLM and connects to no provider.
- Added a nine-stage installation journey covering tagged source, community identity, organizer-owned GitHub and Supabase projects, production email, Vercel deployment, organizer settings, controlled member proof, and a sanitized launch report.
- Added browser-local progress, strict bounded recovery export/import, stage-specific diagnostic prompts, and explicit separation between a reachable site and a verified community launch.
- Added explicit credential warnings, common secret-pattern redaction, untrusted-data boundaries, and prompts that keep provider tokens, private invitations, and environment values in provider dashboards or local environment files.
- Included the selected AI, operating system, confirmed capabilities, and release-declared package manager in every staged installation prompt.
- Added the launcher to footer navigation while keeping primary navigation focused on the active community.

## 0.3.0 — 2026-07-24

Community-owned feature settings:

- Added one super-admin-only `/admin/settings` surface for Voting, event creation, anonymous posting, signed-out posting, anonymous commenting, and anonymous replies.
- Kept every capability installed while moving community-wide availability decisions out of individual organizer tools and into one predictable settings screen.
- Restricted Voting and event-creation setting changes to active super admins while ordinary admins retain content and event-management access.
- Added a database-backed event-creation switch that preserves existing events but blocks new inserts when disabled, including stale or bypassed clients.
- Serialized event creation against concurrent setting changes and organizer suspension, and stamped `created_by` at the database boundary.
- Preserved existing installation behavior by seeding all included feature settings enabled and failing closed when a setting cannot be loaded.

Upgrade from `v0.2.0`: back up the installation, apply migrations `037` and `038` in order, verify the new RPCs and trigger, then deploy the `v0.3.0` frontend. Do not deploy the new frontend against a database that stops at migration `036`.

## 0.2.0 — 2026-07-24

Authentication and invitation clarity:

- Added accessible Sign In and Sign Up tabs, clearer private-invitation routes, and a direct new-member handoff from the sign-in form.
- Added explicit magic-link delivery states, resend countdowns, provider-safe error handling, and clearer recovery guidance when an email is delayed or blocked.
- Improved invited-member onboarding and made signed-out posting explain when a private member invitation is required.

Community experience and media:

- Added a redesigned, configuration-driven landing page with optional hero and membership imagery; no downstream branding assets are bundled upstream.
- Added saved post filters, exact return navigation from post detail, and an author-first mobile feed with compact management controls.
- Raised profile-photo intake to 10 MB and added HEIC/HEIF conversion for iPhone photos while preserving the existing compressed WebP output boundary; a bounded ISO-BMFF parser rejects malformed, sequence, multi-image, and oversized inputs before decoding.
- Added an optional, provider-neutral community-channel rules gate, disabled until configured, whose destination, labels, rules, eligibility language, and consent copy live in `src/config/community.ts`.
- Added route-aware Open Graph and Twitter cards for the home page, invitations, posts, events, and member profiles using a theme-neutral generated design; non-canonical cache-busting requests are rejected, missing records return 404, and record revisions invalidate edited-content cards.
- Derived public document language, Open Graph locale, comment dates, and event-card dates from installation configuration.

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
- Updated Astro, Vercel, and social-card dependencies and pinned patched transitive versions; the production dependency audit is clean.
- Removed active Braga callback and channel destinations from tracked template defaults, replaced the branded favicon, and standardized Edge Function environment names.
- Added LGPL/GPL license texts, exact corresponding-source links, and rebuild/relinking instructions for the browser HEIC decoder and its bundled libheif build.

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
