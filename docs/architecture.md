# Architecture

Braga AI Builders uses a server-rendered Astro app with React islands for interactive and authenticated UI. Supabase Cloud owns Auth, Postgres, Row Level Security, and privileged Edge Functions. Vercel is the supported frontend host for v0.1.x.

## Data model

- `profiles`: member profile data keyed to `auth.users`; public reads are opt-in and field-limited.
- `invites`: revocable community-access codes with optional expiry and capacity.
- `invite_redemptions`: private audit and delivery-reservation records.
- `ideas`: public posts; stable anonymous visitor identifiers are never granted through the public Data API.
- `idea_votes`: one upvote per authenticated or Edge-Function-managed visitor identity.
- `events`: organizer-managed public listings that link to external RSVP pages.
- `event_registrations`: inactive legacy storage retained for migration compatibility; it is not part of the v0.1.x user interface and aggregate counts are private.

## Authentication

Visitors use `/signin` or the configured `/join/:code` route. The browser submits the configured access code and email to `request-invite-magic-link` only after explicit transactional-email consent. The Edge Function validates access with service-role credentials and sends a Supabase invite or magic link. Password authentication is not used.

Installations that need invitation-only membership must keep their code out of public configuration and expose only private coded join URLs.

## Public data boundary

Public pages may read published events, non-hidden posts, aggregate upvote counts, and opted-in profile fields. The Data API excludes private emails, invite data, stable anonymous visitor IDs, attendee counts, and admin-only member fields. RLS and explicit grants both enforce these boundaries.
