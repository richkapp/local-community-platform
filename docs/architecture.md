# Architecture

Local Community Platform uses Astro with a statically generated public/account shell and on-demand parameterized routes. React islands handle interactive and authenticated UI. Supabase Cloud owns Auth, Postgres, Row Level Security, Storage, and privileged Edge Functions. Vercel is the supported frontend host for v0.1.x.

Astro's client router preserves the header and footer between pages and uses hover-intent prefetching. A shared browser session store resolves authentication, admin status, and optional Voting visibility once. Public Posts data loads through one privacy-safe aggregate RPC instead of a client request waterfall; author UUIDs and anonymous visitor identifiers never enter its response. Public date formatting uses the installation's `communityConfig.locale`, `communityConfig.timeZone`, and `communityConfig.timeZoneLabel`; runtime components do not hard-code downstream geography.

Parameterized public routes return `404` for malformed slugs and confirmed absent/RLS-hidden records. If the public existence check cannot reach Supabase, the route fails open to the client island instead of turning a database outage into a false permanent `404`; the island then renders its normal safe loading error.

## Data model

- `profiles`: member profile data keyed to `auth.users`; public reads are opt-in and field-limited, while role and suspension state remain private. Native avatars use one opaque `avatar_path` per profile and a public, size-limited Supabase Storage bucket.
- `invites`: system bootstrap links, rolling member-owned single-use URLs, and 1–50-use admin campaign URLs.
- `invite_redemptions`: private delivery, pending-confirmation, capacity, and confirmed-member audit records.
- `ideas`: public posts; stable anonymous visitor identifiers are never granted through the public Data API.
- `post_tags`: private shared tag registry seeded with the original tags. Public-safe catalog and active-member creation use narrow RPCs; categories remain fixed on `ideas`.
- `idea_votes`: one upvote per authenticated or Edge-Function-managed visitor identity.
- `idea_bookmarks`: private, unique member-to-post bookmarks with cascading cleanup when either account or post is deleted; clients use constrained RPCs rather than direct table access.
- `post_comments`: nested member comments with public-safe author projection, lifecycle controls, and de-identified retention when an author account is deleted.
- `post_participation_settings`: super-admin-controlled switches for anonymous posts, account-attributed posts, upvoting, and comments.
- `community_votes`, `community_vote_options`, and `community_ballots`: time-bounded single-choice community decisions; ballots may be named publicly or anonymous while remaining one-per-member at the database boundary.
- `events`: organizer-managed public listings that link to external RSVP pages.
- `event_registrations`: inactive legacy storage retained for migration compatibility; it is not part of the v0.1.x user interface and aggregate counts are private.
- `bug_reports`: private visitor-submitted reports with organizer triage; the public form writes only through a rate-limited Edge Function, while a database trigger queues optional Resend notifications through `pg_net` using Vault-held secrets.

## Authentication

Existing members use `/signin`, which requests a Supabase magic link with account creation disabled. New members enter through a generated `/join/:code` URL. The browser submits the invite code and email to `request-invite-magic-link` only after explicit transactional-email consent. Password authentication is not used.

A delivery attempt arms a temporary pending reservation before GoTrue can confirm the Auth user; provider failure releases it. Supabase confirmation claims the invite for the newly confirmed account, increments capacity, and atomically replenishes a member-owned link. Existing members using an invitation to sign in never consume it.

Every active member, including admins, gets five current single-use URLs through a security-definer RPC. Admins additionally create labeled campaign links with capacities from 1 to 50. Direct authenticated invite-table mutations are revoked.

`admin` and `super_admin` are separate authorization levels. Both can use organizer tools. Only a non-suspended super admin can assign ordinary admins, suspend or restore member access, or delete an Auth user and its cascading community data.

## Public data boundary

Public pages may read published events, non-hidden posts, aggregate upvote counts, the public-safe popularity-ranked tag catalog, and opted-in profile fields. The Data API excludes private emails, invite data, bookmark rows, tag-creator IDs, stable anonymous visitor IDs, attendee counts, and admin-only member fields. RLS and explicit grants both enforce these boundaries.

Avatar object URLs contain random UUID paths rather than Auth user IDs. Only opted-in public profile and post-author views expose those paths; legacy external avatar URLs remain read-only until members replace or remove them.

The `list_post_feed` RPC returns only public post fields, public-safe author fields, aggregate counts, and viewer capability/relationship booleans. It derives vote totals from the canonical aggregate view so member and anonymous upvotes stay aligned. Direct table grants remain narrower than the RPC response.
