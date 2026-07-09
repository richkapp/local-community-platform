---
title: "feat: Braga AI Builders community platform"
type: "feat"
date: "2026-07-09"
---

# feat: Braga AI Builders community platform

## Summary

Build Braga AI Builders as an open-source community app for a local WhatsApp-based AI builders group that meets monthly. The platform should handle invited member onboarding, passwordless accounts, profiles/settings, event registration, and an upvote-only idea feed for choosing future activities.

The recommended backend choice is Supabase Cloud for v1. It gives contributors a portable open-source stack without requiring access to Z's Hetzner server, while keeping auth, Postgres, RLS, email magic links, and local development reproducible.

---

## Problem Frame

The project needs enough backend functionality to run a real community, but the infrastructure should stay easy for outside collaborators to understand and contribute to. The old Build to Own Club frontend and auth/profile patterns can inform the shape, but this is a new open-source project with a smaller scope: members, profiles, events, registrations, and idea voting.

Running everything directly on Hetzner would match the ownership philosophy, but it creates a collaboration bottleneck because production access and secrets would sit on Z's server. Railway is useful for hosting a custom app or Postgres instance, but it does not remove the need to design auth, magic links, invite enforcement, RLS, email delivery, and admin tooling. Supabase is the better v1 default because those pieces are exactly the product surface needed here.

---

## Requirements

**Open-source collaboration**

- R1. The repo must be public and runnable locally without production credentials.
- R2. Contributors must be able to develop against local Supabase or a disposable Supabase project.
- R3. Production access must not require sharing Hetzner, SSH, database passwords, or private server access.

**Member onboarding and auth**

- R4. Members join through a unique invite link that can be shared in the WhatsApp group.
- R5. A visitor with a valid invite link can enter an email and receive a passwordless magic link.
- R6. Password auth is out of scope for v1; users sign in by email magic link only.
- R7. New account creation must be gated by invite validation, not by a public unrestricted signup form.

**Accounts, profiles, and settings**

- R8. Members can create and update a profile with display name, short bio, links, and optional avatar.
- R9. Members can update basic account settings without admin help.
- R10. Public member directory data must expose only intentional profile fields.

**Idea feed**

- R11. Members can post ideas for future monthly activities.
- R12. Members can upvote ideas, with at most one vote per member per idea.
- R13. Downvotes are not supported.
- R14. Ideas can be grouped by monthly cycle or upcoming event context.

**Events and registrations**

- R15. Admins can publish event pages for monthly meetings.
- R16. Members and invited visitors can register for events.
- R17. Event pages can show registration state and attendee counts without leaking private data.
- R18. Admins can see full registrations for event operations.

**Operations and safety**

- R19. All user-owned writes must be protected by Supabase RLS or equivalent server-side checks.
- R20. Service-role keys must only be used in server-side functions.
- R21. The system must have a documented backup/export path before launch.

---

## Key Technical Decisions

- **Use Supabase Cloud for v1:** Supabase provides hosted Postgres, Auth, magic links, invite email templates, RLS, Storage, Edge Functions, and local development tooling. This fits the product needs better than Railway alone and avoids requiring collaborators to touch Z's server.
- **Keep provider portability by owning migrations:** All schema, RLS, policies, and seed data live in `supabase/migrations/` and `supabase/seed.sql`. Supabase is the managed runtime, not the source of truth.
- **Use magic links only:** Supabase supports passwordless email sign-in via magic links and OTP. This keeps the community app simple and avoids storing or resetting passwords.
- **Gate signup through an invite function:** Public client code must not decide who can create an account. A server-side Supabase Edge Function validates invite codes and uses Supabase Admin Auth to send an invite or magic link.
- **Use Astro plus React islands unless implementation proves otherwise:** Build to Own Club already used Astro, React, Tailwind, and Supabase. Braga AI Builders can reuse that mental model while keeping dynamic surfaces as React islands backed by Supabase.
- **Do not build a custom backend in v1:** A custom Railway/Node backend adds auth and deployment burden before the product proves it needs it. Use Supabase Edge Functions only for privileged seams such as invite validation.
- **Treat Railway as a later add-on:** Railway becomes useful if the project later needs a long-running bot, background jobs, custom API, or WhatsApp integration. It is not the right primary backend for v1.

---

## High-Level Technical Design

```mermaid
flowchart TB
  Visitor[WhatsApp invite visitor] --> Join[/join/:invite_code]
  Join --> InviteFn[Supabase Edge Function: validate invite]
  InviteFn --> Auth[Supabase Auth magic link]
  Auth --> Member[Authenticated member]

  Member --> Profile[Profile and settings]
  Member --> Ideas[Idea feed]
  Member --> Events[Event pages]

  Ideas --> IdeaVotes[(idea_votes)]
  Ideas --> IdeasDb[(ideas)]
  Events --> Registrations[(event_registrations)]
  Profile --> Profiles[(profiles)]

  Admin[Admin member] --> AdminPanel[Admin dashboard]
  AdminPanel --> Invites[(invites)]
  AdminPanel --> EventsDb[(events)]
```

The public app can read published events and safe profile fields. Authenticated members can post ideas, vote once per idea, manage their own profile, and register for events. Admin-only screens manage invites, event publishing, and registration exports.

---

## Output Structure

```text
.
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── .env.example
├── docs/
│   ├── architecture.md
│   ├── local-development.md
│   └── plans/
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   ├── migrations/
│   └── functions/
│       └── request-invite-magic-link/
├── src/
│   ├── components/
│   ├── components/auth/
│   ├── components/events/
│   ├── components/ideas/
│   ├── components/profile/
│   ├── layouts/
│   ├── lib/
│   ├── pages/
│   └── styles/
└── tests/
    ├── integration/
    └── rls/
```

---

## Implementation Units

### U1. Project scaffold and open-source contributor baseline

- **Goal:** Create the public repo structure, development docs, environment templates, and local Supabase workflow.
- **Requirements:** R1, R2, R3.
- **Dependencies:** None.
- **Files:** `README.md`, `LICENSE`, `CONTRIBUTING.md`, `.env.example`, `docs/local-development.md`, `supabase/config.toml`, `package.json`, `astro.config.mjs`, `src/styles/global.css`.
- **Approach:** Start from the Build to Own Club frontend stack only where it helps, but strip the old product scope. Document production secrets as maintainer-only and local development as the default contributor path.
- **Patterns to follow:** Build to Own Club's Astro, React islands, Tailwind, Supabase singleton client, and Bun workflow.
- **Test scenarios:** Test expectation: none -- this unit is scaffolding and documentation, verified by local install and app boot.
- **Verification:** A new contributor can clone the repo, copy `.env.example`, start local Supabase, and run the app without production access.

### U2. Supabase schema, RLS, and seed data

- **Goal:** Define the owned data model and row-level security policies for members, profiles, invites, ideas, votes, events, and registrations.
- **Requirements:** R7, R8, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19.
- **Dependencies:** U1.
- **Files:** `supabase/migrations/001_initial_schema.sql`, `supabase/migrations/002_rls_policies.sql`, `supabase/seed.sql`, `tests/rls/community-access.test.ts`, `docs/architecture.md`.
- **Approach:** Model `profiles`, `invites`, `ideas`, `idea_votes`, `events`, and `event_registrations`. Use unique constraints for one vote per member per idea and one registration per member/email per event. Store admin capability on profiles or a separate membership role table.
- **Patterns to follow:** Supabase RLS-first design, with service-role access reserved for Edge Functions.
- **Test scenarios:**
  - A member can read published events and public profile fields.
  - A member can update only their own profile.
  - A member can create an idea tied to an open cycle.
  - A member can upvote an idea once and cannot create a duplicate vote.
  - A member cannot downvote because no downvote operation or table column exists.
  - A non-admin cannot create, update, or delete events.
  - An admin can read full registration records.
- **Verification:** RLS tests prove the expected allow and deny paths using anon, authenticated member, and admin contexts.

### U3. Invite-gated passwordless auth

- **Goal:** Implement the WhatsApp-shareable invite link flow and email magic-link sign-in without passwords.
- **Requirements:** R4, R5, R6, R7, R20.
- **Dependencies:** U2.
- **Files:** `src/pages/join/[code].astro`, `src/components/auth/InviteEmailForm.tsx`, `src/pages/auth/confirm.astro`, `src/lib/supabase.ts`, `supabase/functions/request-invite-magic-link/index.ts`, `tests/integration/invite-auth.test.ts`.
- **Approach:** The join page accepts an invite code and email. The Edge Function validates the invite, rate limits requests, creates or locates the Supabase user through Admin Auth, sends a magic link or invite email, and records invite usage. The client never sees the service-role key.
- **Patterns to follow:** Supabase `signInWithOtp`, `inviteUserByEmail`, or admin link generation, with custom email templates for Braga AI Builders branding.
- **Test scenarios:**
  - A valid active invite and valid email sends a magic link.
  - An expired invite returns a safe error and sends no email.
  - An exhausted invite returns a safe error and sends no email.
  - Repeated requests are rate limited.
  - Magic link confirmation creates a session and lands the user on profile completion.
  - A direct public signup path cannot create users outside the invite flow.
- **Verification:** Invite flow works locally through Supabase's email testing flow and production configuration keeps signup gated.

### U4. Profiles and settings

- **Goal:** Build authenticated account settings and public profile management.
- **Requirements:** R8, R9, R10.
- **Dependencies:** U2, U3.
- **Files:** `src/pages/settings.astro`, `src/pages/members/[slug].astro`, `src/components/profile/ProfileForm.tsx`, `src/components/profile/ProfileCard.tsx`, `src/lib/profile.ts`, `tests/integration/profile-settings.test.ts`.
- **Approach:** Let members edit display name, handle, bio, links, and avatar. Keep email managed through Supabase Auth and separate from public profile fields.
- **Patterns to follow:** Build to Own Club settings/profile island pattern, with loading and error states for every Supabase mutation.
- **Test scenarios:**
  - A new user is prompted to complete required profile fields.
  - A member can update their own profile and see changes reflected publicly.
  - A member cannot update another member's profile.
  - Public profile pages omit private fields such as email.
  - Invalid handles or duplicate handles show clear errors.
- **Verification:** Profile edits persist, RLS denies cross-user writes, and public pages expose only intended fields.

### U5. Upvote-only idea feed

- **Goal:** Build a Reddit-style feed for activity ideas with member posts and upvotes only.
- **Requirements:** R11, R12, R13, R14, R19.
- **Dependencies:** U2, U3, U4.
- **Files:** `src/pages/ideas.astro`, `src/pages/ideas/[slug].astro`, `src/components/ideas/IdeaComposer.tsx`, `src/components/ideas/IdeaFeed.tsx`, `src/components/ideas/UpvoteButton.tsx`, `src/lib/ideas.ts`, `tests/integration/idea-feed.test.ts`.
- **Approach:** Ideas have title, description, author, status, and cycle/event context. Votes are insert/delete toggles in `idea_votes`; aggregate counts can start as a view or query and move to a materialized counter later if needed.
- **Patterns to follow:** Simple optimistic UI with server-confirmed state, no score math beyond count of upvotes.
- **Test scenarios:**
  - A member can create an idea with valid title and body.
  - Empty or overly long ideas are rejected.
  - A member can upvote and remove their own upvote.
  - A duplicate upvote is blocked by the database constraint.
  - Feed sorting can show top ideas for the current monthly cycle.
  - There is no downvote control, route, mutation, or database field.
- **Verification:** Feed reflects vote counts accurately after refresh and under duplicate-click attempts.

### U6. Events and registrations

- **Goal:** Preserve the useful Build to Own event-page concept for monthly Braga AI Builders meetings.
- **Requirements:** R15, R16, R17, R18, R19.
- **Dependencies:** U2, U3, U4.
- **Files:** `src/pages/events.astro`, `src/pages/events/[slug].astro`, `src/components/events/EventCard.tsx`, `src/components/events/EventRegistrationForm.tsx`, `src/components/events/RegistrationStatus.tsx`, `src/lib/events.ts`, `tests/integration/event-registration.test.ts`.
- **Approach:** Published events have title, date/time, location, description, capacity, registration window, and visibility state. Registrations can link to authenticated profiles and optionally support invited email capture before account completion.
- **Patterns to follow:** Build to Own Club's event page and RSVP shape, but remove the old product-specific copy and Supabase edge email coupling unless needed.
- **Test scenarios:**
  - A published event is visible to visitors.
  - A draft event is visible only to admins.
  - A member can register once for an open event.
  - Duplicate registrations are blocked.
  - Closed or full events do not accept new registrations.
  - Public attendee counts do not reveal private registration data.
  - Admins can view and export full registration lists.
- **Verification:** Registration state is accurate across logged-out, member, and admin views.

### U7. Admin dashboard

- **Goal:** Give trusted organizers a small internal surface for invites, events, registrations, and idea moderation.
- **Requirements:** R15, R18, R19, R20.
- **Dependencies:** U2, U3, U5, U6.
- **Files:** `src/pages/admin/index.astro`, `src/pages/admin/invites.astro`, `src/pages/admin/events.astro`, `src/pages/admin/registrations.astro`, `src/components/admin/InviteManager.tsx`, `src/components/admin/EventEditor.tsx`, `src/lib/admin.ts`, `tests/integration/admin-dashboard.test.ts`.
- **Approach:** Keep admin minimal: create invite batches, publish events, export registrations, hide or close ideas. Enforce admin access through RLS and server-side role checks where service-role actions are needed.
- **Patterns to follow:** Small role-gated React islands, explicit empty/loading/error states, and no service-role key in client code.
- **Test scenarios:**
  - Non-admin members cannot load admin data.
  - Admins can create a WhatsApp-shareable invite code.
  - Admins can publish and unpublish events.
  - Admins can export registrations for one event.
  - Admin actions leave audit-friendly timestamps.
- **Verification:** Admin routes deny non-admin users and admin changes are reflected on public pages.

### U8. Deployment, documentation, and launch hardening

- **Goal:** Prepare the open-source repo and managed services for launch without relying on Hetzner.
- **Requirements:** R1, R2, R3, R21.
- **Dependencies:** U1 through U7.
- **Files:** `.github/workflows/ci.yml`, `docs/deployment.md`, `docs/backup-restore.md`, `docs/security.md`, `README.md`, `CONTRIBUTING.md`.
- **Approach:** Host the frontend on Vercel, Netlify, Cloudflare Pages, or another collaborator-friendly platform. Keep Supabase production credentials in the hosting provider. Add CI for build, typecheck, and RLS/integration tests where practical.
- **Patterns to follow:** Open-source README with local-first setup, no production secrets, and clear maintainer-only deployment notes.
- **Test scenarios:**
  - CI passes on a fresh pull request without production secrets.
  - Preview deployments use safe non-production Supabase credentials.
  - Backup/export docs can be followed by a maintainer.
  - Required environment variables are documented and validated.
- **Verification:** A maintainer can deploy from the public repo without sharing Hetzner, and a contributor can open a PR without production access.

---

## Scope Boundaries

### In scope for v1

- Passwordless email auth through invite links.
- Member profiles and settings.
- Upvote-only activity ideas.
- Monthly event pages and registrations.
- Small admin dashboard for organizers.
- Open-source setup, local development, and deployment documentation.

### Deferred to follow-up work

- WhatsApp API integration or bot automation.
- Comments, threaded discussions, or moderation queues beyond simple idea hiding/closing.
- Payments, paid memberships, sponsors, or ticketing.
- Full self-hosted replacement for Supabase.
- Native mobile app.
- Multi-community tenancy beyond Braga AI Builders.

### Outside this product's identity

- Generic social network behavior.
- Downvote-driven ranking.
- Private server access as the normal collaborator workflow.

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Invite links spread outside the intended group | Make invite codes revocable, expiring, and optionally usage-limited. |
| Supabase free project pauses after inactivity | Use Pro before production if the community depends on reliability. |
| RLS mistakes leak member data | Add RLS tests before launch and keep public profile fields separated from private account data. |
| Service-role key leaks through client code | Confine service-role usage to Edge Functions and CI/production secrets only. |
| Open-source contributors cannot reproduce auth locally | Document local Supabase email testing and seed invite flows. |
| Community needs outgrow Supabase-only architecture | Keep schema in migrations and isolate Supabase-specific privileged logic behind functions. |

---

## Documentation / Operational Notes

- `README.md` should state that production runs on Supabase Cloud and a static frontend host, not Z's Hetzner server.
- `docs/local-development.md` should explain local Supabase, seed invites, and test accounts.
- `docs/security.md` should explain RLS, service-role boundaries, invite abuse controls, and public profile fields.
- `docs/backup-restore.md` should describe Supabase schema migrations, data exports, storage export if avatars are enabled, and how to restore into a new project.
- `CONTRIBUTING.md` should make clear that contributors do not need production access to work on normal features.

---

## Sources / Research

- Supabase passwordless docs: Supabase Auth supports email Magic Links and OTP, with Magic Links enabled by default and one-time links that expire.
- Supabase email template docs: Supabase provides templates for Magic Link, Invite user, confirmation, recovery, and related auth emails, including hosted-dashboard and self-hosted/local configuration paths.
- Supabase pricing page: the free tier includes 50,000 monthly active users, 500 MB database, 1 GB file storage, and 2 active projects, but free projects pause after one week of inactivity; Pro starts at $25/month and includes daily backups.
- Railway pricing page was searched but not used as a primary architectural source because Railway is a hosting/runtime platform, not a direct replacement for managed auth plus RLS-backed Postgres for this v1 scope.
