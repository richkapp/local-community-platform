# Security

## Rules

- No passwords in v0.1.x.
- Existing-member sign-in cannot create accounts. New accounts require generated member or admin `/join/:code` URLs.
- Transactional login/signup email requires explicit consent and must never be reused for marketing.
- No service-role key in client code.
- No private email, member auth UUID, or stable anonymous-visitor identifier in public API responses.
- Profiles are private by default and public only after member opt-in.
- No downvotes.

## RLS and API expectations

- Active members are permanent, non-anonymous accounts that can update only their own profile and posts; suspended accounts and temporary anonymous identities are blocked from direct community mutations at the database boundary.
- Native avatars are public WebP assets capped at 512 KB in Storage. Active members reserve one opaque path through a security-definer RPC, and Storage RLS permits metadata reads, uploads, replacements, and deletion only for that caller's reserved path. Super admins may read/delete avatar metadata only to clean up a member before account deletion; the deletion RPC refuses to orphan a remaining public object. Direct `avatar_path` and legacy `avatar_url` mutation is not granted.
- Visitors can create anonymous posts and upvotes only through the origin-checked Edge Function.
- Public post reads expose only a safe per-viewer edit capability; underlying author and anonymous visitor IDs remain private.
- Member bookmarks are private account state exposed only through narrow relationship and idempotent desired-state RPCs; clients have no direct bookmark-table privileges.
- Post tags live in a private registry. Anyone may call the public-safe catalog RPC, but only active non-anonymous members may create tags, and each account is transactionally limited to three historical custom-tag rows.
- Clients have no direct tag-table privileges. A database trigger requires every member or anonymous post write to use at most six distinct registered tags, and the Edge Function's anonymous post RPC repeats that validation.
- Events are public listings that send RSVP traffic to external event pages.
- Legacy event-registration tables and functions are not part of the user-facing product and attendee counts are not public.
- Members can read only their own five-link invitation pool through a constrained RPC. Organizers can inspect and replace current member-owned links, create campaign invites, manage events, moderate post lifecycle state, triage bug reports, and read the full member directory.
- Bug-report notifications are queued from the database insert boundary through `pg_net`; Resend credentials stay in Supabase Vault, and notification failure does not roll back the report.
- Only super admins can assign or remove admin access, suspend or restore members, and permanently delete member accounts. The RPC boundary blocks self-management and changes to another super-admin account.
- Visitors can read only published or explicitly public data.

## Production database change verification

- Treat every applied migration as immutable. Production corrections use the next numbered forward migration; never rewrite an already-applied file.
- Keep Supabase Anonymous Sign-Ins disabled unless an installation deliberately redesigns and re-reviews the authorization model. Public anonymous posts and upvotes use the reviewed Edge Function rather than anonymous Auth users.
- After deploying a migration, verify indexes, function bodies, and grants with read-only catalog queries in addition to checking application routes.
- RLS-denied updates can return a successful response with zero affected rows. Authorization smoke tests must assert the returned row count and read the protected row back instead of relying only on an API error.
- Prefer rollback-only SQL transactions with locally scoped test claims for production concurrency checks. Do not create disposable or non-deliverable test accounts, and do not send authentication email during database verification.

## Invite abuse controls

Member invitations are cryptographically random and single-use. Every active member has five unconsumed URLs; confirmation consumes one and replenishes one inside the same locked database transaction. Delivery creates a temporary pending reservation, while clicks, failed delivery, and existing-member sign-in do not consume capacity. Suspended inviters' links stop working.

Admin campaign invites support custom codes, expiration, revocation, and a database-enforced capacity from 1 to 50. Reservation capacity is checked before transactional email delivery, and the Edge Function rate-limits repeated email and IP requests.
