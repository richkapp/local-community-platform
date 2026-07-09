# Local development

## App

```bash
bun install
cp .env.example .env
bun run dev
```

The app can boot with placeholder Supabase values, but auth and database features require a real Supabase project or local Supabase.

## Supabase local flow

```bash
npx supabase start
npx supabase db reset
npx supabase functions serve request-invite-magic-link --env-file .env
```

Use the local Inbucket email UI from Supabase to inspect magic-link emails.

## Production account boundary

Production Supabase should be under `bragabuilders.bash197@passinbox.com`. Production Vercel should be under `zkapp@pm.me`. Contributors should not need access to either account for normal PRs.
