# Backup and restore

## What is source-controlled

- database schema and forward-only migrations
- RLS policies
- seed data for local/demo setup
- Edge Function source
- frontend source
- documentation

Source control does **not** back up production Auth users, table rows, Vault secrets, or Storage objects.

## Production backup

Use Supabase's managed backups or a tested export process that covers Postgres, Auth, and Storage together. A table-only dump is not a complete recovery plan.

At minimum, preserve:

### Identity and access

- Supabase Auth users and identities through a supported Supabase backup/export path
- `profiles`
- `invites`
- `invite_redemptions`

### Posts and participation

- `ideas`
- `idea_votes`
- `anonymous_idea_votes`
- `anonymous_idea_activity`
- `idea_bookmarks`
- `post_tags`
- `idea_comments`
- `idea_comment_upvotes`

### Events and operations

- `events`
- `event_registrations`
- `bug_reports`

### Community voting and feature state

- `community_votes`
- `community_vote_options`
- `community_vote_ballots`
- `community_feature_flags`

### Storage and secrets

- every object in the `avatars` bucket, preserving the opaque object name stored in `profiles.avatar_path`
- the installation's Supabase Edge Function secrets and Vault values in a separate encrypted secret-management backup
- Vercel environment variables in the deployment platform's protected configuration

Document backup frequency, retention, encryption, responsible owner, and the date of the latest successful restore drill. Never commit an export or secret inventory to the repository.

## Restore order

1. Create a new Supabase project and apply migrations `001`–`036` in order.
2. Restore Auth users and identities with a supported Supabase process before rows whose foreign keys reference `auth.users`.
3. Restore parent records: `profiles`, `invites`, `ideas`, `events`, `bug_reports`, `post_tags`, `community_votes`, and `community_feature_flags`.
4. Restore dependent records: `invite_redemptions`, post votes/bookmarks, anonymous post activity, event registrations, community vote options/ballots, and comments/upvotes. Restore parent comments before replies or use a reviewed transaction that defers the relevant constraints.
5. Restore `avatars` Storage objects under their original opaque names and verify each object matches `profiles.avatar_path`. Do not make an existing bucket public during restore without auditing its prior contents and settings.
6. Restore Edge Function secrets and Vault values from the encrypted secret store.
7. Set Vercel environment variables and redeploy.

## Recovery verification

Before reopening traffic, verify:

- existing members can sign in and suspended members cannot;
- invite capacity, pending claims, and rolling member invite pools are intact;
- public, private, anonymous, bookmarked, tagged, and commented post behavior matches the source installation;
- nested comments and comment upvotes retain their parentage and attribution mode;
- event data and external RSVP links are complete;
- public profile visibility and avatar URLs work, while non-public profiles remain hidden;
- community vote options, ballots, anonymity choices, deadlines, and public-visibility state are intact;
- admin-only pages and RPCs reject ordinary members;
- bug reports remain available to organizers;
- `/`, `/posts`, `/events`, `/members`, `/voting`, `/terms`, and `/privacy` render successfully.

Keep the source installation read-only until record counts, representative checksums, Storage object counts, and the smoke checks agree. If verification fails, hold the frontend on the previous known-good deployment and correct the new environment forward; do not improvise a destructive down migration.
