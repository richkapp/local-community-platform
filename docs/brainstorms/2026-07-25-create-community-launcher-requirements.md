# Create Community Launcher — Product Requirements

**Status:** Accepted for Local Community Platform `v0.4.0`
**Date:** 2026-07-25
**Owner:** Local Community Platform upstream

## Product decision

The generic `/create` wizard is fundamental Local Community Platform functionality. It belongs in the canonical upstream repository and ships with every installation. Community branding, deployment configuration, credentials, infrastructure identifiers, and production data remain downstream.

## Problem

The platform is publicly forkable, but the ordinary self-hosting path assumes familiarity with source control, local development, hosted databases, transactional email, and deployment providers. Most community organizers do not know which steps their existing AI can perform, where credentials belong, or what proves a launch is actually complete.

The launcher must bridge that gap without becoming a hosted installer, provisioning service, native AI, credential broker, or centralized community platform.

## Goals

- Give every organizer an honest path from intent to an independently owned installation.
- Route by demonstrated capability rather than AI brand or vague confidence.
- Keep setup prompts pinned to one tested public release.
- Teach tools only when needed and one action at a time.
- Keep every maintained module installed; configure availability later through super-admin Settings.
- Keep source, accounts, credentials, deployment, and member data under the organizer's control.
- Distinguish a reachable website from a verified community launch.

## Non-goals

- Running or proxying an LLM.
- Creating provider accounts or projects automatically.
- OAuth provisioning, stored provider tokens, or centrally held credentials.
- Managed hosting, paid installation, DNS automation, or ongoing operations.
- A shared member identity, community registry, discovery network, or multi-tenant backend.
- Generating different source trees based on selected modules.
- Proving a clean-room launch with fresh external accounts through automated tests alone.

## Personas and routes

### Technical organizer

Uses GitHub and the terminal. Receives the pinned release, self-hosting guide, concise community profile, ownership rules, and proof gate.

### Organizer with a capable local coding AI

Uses a tool that can read files and run commands. The launcher gives it one installation stage at a time. The organizer performs provider-dashboard actions.

### Organizer with a capable autonomous agent

Uses a tool that can work locally and operate approved browser sessions. The same staged journey applies, but every external side effect still requires explicit approval.

### Browser-only organizer

Uses ordinary browser chat or an unsupported local tool. Receives an official setup prompt for a capable local tool plus a complete, non-secret handoff for a trusted technical helper.

## Functional requirements

1. `/create` is public and requires no launcher account, membership, or payment.
2. The launcher asks technical comfort, existing AI, operating system, local installation state, file/command capability, and browser capability before selecting a route.
3. Brand names tailor wording and official links; capability answers decide the route.
4. Community intake asks only name, place, purpose, audience, organizer, and platform language.
5. User-provided text is bounded, normalized, and embedded inside an explicit untrusted-data block in generated prompts.
6. Technical users may open the exact release and self-hosting guide before completing the optional profile brief.
7. Local-agent routes expose nine ordered stages: source preflight, community identity, GitHub ownership, Supabase/database, production email, Vercel deployment, organizer settings, first-member proof, and launch report.
8. Exactly one stage is actionable at a time. Later stages remain locked until the organizer confirms the current stage was verified from real output.
9. “I’m stuck” produces a diagnostic prompt; it does not collect raw errors, logs, or credentials.
10. Browser progress uses local storage only. Recovery export/import uses strict, bounded, versioned JSON containing only whitelisted answers and contiguous completed-stage identifiers.
11. Changing route answers resets stage progress. Changing community facts reopens identity and every dependent stage.
12. The interface separately marks **Site live** after deployment and **Community ready** only after the complete proof sequence.
13. The primary community navigation remains focused on community participation. `/create` is discoverable from the footer.

## Security and ownership requirements

- The launcher performs no fetch, beacon, analytics, provider, or AI request.
- No field requests passwords, tokens, keys, connection strings, SMTP values, environment contents, private invitation URLs, or member data.
- Generated prompts tell users to enter sensitive values only in official provider interfaces or local environment files and never print them back.
- Prompts require approval before account creation, remote repository creation or push, deployment, paid resources, DNS changes, or controlled email tests.
- The source prompt names a fixed tag, release page, repository, and tagged self-hosting guide.
- The installation flow must stop on source, version, permission, test, build, migration, or proof mismatches rather than inventing missing controls.
- Every installation uses organizer-owned GitHub, Supabase, email, database, and Vercel accounts.
- Existing production projects, URLs, member records, secrets, and downstream branding must not enter a new installation.

## Release requirements

- Package version, launcher release tag, release URL, clone command, and tagged guide must all name `v0.4.0`.
- Upstream verification and browser QA must pass before merge.
- The public tag must point to the merged upstream tree and be published as a non-draft, non-prerelease release.
- A fresh clone of the public tag must install with the frozen lockfile, pass the full verification gate, and contain `/create`, `/admin/settings`, and the complete migration chain.
- Downstream deployments repin only after the public release exists and must ship through their own reviewed deployment path.

## Acceptance criteria

- Technical, browser-only, local-coding, and autonomous-agent routes are reachable from realistic answer combinations.
- Every generated artifact references `v0.4.0`, includes the selected AI/OS/tooling context, treats community data as bounded and untrusted, asks for no credential, and redacts common secret patterns.
- Recovery round-trips only approved fields and rejects malformed, unknown-enum, wrong-version, or non-contiguous progress payloads.
- The page works on desktop and mobile, supports keyboard interaction, moves focus to each new heading, announces status, and respects reduced motion.
- The footer contains `/create`; primary navigation does not.
- Build output contains the static `/create` route.
- Automated tests, type checks, build checks, whitespace checks, secret scanning, and local browser QA pass with no application console errors.

## Provenance

The capability-first launcher was proven in the Braga AI Builders downstream deployment before focused promotion. Braga remains the reference deployment; its name, assets, URLs, infrastructure, credentials, and data are not part of the upstream launcher contract.
