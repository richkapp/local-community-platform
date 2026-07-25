# Local Community Platform

An open-source platform that gives local and interest-based communities a durable home for ideas, resources, perspectives, member profiles, and community-shaped events without losing everything in chat.

[Braga AI Builders](https://braga-ai-builders.vercel.app) is the reference deployment. AI is that community's theme, not a requirement of the software. A neighborhood association, creative collective, professional network, book club, mutual-aid group, or any other community can configure the same platform around its own identity and purpose.

Local Community Platform is the canonical upstream repository. Braga is maintained in a [separate downstream repository](https://github.com/richkapp/braga-ai-builders), so platform development does not automatically change the live Braga community. Reusable Braga-born features can be generalized and proposed upstream; Braga receives upstream releases through reviewed sync pull requests. See [Upstream and Braga downstream](docs/upstream-downstream.md).

## What it includes

- Passwordless existing-member sign-in with accessible Sign In / Sign Up tabs, resend guidance, and private member- and organizer-shared invitation URLs
- Rolling single-use member invitations and bounded organizer campaign links
- Required transactional-email consent with an explicit no-marketing promise
- Public posts with anonymous posting, upvoting, nested comments, bookmarks, saved filters, exact return navigation, an author-first mobile feed, native sharing, categories, and member-created tags
- Optional public member profiles with native avatar uploads, 10 MB HEIC/HEIF support, and author hover cards
- Configurable community-rules consent before visitors receive the WhatsApp invitation link
- Route-aware Open Graph and Twitter cards for community pages, posts, events, invitations, and member profiles
- Optional public community voting with time-bounded single-choice ballots and per-ballot anonymity
- Public events that send RSVP traffic to an external event page
- Organizer tools for invitations, events, voting, moderation, and a private member database
- Centralized super-admin settings for Voting, event creation, anonymous posting, signed-out posting, anonymous comments, and anonymous replies
- Super-admin controls for assigning admins, suspending access, and deleting members
- Public bug reporting with optional contact details, organizer triage, and optional email notifications
- A public, deterministic `/create` launcher that prepares a capability-matched setup path without running an AI or collecting credentials
- Private-by-default profiles, Row Level Security, restricted RPCs, and Edge Functions
- Astro, React, Tailwind, Supabase, Bun, and Vercel

## Use it for your community

Every deployed copy includes a footer link to `/create`. The launcher asks about the organizer's technical comfort, computer, AI tools, and community, then produces a tagged-release setup brief or a staged installation journey. It runs entirely in the browser, calls no LLM or provider API, keeps browser progress on the user's device for 30 days, and supports portable recovery files.

For direct setup:

1. Fork this repository or click **Use this template** on GitHub.
2. Edit [`src/config/community.ts`](src/config/community.ts) with your community identity, landing-page language and optional imagery, chat link and rules, repository URL, and legal jurisdiction.
3. Create your own Supabase project and apply the migrations.
4. Configure and deploy the three Edge Functions.
5. Deploy the frontend to your own Vercel project.

Every installation must use its own Supabase and Vercel projects. Forks never connect to Braga's production data.

See **[Self-hosting](docs/self-hosting.md)** for the guided and direct setup paths, including the one-time bootstrap invitation and organizer account.

### Optional bug-report email

Bug reports are always stored in Supabase and available to organizers at `/admin/bug-reports`. Email alerts are optional and use Resend through a database trigger; the platform does not contain or inherit Braga's credentials.

A fork can use a free Resend account without configuring a domain by sending from `Local Community Platform <onboarding@resend.dev>` to the email address attached to that same Resend account. Resend treats this as testing mode and blocks other recipients until the installation verifies its own domain. See the [self-hosting notification setup](docs/self-hosting.md#optional-bug-report-email) for Vault configuration, current free-plan limits, and the verified-domain path.

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
  locale: 'en-GB',
  timeZone: 'Europe/Lisbon',
  timeZoneLabel: 'Your city time',
  tagline: 'A local community for shared interests',
  description: 'A short description of your community.',
  communityChannel: {
    enabled: false,
    providerName: 'Your chat provider',
    url: 'https://your-provider.example/invite', // enable only after replacing this value
    joinLabel: 'Join the community channel',
    openLabel: 'Agree and open the channel',
    name: 'Your local community channel',
    groupName: 'Your community group',
    expectationsTitle: 'Community expectations',
    introduction: 'Explain the purpose of these rules.',
    principles: ['Welcome people respectfully.', 'Protect member privacy.'],
    eligibility: 'Explain who may join.',
    rulesConsentLabel: 'I agree to the community rules and confirm I am eligible to join.',
    inviteConsentLabel: 'I agree to receive and responsibly use the community invitation.',
    expectations: [
      { title: 'Keep invite links private', body: 'Do not publish private group links.' }
    ],
    adminAuthority: 'Explain how organizers enforce the rules.',
    minors: 'Explain any age-related guidance.'
  },
  githubUrl: 'https://github.com/you/local-community-platform',
  legal: {
    operatorName: 'Your Community Organizers',
    country: 'Your Country',
    governingLaw: 'Your governing law',
    privacyFrameworkName: 'Your privacy framework',
    privacyFrameworkShortName: 'Privacy law',
    privacyFrameworkUrl: 'https://example.com/privacy-law',
    dataProtectionAuthorityName: 'Your data-protection authority',
    dataProtectionAuthorityUrl: 'https://example.com/authority'
  },
  home: {
    eyebrow: 'A local community in Your City',
    heroTitle: 'Come meet your people.',
    heroBody: 'Explain who the community is for and what connects its members.',
    heroImage: { src: '', alt: '', credit: '', creditUrl: '' },
    experienceTitle: 'Different experience levels are welcome.',
    experienceAccent: 'Shared curiosity matters.',
    experienceRange: ['Member perspective one', 'Member perspective two'],
    experienceFooter: 'A short invitation to participate.',
    memoryTitle: 'The chat is the conversation. This site is the memory.',
    memoryBody: 'Explain why useful community knowledge should stay findable.',
    postsBody: 'Explain what members should share.',
    eventsBody: 'Explain how community interests become events.',
    membersBody: 'Explain the value of the member directory.',
    membershipImage: { src: '', alt: '', credit: '', creditUrl: '' },
    membershipTitle: 'A profile when you want one.',
    membershipBody: 'Explain what signed-in members can manage.',
    closingStatement: 'A final statement about what members share.',
    closingBody: 'A short final invitation.'
  }
};
```

Browser-safe Supabase settings belong in `.env`; Edge Function secrets and notification credentials belong in Supabase's secret stores. Never commit service-role keys, database passwords, deployment tokens, provider API keys, or production `.env` files.

Set `PUBLIC_SITE_URL` to the production origin so canonical URLs and social-card metadata point to the correct installation.

The included Terms and Privacy pages are configurable starter templates, not legal advice. Replace the `legal` values and have the pages reviewed for your operator, providers, users, and jurisdiction before launch.

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
- [Upstream and Braga downstream](docs/upstream-downstream.md)
- [Local development](docs/local-development.md)
- [Deployment](docs/deployment.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE). You may use, modify, host, and redistribute the platform, including for commercial purposes, subject to the license notice.
