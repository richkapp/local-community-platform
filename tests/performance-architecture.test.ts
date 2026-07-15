import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

describe('performance architecture contracts', () => {
  test('public pages build statically while parameterized routes stay on demand', async () => {
    const config = await read('astro.config.mjs');
    const layout = await read('src/layouts/BaseLayout.astro');
    expect(config).toContain("output: 'static'");
    expect(config).toContain('prefetchAll: true');
    expect(config).toContain("defaultStrategy: 'hover'");
    expect(layout).toContain("import { ClientRouter } from 'astro:transitions'");
    expect(layout).toContain('<ClientRouter />');

    for (const route of [
      'src/pages/posts/[slug].astro',
      'src/pages/events/[slug].astro',
      'src/pages/members/[handle].astro',
      'src/pages/join/[code].astro',
      'src/pages/ideas/[slug].astro',
      'src/pages/ideas.astro',
      'src/pages/api/event-preview.ts'
    ]) {
      expect(await read(route)).toContain('export const prerender = false');
    }

    for (const route of [
      'src/pages/posts/[slug].astro',
      'src/pages/events/[slug].astro',
      'src/pages/members/[handle].astro'
    ]) {
      const source = await read(route);
      expect(source.indexOf('.test(')).toBeLessThan(source.indexOf('await publicRecordExists'));
      expect(source).toContain('if (exists === false) Astro.response.status = 404');
    }
  });

  test('the persistent shell resolves browser auth, admin, and Voting state once', async () => {
    const nav = await read('src/components/Nav.astro');
    const footer = await read('src/components/Footer.astro');
    const store = await read('src/components/auth/useSiteSession.ts');
    const authHook = await read('src/components/auth/useAuthUser.ts');
    const authStatus = await read('src/components/auth/AuthStatus.tsx');
    const votingLink = await read('src/components/voting/VotingFeatureLink.tsx');
    expect(nav).toContain('transition:persist="site-header"');
    expect(nav).toContain('id="site-header"');
    expect(footer).toContain('transition:persist="site-footer"');
    expect(store.match(/supabase\.auth\.getUser\(\)/g)).toHaveLength(1);
    expect(store.match(/rpc\('is_admin'\)/g)).toHaveLength(1);
    expect(store.match(/getVotingFeatureAccess\(\)/g)).toHaveLength(1);
    expect(store).toContain('votingRequestSequence');
    expect(store).toContain('requestId === votingRequestSequence');
    expect(store.match(/onAuthStateChange/g)).toHaveLength(1);
    expect(authHook).toContain('useSiteSession');
    expect(authHook).not.toContain('supabase.auth.getUser');
    expect(authStatus).toContain('useSiteSession');
    expect(authStatus).not.toContain("rpc('is_admin'");
    expect(votingLink).toContain('useSiteSession');
    expect(votingLink).not.toContain('getVotingFeatureAccess');
  });

  test('posts use one feed RPC and one shared tag catalog', async () => {
    const feed = await read('src/components/ideas/IdeaFeed.tsx');
    const ideas = await read('src/lib/ideas.ts');
    const composer = await read('src/components/ideas/IdeaComposer.tsx');
    const picker = await read('src/components/ideas/RipTaxonomyPicker.tsx');
    expect(feed.match(/usePostTagCatalog\(\)/g)).toHaveLength(1);
    expect(feed).toContain('listPostFeed(initialView)');
    expect(ideas).toContain("rpc('list_post_feed'");
    expect(feed).not.toContain("rpc('list_visible_ideas'");
    expect(feed).not.toContain('attachPublicAuthors');
    expect(feed).not.toContain('getMyPostRelationships');
    expect(feed).not.toContain('getCurrentMemberRole');
    expect(feed).not.toContain('listIdeaCommentCounts');
    expect(feed).not.toContain('supabase.auth.getUser');
    expect(composer).toContain('tagCatalog: PostTagCatalogItem[]');
    expect(picker).toContain('catalog: PostTagCatalogItem[]');
    expect(picker).not.toContain('usePostTagCatalog');
  });

  test('signed-out visitors skip admin work and bug-report code loads only on demand', async () => {
    const events = await read('src/components/events/EventList.tsx');
    const invitePool = await read('src/components/invites/MemberInvitePool.tsx');
    const votingManager = await read('src/components/admin/VotingManager.tsx');
    const footer = await read('src/components/Footer.astro');
    const launcher = await read('src/components/bug-reports/BugReportLauncher.tsx');
    expect(events).toContain('useSiteSession');
    expect(events).not.toContain('isCurrentUserAdmin');
    expect(invitePool).toContain('activeUserId.current !== userId');
    expect(invitePool).toContain('setInvites([])');
    expect(votingManager).toContain('setPreviewValue(normalizeCommunityVoteInput(currentInput()))');
    expect(votingManager).toContain('setPreviewValue(null)');
    expect(votingManager).not.toContain('const normalizedPreview');
    expect(footer).toContain('BugReportLauncher client:visible');
    expect(footer).not.toContain('BugReportDialog client:load');
    expect(launcher).toContain("lazy(() => import('./BugReportDialog'))");
    expect(launcher).toContain('if (!loaded)');
  });

  test('ClientRouter history and persisted overlays survive navigation safely', async () => {
    const settings = await read('src/components/settings/SettingsHub.tsx');
    const composer = await read('src/components/ideas/IdeaComposer.tsx');
    const callback = await read('src/components/auth/AuthCallback.tsx');
    const nav = await read('src/components/Nav.astro');
    const launcher = await read('src/components/bug-reports/BugReportLauncher.tsx');
    expect(settings).toContain("import { navigate } from 'astro:transitions/client'");
    expect(settings).toContain('sync();');
    expect(settings).toContain("navigate(url.href, { history: 'push' })");
    expect(settings).not.toContain('history.pushState({}');
    expect(composer).toContain('history.replaceState(window.history.state');
    expect(callback).not.toContain('history.replaceState({}');
    expect(nav).toContain("document.addEventListener('astro:before-preparation'");
    expect(nav).toContain("menu.removeAttribute('open')");
    expect(launcher).toContain("document.addEventListener('astro:before-preparation'");
    expect(launcher).toContain('setLoaded(false)');
  });
});
