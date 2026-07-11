# Local Community Platform

An open-source platform that gives local and interest-based communities a durable home for ideas, resources, perspectives, member profiles, and community-shaped events without losing everything in chat.

[Braga AI Builders](https://braga-ai-builders.vercel.app) is the reference deployment. AI is that community's theme, not a requirement of the software. A neighborhood association, creative collective, professional network, book club, mutual-aid group, or any other community can configure the same platform around its own identity and purpose.

## What it includes

- Passwordless member access through Supabase magic links and a configured community-access code
- Required transactional-email consent with an explicit no-marketing promise
- Public posts, anonymous posting and upvoting, categories, and tags
- Optional public member profiles with author hover cards
- Public events that send RSVP traffic to an external event page
- Organizer tools for invites, events, post moderation, and an admin-only member database
- Public bug reporting with optional contact details and organizer triage
- Private-by-default profiles, Row Level Security, restricted RPCs, and Edge Functions
- Astro, React, Tailwind, Supabase, Bun, and Vercel

## Use it for your community

1. Fork this repository or click **Use this template** on GitHub.
2. Edit [`src/config/community.ts`](src/config/community.ts) with your community identity, landing-page language, chat link, invite code, and repository URL.
3. Create your own Supabase project and apply the migrations.
4. Configure and deploy the three Edge Functions.
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
  name: 'Your Community',
  city: 'Your City',
  tagline: 'A local community for shared interests',
  description: 'A short description of your community.',
  whatsappUrl: 'https://chat.whatsapp.com/...',
  memberInviteCode: 'your-community-invite',
  githubUrl: 'https://github.com/you/local-community-platform',
  home: {
    eyebrow: 'A local community in Your City',
    heroTitle: 'Come meet your people.',
    heroBody: 'Explain who the community is for and what connects its members.',
    experienceRange: ['Member perspective one', 'Member perspective two'],
    experienceFooter: 'A short invitation to participate.',
    closingStatement: 'A final statement about what members share.'
  }
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
