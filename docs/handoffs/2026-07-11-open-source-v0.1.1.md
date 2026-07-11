# 2026-07-11 handoff — open-source v0.1.1

## Purpose

This release closes the independent security and fork-readiness review findings discovered immediately after v0.1.0.

## Product contract

- Browsing, anonymous posting, and anonymous upvoting are public.
- Member accounts use passwordless magic links and the installation's configured reusable community-access code.
- Installations that require invitation-only membership must keep that code private and share only coded `/join/:code` routes.
- Every transactional login/signup email requires explicit consent and carries a no-marketing promise.
- Profiles remain private by default; only opted-in profile fields appear publicly.
- Events are organizer-managed public listings that link to external RSVP pages. Internal registration UI and public attendee counts are absent.

## Security changes

- Migration `018_public_data_and_invite_capacity.sql` removes both anonymous visitor IDs and member auth UUIDs from public post reads.
- The safe post-list RPC returns only a per-viewer edit capability bit, never the underlying author identifier.
- Public post queries request explicit safe columns instead of `*`.
- External-event registration counts are no longer granted publicly.
- Failed/uncompleted invite retries re-check capacity before transactional email delivery.
- The admin-only member RPC remains the only application path to emails and private profile fields.

## Open-source changes

- Bun and every direct dependency are pinned to the versions tested by CI.
- CI and documentation use frozen-lockfile installs.
- Vercel is the supported v0.1.x frontend host; the canonical site derives from `PUBLIC_SITE_URL`.
- `.env.example` includes `IDEA_SIGNUP_INVITE_CODE`, which must match an active invite row.
- Historical dogfood findings are explicitly labeled as a pre-fix baseline.
- Security and architecture documentation now describe external RSVP and the current access model.

## Verification gate

```bash
bun install --frozen-lockfile
bun run verify
git diff --check
```

Run Gitleaks against Git history before publication. Releases are created from tracked Git commits/tags, never by archiving the local worktree or ignored provider files.

After production deployment, verify `/`, `/ideas`, `/events`, `/members`, `/signin`, and the configured coded invite route. Confirm `/join` and `/admin/registrations` remain `404`. Verify public post API responses omit `anonymous_visitor_id` and public attendee-count requests are denied.

## Operational rule

Production email tests require explicit approval and a controlled deliverable inbox. Never send test authentication email to disposable or non-deliverable addresses.
