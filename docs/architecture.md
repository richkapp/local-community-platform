# Architecture

Braga AI Builders uses a static-first Astro app with React islands for authenticated interactions. Supabase Cloud owns auth, Postgres, row-level security, storage, and privileged Edge Functions.

## Data model

- `profiles`: public-safe member information keyed to `auth.users`.
- `invites`: revocable invite codes for WhatsApp group sharing.
- `invite_redemptions`: audit trail for invite email requests.
- `ideas`: activity ideas for monthly sessions.
- `idea_votes`: one upvote per user per idea.
- `events`: monthly meetup pages.
- `event_registrations`: registrations tied to members.

## Auth

Members join from `/join/:code`. The browser submits the invite code and email to `request-invite-magic-link`. The Edge Function validates the invite with service-role access and sends a Supabase invite or magic link. Password auth is not used.

## Security

All user data access is protected by RLS. Public pages may read published events, open ideas, and active public profile fields. Private account data stays in Supabase Auth or admin-only tables.
