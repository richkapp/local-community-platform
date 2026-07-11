# Local development

## App

```bash
bun install
cp .env.example .env
bun run dev
```

Edit `src/config/community.ts` for community identity. Fill `.env` with browser-safe settings from a local or disposable Supabase project.

## Local Supabase

Docker is required by the Supabase local stack.

```bash
npx supabase start
npx supabase db reset
npx supabase functions serve request-invite-magic-link --env-file .env
npx supabase functions serve anonymous-ideas --env-file .env
```

Use Supabase Inbucket locally to inspect magic-link email output. Do not send production test messages to disposable addresses.

## Verification

```bash
bun run verify
```

The full gate runs Bun tests, Astro/TypeScript diagnostics, and the production build.

## Production boundary

Contributors do not need access to the reference deployment's Supabase, Vercel, email, or database accounts. Use your own disposable development project. Never copy production credentials into issues, pull requests, fixtures, screenshots, or local setup documentation.
