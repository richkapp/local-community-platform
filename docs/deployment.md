# Deployment

Production deployments use Supabase for Auth/Postgres/Edge Functions and Vercel for the Astro frontend. Each community owns separate projects and data.

## Release gate

```bash
bun install --frozen-lockfile
bun run verify
```

Do not deploy when this command fails.

## Supabase

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase secrets set \
  INVITE_REDIRECT_URL=https://YOUR_DOMAIN/auth/confirm \
  IDEA_SIGNUP_INVITE_CODE=YOUR_COMMUNITY_INVITE_CODE \
  COMMUNITY_NAME="Your Community"
npx supabase functions deploy request-invite-magic-link --no-verify-jwt
npx supabase functions deploy anonymous-ideas --no-verify-jwt
npx supabase functions deploy bug-reports --no-verify-jwt
```

Bug-report email is optional. Without the Vault values below, reports still save and remain available at `/admin/bug-reports`; only outbound email is skipped.

For Resend's free no-domain mode, configure Supabase Vault after migrations are applied:

```sql
select vault.create_secret('YOUR_RESEND_API_KEY', 'RESEND_API_KEY', 'Bug-report notification provider key');
select vault.create_secret('YOUR_RESEND_ACCOUNT_EMAIL', 'BUG_REPORT_NOTIFICATION_EMAIL', 'Bug-report recipient');
select vault.create_secret('Local Community Platform <onboarding@resend.dev>', 'BUG_REPORT_FROM_EMAIL', 'Shared no-domain sender');
select vault.create_secret('https://YOUR_DOMAIN/admin/bug-reports', 'BUG_REPORT_ADMIN_URL', 'Bug-report review URL');
select vault.create_secret('Your Community', 'COMMUNITY_NAME', 'Notification subject label');
```

In no-domain mode, `YOUR_RESEND_ACCOUNT_EMAIL` must exactly match the email attached to the Resend account. Resend blocks other recipients when `onboarding@resend.dev` is used. For branded sending or additional recipients, verify the installation's own domain and replace `BUG_REPORT_FROM_EMAIL` with `Your Community <noreply@YOUR_VERIFIED_DOMAIN>`.

Vault secret names are unique. Use `vault.update_secret(...)` rather than creating a duplicate when rotating a value. Migration `022_bug_report_notifications.sql` queues an asynchronous, report-scoped idempotent Resend request from the database insert boundary, so direct trusted inserts and Edge Function submissions follow the same delivery path. See [Self-hosting: Optional bug-report email](self-hosting.md#optional-bug-report-email) for current free-plan limits and Resend's official restrictions.

Use exact trusted Auth redirect URLs. Keep service-role credentials inside Supabase; never send them to the browser or Vercel frontend environment. Every installation must use its own Resend account and credentials when notification email is enabled.

The first organizer must be bootstrapped as `super_admin` through a trusted SQL maintenance session. Super admins can assign ordinary admins, suspend or restore accounts, and permanently delete members. Ordinary admins retain organizer tools but cannot manage member access.

## Vercel

Set:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_SITE_URL`

Use `bun install --frozen-lockfile` and `bun run build`. Connect the public GitHub repository so merged `main` commits are the production source of truth.

## Production smoke checks

Check these after every release:

- `/` returns `200` and the WhatsApp/GitHub links are correct.
- `/ideas` loads posts and author profile links.
- `/events` loads published events and external RSVP links.
- `/members` exposes only opted-in public profiles.
- The footer bug-report dialog accepts a detailed report without requiring name or email, and configured notification delivery reaches the organizer inbox.
- `/admin/bug-reports` is admin-only and can move reports between new, in review, and done.
- `/admin/members` lets a super admin assign admins, suspend/restore members, and delete a controlled test account; ordinary admins cannot call those RPCs.
- `/signin` requires email consent before requesting a magic link.
- `/admin` rejects non-admin users.
- `/admin/members` exposes the full member database only to admins.
- `/join` returns `404`; only configured coded invite routes are valid.
- `/admin/registrations` returns `404`.

Never test production email delivery with disposable or non-deliverable addresses. Use a controlled deliverable inbox only with explicit approval.
