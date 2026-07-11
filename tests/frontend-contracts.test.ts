import { describe, expect, test } from 'bun:test';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

describe('launch frontend contracts', () => {
  test('idea authors hydrate through the least-privilege public profile view', async () => {
    const feed = await read('src/components/ideas/IdeaFeed.tsx');
    const detail = await read('src/components/ideas/IdeaDetail.tsx');
    const ideaLib = await read('src/lib/ideas.ts');
    const authorPreview = await read('src/components/ideas/PostAuthorPreview.tsx');
    expect(feed).toContain('attachPublicAuthors');
    expect(detail).toContain('attachPublicAuthors');
    expect(ideaLib).toContain(".from('idea_public_authors')");
    expect(ideaLib).toContain('linkedin_url');
    expect(feed).toContain('PostAuthorPreview');
    expect(detail).toContain('PostAuthorPreview');
    expect(authorPreview).toContain('`/members/${profile.handle}`');
    expect(authorPreview).toContain('group-hover:visible');
    expect(authorPreview).toContain('FaLinkedinIn');
    expect(authorPreview).toContain('FaGithub');
    expect(authorPreview).toContain('FaXTwitter');
    expect(authorPreview).toContain('LuGlobe');
    expect(feed).not.toContain('profiles!ideas_author_id_fkey');
    const admin = await read('src/lib/admin.ts');
    expect(admin).toContain('attachPublicAuthors');
    expect(admin).not.toContain('profiles!ideas_author_id_fkey');
  });

  test('member details use the dedicated profile component', async () => {
    const route = await read('src/pages/members/[handle].astro');
    expect(route).toContain('MemberProfile');
    expect(route).toContain('Astro.params.handle');
    expect(route).not.toContain('MemberDirectory');
  });

  test('mobile navigation and auth-aware controls are wired', async () => {
    const nav = await read('src/components/Nav.astro');
    expect(nav).toContain('mobile-menu');
    expect(nav).toContain('AuthStatus client:load');
    expect(nav).toContain('href="/ideas"');
    expect(nav).toContain('href="/events"');
    expect(nav).toContain('href="/members"');
    expect(nav.match(/>Posts<\/a>/g)).toHaveLength(2);
    expect(nav).not.toContain('>Ideas</a>');
  });

  test('idea posting offers anonymous or account attribution without losing the draft', async () => {
    const composer = await read('src/components/ideas/IdeaComposer.tsx');
    const draft = await read('src/lib/ideaDraft.ts');
    const votes = await read('src/components/ideas/UpvoteButton.tsx');
    const feed = await read('src/components/ideas/IdeaFeed.tsx');
    const ideas = await read('src/lib/ideas.ts');
    const callback = await read('src/components/auth/AuthCallback.tsx');
    const events = await read('src/components/events/EventRegistrationForm.tsx');
    const profile = await read('src/components/profile/ProfileForm.tsx');
    expect(composer).not.toContain('AuthRequired');
    expect(composer).toContain('Post anonymously');
    expect(composer).toContain('Create account and post');
    expect(composer).toContain('Post with my profile');
    expect(composer).toContain('Add a post');
    expect(composer).toContain('Share an idea, resource, or perspective with the community.');
    expect(composer).not.toContain('Add a RIP');
    expect(composer).toContain('RipTaxonomyPicker');
    expect(draft).toContain('braga-idea-draft-v1');
    expect(draft).toContain("context: 'ideas'");
    expect(callback).toContain("'/ideas?restoreIdea=1'");
    expect(votes).not.toContain('No account needed');
    expect(feed).toContain('Sign in or create an account with a magic link');
    expect(feed).toContain('Next event:');
    expect(feed).toContain('RIP_CATEGORIES');
    expect(feed).toContain('RIP_TAGS');
    expect(feed).toContain('categoryFilter');
    expect(feed).toContain('tagFilter');
    expect(feed).toContain('updateOwnIdea');
    expect(feed).toContain('Mark done');
    expect(feed).toContain('deleteIdea');
    expect(ideas).toContain('createAnonymousIdea');
    expect(ideas).toContain('supabase.auth.getSession()');
    expect(events).toContain('isAnonymousUser');
    expect(profile).toContain('isAnonymousUser');
  });

  test('public events use external RSVP pages without exposing attendee counts', async () => {
    const list = await read('src/components/events/EventList.tsx');
    const detail = await read('src/components/events/EventDetail.tsx');
    const manager = await read('src/components/admin/EventManager.tsx');
    const preview = await read('src/pages/api/event-preview.ts');
    expect(list).not.toContain('registration_count');
    expect(detail).toContain('RSVP on Luma');
    expect(detail).not.toContain('EventRegistrationForm');
    expect(manager).toContain('Publish event');
    expect(list).toContain('See event ↗');
    expect(list).toContain('Past events');
    expect(list).toContain('LuPencil');
    expect(list).toContain('updateEvent');
    expect(preview).toContain("record['@type'] === 'Event'");
  });

  test('favicon and branded not-found page exist', async () => {
    await access(new URL('public/favicon.svg', root));
    await access(new URL('src/pages/404.astro', root));
    expect(await read('src/layouts/BaseLayout.astro')).toContain('rel="icon"');
  });

  test('landing and members routes expose only the requested community CTAs', async () => {
    const home = await read('src/pages/index.astro');
    const members = await read('src/components/profile/MemberDirectory.tsx');
    const authStatus = await read('src/components/auth/AuthStatus.tsx');
    const config = await read('src/config/community.ts');
    const footer = await read('src/components/Footer.astro');
    expect(home).toContain('Join WhatsApp Community');
    expect(home).toContain('communityConfig.whatsappUrl');
    expect(config).toContain('https://chat.whatsapp.com/GwhqmjtwcPT4vVmQmqqIRW');
    expect(config).toContain('https://github.com/richkapp/local-community-platform');
    expect(config).toContain("tagline: 'A local AI community'");
    expect(config).toContain("heroTitle: 'Curious about AI? Come meet your people.'");
    expect(home).toContain('communityConfig.tagline');
    expect(home).toContain('communityConfig.description');
    expect(home).toContain('communityConfig.home');
    expect(home).toContain('Browse Posts');
    expect(config).toContain('Curious about AI? Come meet your people.');
    expect(home).toContain('WhatsApp is the conversation. This site is the memory.');
    expect(home).toContain('Your name, attached to what you share.');
    expect(home).toContain('Anyone can browse posts, publish, and vote without an account.');
    expect(home).toContain('Shape local events');
    expect(home).not.toContain('How to join');
    expect(authStatus).not.toContain('Use private invite');
    expect(authStatus).toContain('Sign In');
    expect(members).toContain('Become a Member');
    expect(members).toContain('memberInvitePath');
    expect(footer).toContain('This site is powered by');
    expect(footer).toContain('Local Community Platform');
    expect(footer).toContain('an open-source platform for managing local communities.');
    expect(footer).toContain('text-limewash underline');
    expect(footer).toContain('BugReportDialog client:load');
    expect(footer).not.toContain('Source code');
    await expect(access(new URL('src/pages/join.astro', root))).rejects.toThrow();
  });

  test('the public bug-report dialog requires useful detail without requiring identity', async () => {
    const dialog = await read('src/components/bug-reports/BugReportDialog.tsx');
    const client = await read('src/lib/bugReports.ts');
    expect(dialog).toContain('🐞 Report a Bug');
    expect(dialog).toContain('how you found the bug');
    expect(dialog).toContain('required');
    expect(dialog).toContain('minLength={20}');
    expect(dialog).toContain('type="email"');
    expect(dialog).toContain('Optional');
    expect(dialog).toContain('name="website"');
    expect(dialog).toContain('window.location.href');
    expect(dialog).toContain('max-h-[calc(100dvh-2rem)]');
    expect(dialog).toContain('overflow-y-auto');
    expect(client).toContain('/functions/v1/bug-reports');
    expect(client).toContain('getBugReportVisitorId');
  });

  test('sign in and account creation use one clearly explained magic-link flow', async () => {
    const page = await read('src/pages/signin.astro');
    const form = await read('src/components/auth/InviteEmailForm.tsx');
    const composer = await read('src/components/ideas/IdeaComposer.tsx');
    expect(page).toContain('Sign in or create your account');
    expect(page).toContain('If you already have an account, it signs you in');
    expect(form).toContain('No password and no separate signup');
    expect(form).toContain('Email me a magic link');
    expect(form).toContain('I agree to receive a one-time login or signup link sent through Supabase.');
    expect(form).toContain('My email address will never be used for marketing.');
    expect(form).toContain('emailConsent: true');
    expect(form).toContain('required');
    expect(composer).toContain('I agree to receive a one-time login or signup link sent through Supabase.');
    expect(composer).toContain('My email address will never be used for marketing.');
    expect(composer).toContain('emailBusy || !emailConsent');
  });

  test('profile directory visibility is a prominent first setting', async () => {
    const form = await read('src/components/profile/ProfileForm.tsx');
    expect(form).toContain('bg-violet-500/15');
    expect(form).toContain('LuEye');
    expect(form.indexOf('Show my profile in the member directory')).toBeLessThan(form.indexOf('Display name'));
  });

  test('organizer routes cover the complete v1 operations', async () => {
    for (const path of [
      'src/components/admin/InviteManager.tsx',
      'src/components/admin/MemberManager.tsx',
      'src/components/admin/EventManager.tsx',
      'src/components/admin/IdeaModerator.tsx',
      'src/components/admin/BugReportManager.tsx',
      'src/pages/admin/ideas.astro',
      'src/pages/admin/members.astro',
      'src/pages/admin/bug-reports.astro'
    ]) await access(new URL(path, root));
    const admin = await read('src/components/admin/AdminDashboard.tsx');
    const manager = await read('src/components/admin/BugReportManager.tsx');
    expect(admin).not.toContain('registrations');
    expect(admin).toContain("key: 'bug-reports'");
    expect(manager).toContain("['new', 'in_review', 'done']");
    expect(manager).toContain('updateBugReportStatus');
    expect(manager).toContain('savingIds');
    expect(manager).not.toContain('mailto:');
  });
});
