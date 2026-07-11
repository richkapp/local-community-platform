# Security policy

## Supported version

Security fixes are applied to the latest release on `main`.

## Reporting a vulnerability

Do not open a public issue for vulnerabilities involving authentication, Row Level Security, invite bypasses, private member data, privileged RPCs, service-role credentials, or secret exposure.

Use GitHub's private vulnerability reporting for this repository. Include:

- affected route, table, function, or policy;
- reproduction steps;
- expected and observed authorization behavior;
- impact;
- suggested mitigation, if known.

Do not access, modify, or retain data belonging to real members while testing. Use your own installation and test identities whenever possible.

## Security model

- Supabase Row Level Security is the primary data-authorization boundary.
- Public browser clients use only the anon key.
- Service-role access is restricted to Edge Functions and maintainer operations.
- Profiles are private by default.
- Public author cards contain only fields from opted-in public profiles.
- Admin member access uses an admin-guarded RPC.
- Invite redemption is reserved and finalized server-side.
- Edge Functions validate trusted origins and request payloads.

## Secret exposure

If a credential is committed or posted publicly:

1. Revoke or rotate it immediately.
2. Remove it from the current tree.
3. Assess Git history and build artifacts.
4. Notify affected maintainers privately.
5. Treat history rewriting as cleanup, not as a substitute for rotation.

Supabase anon keys and project URLs are browser-visible by design, but they still rely on correct RLS. Service-role keys, database passwords, provider tokens, and session credentials are always secrets.
