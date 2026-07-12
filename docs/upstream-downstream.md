# Upstream and Braga downstream

Local Community Platform and Braga AI Builders have separate jobs:

| Repository | Role | Production effect |
| --- | --- | --- |
| [`richkapp/local-community-platform`](https://github.com/richkapp/local-community-platform) | Canonical, theme-neutral open-source platform and template | Merges publish platform code; they do not automatically change Braga |
| [`richkapp/braga-ai-builders`](https://github.com/richkapp/braga-ai-builders) | Braga-specific downstream deployment | Its `main` branch is the source for the Braga Vercel deployment |

The repositories share Git history from the split point, but Braga is maintained as a separate downstream repository rather than an automatically synchronized deployment. Braga receives upstream changes only through reviewed pull requests.

GitHub does not support creating a differently named fork under the same owner, so Braga is intentionally a separate shared-history repository with an explicit `upstream` remote rather than a GitHub network fork.

## Where a change belongs

Build directly in Local Community Platform when the change:

- solves a reusable community-platform problem;
- contains no Braga-specific copy, policy, data, or assumptions;
- can be configured by another community;
- includes generic documentation, tests, and safe defaults.

Build in Braga AI Builders when the change:

- is an experiment for Braga members;
- depends on Braga-specific content, operations, or policy;
- is not yet proven useful outside Braga;
- should not appear in every installation.

A feature may start in Braga and move upstream later. Before proposing it upstream, remove Braga-specific assumptions, make installation-level choices configurable, add generic tests and documentation, and explain the reusable community problem it solves.

## Optional features

A reusable feature that not every community wants should normally live upstream behind explicit configuration rather than being permanently reimplemented downstream. Safe defaults matter:

- existing installations should keep their current behavior after an upstream sync;
- optional external services should remain disabled until configured;
- missing optional configuration must not break core data storage or access;
- community identity belongs in `src/config/community.ts`, not scattered through components.

Braga decides which optional features to enable in its downstream configuration.

## Upstream-first workflow

1. Create a feature branch in `local-community-platform`.
2. Implement the generic behavior, tests, migration, and documentation.
3. Run `bun run verify` and merge through a pull request.
4. Tag an upstream release when the change belongs in a release.
5. Open a sync branch in `braga-ai-builders` and merge the new upstream `main`.
6. Resolve Braga-specific configuration deliberately, run verification, and merge the downstream pull request.
7. Apply any Supabase migrations or provider configuration to Braga separately after review. Git synchronization does not mutate the production database or secrets.

## Braga-first workflow

1. Build and validate the experiment on a feature branch in `braga-ai-builders`.
2. Merge it only if Braga should use it.
3. If the result solves a broader platform problem, create a focused upstream branch from `local-community-platform/main`.
4. Port or cherry-pick only the reusable commits. Remove Braga-specific behavior and add generic configuration, tests, and documentation.
5. Open a pull request against Local Community Platform.
6. After the upstream version merges, sync upstream back into Braga so the downstream tracks the canonical implementation.

Do not merge Braga's entire `main` branch into Local Community Platform. Downstream-only history, community configuration, and deployment policy do not belong upstream.

## Syncing Local Community Platform into Braga

A Braga checkout uses these remotes:

```text
origin    git@github.com:richkapp/braga-ai-builders.git
upstream  git@github.com:richkapp/local-community-platform.git
```

Create a reviewed sync branch rather than updating Braga's protected `main` directly:

```bash
git checkout main
git pull --ff-only origin main
git fetch upstream
git checkout -b sync/upstream-YYYY-MM-DD
git merge --no-ff upstream/main
bun run verify
git push -u origin sync/upstream-YYYY-MM-DD
gh pr create --base main --head sync/upstream-YYYY-MM-DD
```

When conflicts occur, preserve intentional Braga configuration while taking the canonical upstream implementation. The pull request should list migrations, new environment or Vault values, and any optional features that remain disabled.

## Security and release policy

- Security fixes should land upstream first whenever practical, then be synced to Braga immediately.
- Braga may receive an emergency downstream fix first, but the reusable fix must be proposed upstream afterward.
- Each repository keeps protected `main`, required verification, and reviewable pull requests.
- Braga production credentials, Supabase data, Vercel settings, and provider keys remain downstream infrastructure. They are never copied into Local Community Platform or any fork.
- The Braga Vercel production project connects to `richkapp/braga-ai-builders`, never this upstream repository.
- A successful Git merge does not prove a deployment or migration succeeded; verify Braga production separately.
