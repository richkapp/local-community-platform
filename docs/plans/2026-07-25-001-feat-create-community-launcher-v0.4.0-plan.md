# Promote the Create Community Launcher to `v0.4.0`

**Status:** Implemented and verified
**Date:** 2026-07-25
**Branch:** `feat/create-community-launcher-v0.4.0`

## Objective

Promote the production-proven, theme-neutral `/create` wizard from the Braga reference deployment into Local Community Platform upstream without importing downstream branding, production configuration, or data.

## Scope

### Product code

- Add `src/lib/createCommunityLauncher.ts` for capability routing, deterministic prompt generation, source pinning, recovery validation, and legacy-answer migration.
- Add `src/components/create-community/CreateCommunityLauncher.tsx` for the accessible staged interface.
- Add `src/pages/create.astro` as the public route.
- Add a footer-only `/create` link.

### Contracts

- Add domain and static-source tests for routing, release pinning, selected AI/OS/tooling context, generated-prompt safety, untrusted input bounds, strict recovery import/export, and footer-only discoverability.
- Add a hydrated component smoke test for the local-coding route.
- Add `/create` to the verified static build manifest.

### Documentation and release

- Record upstream product requirements.
- Explain the guided route in README and self-hosting documentation.
- Set package and launcher source contracts to `0.4.0`.
- Add release notes.
- Merge through a reviewed pull request and publish `v0.4.0`.

## Exclusions

- No database migration.
- No native LLM, provider API, analytics, managed provisioning, or stored credentials.
- No Braga assets, production identifiers, configuration, or deployment changes.
- No shared identity, central registry, canonical creator network, or automatic fork discovery.
- No automatic sync into the Braga deployment before the public upstream release exists.

## Implementation sequence

1. Branch from clean upstream `main`.
2. Copy only the five generic launcher source/test files.
3. Remove visible and generated Braga assumptions.
4. Change all source contracts and tests from `v0.3.0` to `v0.4.0`.
5. Integrate the footer link, build manifest, package metadata, changelog, README, self-hosting guide, and requirements.
6. Run focused tests, then `bun run verify`, `git diff --check`, and repository secret/identifier scans.
7. Exercise technical, browser-only/helper, local-coding, and autonomous-agent routes locally at desktop and mobile widths; verify persistence, recovery, clipboard, staged milestones, and zero browser-console errors.
8. Review the complete diff for upstream boundaries, correctness, security, accessibility, and maintainability.
9. Push the branch, open a focused PR, require CI, and merge only after the branch is mergeable and checks pass.
10. Publish `v0.4.0`, clone the public tag into a fresh directory, run a frozen install and full verification, and verify the release tag tree equals merged `main`.

## Verification gate

```bash
bun test tests/create-community-launcher.test.ts tests/create-community-launcher-component.test.tsx
bun run verify
git diff --check
git status --short --branch
```

The release is incomplete until a fresh public-tag clone passes the same repository verification gate.

## Rollback

Before release, close the PR and delete the feature branch. After release, fix forward with a patch release; do not move or rewrite the public tag.
