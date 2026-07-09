# Backup and restore

## What is source-controlled

- database schema
- RLS policies
- seed data for local/demo setup
- Edge Function source
- frontend source
- documentation

## Production backup

Before launch, configure a recurring Supabase export process or upgrade to a plan with backups. At minimum, document how to export:

- `profiles`
- `invites`
- `invite_redemptions`
- `ideas`
- `idea_votes`
- `events`
- `event_registrations`
- storage buckets if avatars are enabled

## Restore outline

1. Create a new Supabase project.
2. Apply migrations.
3. Import exported table data.
4. Restore storage objects.
5. Set Edge Function secrets.
6. Update Vercel env vars.
7. Redeploy and smoke test auth, ideas, events, and admin.
