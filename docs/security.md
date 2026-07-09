# Security

## Rules

- No passwords in v1.
- No public unrestricted signup.
- No service-role key in client code.
- No private email exposure in public profiles.
- No downvotes.

## RLS expectations

- Members can update only their own profile.
- Members can create ideas and vote as themselves.
- Members can register themselves for events.
- Admins can manage events, invites, and registrations.
- Visitors can read only published/public data.

## Invite abuse controls

Invites should support expiration, revocation, and max use counts. The Edge Function should rate limit email requests per invite/email/IP where possible.
