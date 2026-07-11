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

Use exact trusted Auth redirect URLs. Keep service-role credentials inside Supabase; never send them to the browser or Vercel frontend environment.

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
- The footer bug-report dialog accepts a detailed report without requiring name or email.
- `/admin/bug-reports` is admin-only and can move reports between new, in review, and done.
- `/signin` requires email consent before requesting a magic link.
- `/admin` rejects non-admin users.
- `/admin/members` exposes the full member database only to admins.
- `/join` returns `404`; only configured coded invite routes are valid.
- `/admin/registrations` returns `404`.

Never test production email delivery with disposable or non-deliverable addresses. Use a controlled deliverable inbox only with explicit approval.
