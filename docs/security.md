# Security

## Rules

- No passwords in v0.1.x.
- Community access uses a configured reusable code; installations that need private membership must expose only coded `/join/:code` routes.
- Transactional login/signup email requires explicit consent and must never be reused for marketing.
- No service-role key in client code.
- No private email, member auth UUID, or stable anonymous-visitor identifier in public API responses.
- Profiles are private by default and public only after member opt-in.
- No downvotes.

## RLS and API expectations

- Members can update only their own profile and posts.
- Visitors can create anonymous posts and upvotes only through the origin-checked Edge Function.
- Public post reads expose only a safe per-viewer edit capability; underlying author and anonymous visitor IDs remain private.
- Events are public listings that send RSVP traffic to external event pages.
- Legacy event-registration tables and functions are not part of the user-facing product and attendee counts are not public.
- Organizers alone can manage invites, events, post lifecycle state, and the full member directory.
- Visitors can read only published or explicitly public data.

## Invite abuse controls

Invites support expiration, revocation, and maximum-use limits. Reservation capacity is checked before transactional email delivery, and the Edge Function rate-limits repeated email and IP requests.
