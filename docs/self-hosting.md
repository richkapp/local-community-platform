# Self-hosting

This guide creates an independent installation for one local community. It does not require or grant access to Braga AI Builders infrastructure or data.

## Prerequisites

- Bun
- Node.js 20 or newer
- A GitHub account
- A Supabase project
- A Vercel project
- Supabase CLI access through `npx supabase`

## 1. Fork and configure the community

Fork the repository, then edit `src/config/community.ts`:

- `name`: public community name
- `city`: city or region shown on the landing page
- `tagline` and `description`: default page title and metadata
- `home`: theme-specific landing-page language and member perspectives
- `whatsappUrl`: public community invitation URL
- `memberInviteCode`: invite code used by the sign-in page
- `githubUrl`: URL of your fork

The member invite code is a public routing value, not a secret. It must match a row in `public.invites`. Use a long, unguessable value if membership is intentionally limited, and do not place private invitation URLs in screenshots or documentation.

## 2. Create and link Supabase

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The migration chain under `supabase/migrations/` is the source of truth. Do not recreate policies manually in the dashboard.

For local sample data only:

```bash
npx supabase db reset
```

`supabase/seed.sql` intentionally uses local-only values and is not production setup.

## 3. Create the production invite

Run this in the Supabase SQL editor, using the same value as `memberInviteCode`:

```sql
insert into public.invites (code, label, max_uses)
values ('YOUR_COMMUNITY_INVITE_CODE', 'Community member access', null)
on conflict (code) do update
set label = excluded.label,
    max_uses = excluded.max_uses,
    revoked_at = null;
```

Set `max_uses` to a positive integer if access should close after a fixed number of successful redemptions. The reference platform intentionally publishes its reusable community-access route; use a private coded `/join/:code` route instead if your membership must remain invitation-only.

## 4. Configure Edge Functions

Supabase automatically supplies its built-in project URL and keys to hosted Edge Functions. Add the application-specific secrets:

```bash
npx supabase secrets set \
  INVITE_REDIRECT_URL=https://YOUR_DOMAIN/auth/confirm \
  IDEA_SIGNUP_INVITE_CODE=YOUR_COMMUNITY_INVITE_CODE \
  COMMUNITY_NAME="Your Community"
```

Deploy all three functions:

```bash
npx supabase functions deploy request-invite-magic-link --no-verify-jwt
npx supabase functions deploy anonymous-ideas --no-verify-jwt
npx supabase functions deploy bug-reports --no-verify-jwt
```

These functions intentionally accept requests without a user JWT. They enforce trusted origins, validate payloads, and perform privileged writes server-side. Keep their service-role access inside Supabase.

## 5. Configure the frontend

Create `.env` from `.env.example` and set:

```env
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
PUBLIC_SUPABASE_ANON_KEY=YOUR_BROWSER_SAFE_ANON_KEY
PUBLIC_SITE_URL=https://YOUR_DOMAIN
```

The anon key is designed for browser use; Row Level Security remains the authorization boundary. Never put a service-role key in a `PUBLIC_` variable.

In `supabase/config.toml`, replace the reference deployment's production callback URL in `additional_redirect_urls` with your own exact `/auth/confirm` URL. The local callback URLs can remain for development.

In Supabase Auth URL settings, set your site URL and add the same exact `/auth/confirm` redirect URLs for production and local development. Avoid broad wildcard redirects.

## 6. Create the first organizer

1. Use the configured invite flow to create your account.
2. In the Supabase SQL editor, promote exactly that account:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'YOUR_ORGANIZER_EMAIL'
);
```

Normal authenticated users cannot promote themselves through the application API.

## 7. Deploy

Import the fork into Vercel, set the three public environment variables, and use:

- Install command: `bun install --frozen-lockfile`
- Build command: `bun run build`

After deployment, update `INVITE_REDIRECT_URL` and Supabase Auth redirect settings to the final domain, redeploy `request-invite-magic-link`, and run the smoke checks in [Deployment](deployment.md).

## 8. Verify isolation

Before inviting members, confirm:

- your fork points only to your Supabase project;
- no Braga production URL or project value remains in your deployment configuration;
- private profiles do not appear in `/members`;
- a normal member cannot open `/admin` or call admin RPCs;
- magic-link requests require the email-consent checkbox;
- untrusted origins cannot call the email, anonymous-post, or bug-report functions.
