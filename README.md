# Local AI Community Platform

The open-source platform behind [Braga AI Builders](https://braga-ai-builders.vercel.app). Fork it to give your local AI community a durable home for posts, member profiles, community-shaped events, and organizer tools without losing everything in chat.

## What it includes

- Passwordless member access through Supabase magic links and a configured community-access code
- Required transactional-email consent with an explicit no-marketing promise
- Public posts, anonymous posting and upvoting, categories, and tags
- Optional public member profiles with author hover cards
- Public events that send RSVP traffic to an external event page
- Organizer tools for invites, events, post moderation, and an admin-only member database
- Private-by-default profiles, Row Level Security, restricted RPCs, and Edge Functions
- Astro, React, Tailwind, Supabase, Bun, and Vercel

## Use it for your community

1. Fork this repository or click **Use this template** on GitHub.
2. Edit [`src/config/community.ts`](src/config/community.ts) with your community name, city, WhatsApp link, invite code, and repository URL.
3. Create your own Supabase project and apply the migrations.
4. Configure and deploy the two Edge Functions.
5. Deploy the frontend to your own Vercel project.

Every installation must use its own Supabase and Vercel projects. Forks never connect to Braga's production data.

See **[Self-hosting](docs/self-hosting.md)** for the full setup, including the first invite and organizer account.

## Local development

```bash
bun install
cp .env.example .env
bun run dev
```

Auth and data features require a local or disposable Supabase project. See [Local development](docs/local-development.md).

## Configuration

Public community identity lives in one tracked file:

```ts
// src/config/community.ts
export const communityConfig = {
  name: 'Your Local AI Community',
  city: 'Your City',
  whatsappUrl: 'https://chat.whatsapp.com/...',
  memberInviteCode: 'your-community-invite',
  githubUrl: 'https://github.com/you/your-community-platform'
};
```

Browser-safe Supabase settings belong in `.env`; Edge Function secrets belong in Supabase. Never commit service-role keys, database passwords, deployment tokens, or production `.env` files.

## Commands

```bash
bun run dev      # local development server
bun run check    # Astro and TypeScript diagnostics
bun test         # contract and security tests
bun run build    # diagnostics plus production build
bun run verify   # complete verification gate
```

## Documentation

- [Self-hosting](docs/self-hosting.md)
- [Local development](docs/local-development.md)
- [Deployment](docs/deployment.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE). You may use, modify, host, and redistribute the platform, including for commercial purposes, subject to the license notice.
