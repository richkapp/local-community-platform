# Deployment

## Supabase

1. Create a Supabase project under `bragabuilders.bash197@passinbox.com`.
2. Apply migrations from `supabase/migrations/`.
3. Seed initial data if needed with `supabase/seed.sql`.
4. Deploy `request-invite-magic-link`.
5. Set Edge Function secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `INVITE_REDIRECT_URL`

## Vercel

1. Create/link the project under `zkapp@pm.me`.
2. Set public env vars:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `PUBLIC_SITE_URL`
3. Build command: `bun run build`.
4. Install command: `bun install`.
5. Deploy and verify `/`, `/join/braga-whatsapp`, `/ideas`, and `/events`.

Do not deploy this on Z's Hetzner server as the normal production target.
