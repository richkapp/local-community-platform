# Contributing

Thanks for helping build Braga AI Builders.

## Local development

1. Install Bun.
2. Run `bun install`.
3. Copy `.env.example` to `.env`.
4. Run `bun run dev`.

You do not need production Supabase, Vercel, or Hetzner access for normal feature work.

## Pull requests

Before opening a PR:

```bash
bun test
bun run build
```

## Security boundary

Never commit service-role keys, production `.env` files, Supabase access tokens, Vercel tokens, or browser cookies. Privileged Supabase work belongs in Edge Functions and migrations.
