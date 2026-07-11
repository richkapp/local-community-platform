# Contributing

Thanks for helping local AI communities keep their knowledge, people, and events accessible outside chat.

## Before opening a pull request

1. Fork the repository and create a focused branch.
2. Keep community-specific values in `src/config/community.ts`; do not hardcode them throughout the app.
3. Put schema, grants, policies, and RPC changes in forward-only files under `supabase/migrations/`.
4. Add or update tests for observable behavior and security boundaries.
5. Run:

```bash
bun install --frozen-lockfile
bun run verify
```

## Product boundaries

- Profiles are private by default and appear publicly only after opt-in.
- Private account data must never be exposed through public views or frontend queries.
- Authentication is passwordless and uses the installation's configured community-access code.
- Magic-link email requests require explicit transactional-email consent.
- Posts and voting do not require a member profile.
- Voting is upvote-only.
- Event creation and post moderation are organizer-only.
- Member database access is organizer-only.
- Service-role keys belong only in trusted Edge Functions or maintainer operations.

## Pull requests

Describe:

- the user problem;
- the behavior changed;
- security or privacy implications;
- migrations or deployment steps;
- verification performed.

Keep pull requests reviewable. Do not combine unrelated refactors with product changes.

## Commit style

Use concise conventional commits when practical:

- `feat:` new user-visible capability
- `fix:` corrected behavior
- `docs:` documentation only
- `test:` tests only
- `chore:` tooling or maintenance

## Sensitive information

Never commit production `.env` files, service-role keys, database passwords, deployment tokens, auth links, browser sessions, member exports, or private email addresses. If sensitive information reaches Git history, follow [SECURITY.md](SECURITY.md) immediately.
