# Deployment

## Supabase

1. Create a Supabase project under `bragabuilders.bash197@passinbox.com`.
2. Apply migrations from `supabase/migrations/`.
3. Seed initial data if needed with `supabase/seed.sql`.
4. Deploy `request-invite-magic-link`.
5. Set Edge Function secrets:
   - `BRAGA_SUPABASE_URL`
   - `BRAGA_SUPABASE_ANON_KEY`
   - `BRAGA_SUPABASE_SERVICE_ROLE_KEY`
   - `INVITE_REDIRECT_URL`

Current production project:

- Project ref: `ygihxknsnrngcvrvdxzl`
- Region: `eu-west-3`
- Invite function: `request-invite-magic-link`
- Default invite route: `/join/braga-whatsapp`

The function also supports Supabase's built-in `SUPABASE_*` env names when present, but the hosted project uses the `BRAGA_SUPABASE_*` secrets because custom Supabase Edge Function secrets cannot start with `SUPABASE_`.

## Vercel

1. Create/link the project under `zkapp@pm.me`.
2. Set public env vars:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `PUBLIC_SITE_URL`
3. Build command: `bun run build`.
4. Install command: `bun install`.
5. Deploy and verify `/`, `/join/braga-whatsapp`, `/ideas`, and `/events`.

Current production project:

- Team: `Braga AI Builders` (`braga-ai-builders`)
- Project: `braga-ai-builders`
- Expected production URL: `https://braga-ai-builders.vercel.app`
- Framework preset: Astro
- Install command: `bun install`
- Build command: `bun run build`
- Current deployment path: Vercel CLI with the signed-in `zkapp@pm.me` browser session token.
- GitHub auto-deploy status: not connected yet. `vercel git connect` returned `You need to add a Login Connection to your GitHub account first.` Add the GitHub login connection in Vercel, then run `vercel git connect git@github.com:0rderfl0w/braga-ai-builders.git` from this repo.

Do not deploy this on Z's Hetzner server as the normal production target.
