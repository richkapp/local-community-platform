# Braga AI Builders

Open-source community platform for the Braga AI Builders WhatsApp community and monthly meetups.

The app handles:

- invite-gated passwordless sign-in
- member profiles and settings
- a public-safe member directory
- upvote-only ideas for future sessions
- event pages and registrations
- a small organizer admin surface

## Stack

- Astro 5
- React islands
- Tailwind CSS 3
- Supabase Auth, Postgres, RLS, Storage, Edge Functions
- Vercel for hosting
- Bun for package management and scripts

## Quick start

```bash
bun install
cp .env.example .env
bun run dev
```

For real auth/data locally, run Supabase locally or point `.env` at a disposable Supabase project. Production credentials are maintainer-only and are not required for normal open-source contributions.

## Scripts

```bash
bun run dev      # local dev server
bun run check    # Astro/TypeScript checks
bun test         # static project safety tests
bun run build    # check + production build
bun run verify   # tests + build
```

## Production services

- Supabase account for this project: `bragabuilders.bash197@passinbox.com`
- Vercel account for this project: `zkapp@pm.me`

Do not use Z's Hetzner server as the normal contributor or production backend. The repo should remain portable: schema and security policy live in migrations, not in undocumented dashboard state.

## License

MIT
