import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const outputRoot = path.resolve('.vercel/output');
const staticRoot = path.join(outputRoot, 'static');

const expectedStaticPages = [
  '404.html',
  'index.html',
  'admin/index.html',
  'admin/bug-reports/index.html',
  'admin/events/index.html',
  'admin/ideas/index.html',
  'admin/invites/index.html',
  'admin/members/index.html',
  'admin/voting/index.html',
  'auth/confirm/index.html',
  'events/index.html',
  'members/index.html',
  'posts/index.html',
  'privacy/index.html',
  'settings/index.html',
  'signin/index.html',
  'terms/index.html',
  'voting/index.html'
];

for (const page of expectedStaticPages) {
  await access(path.join(staticRoot, page));
}

const config = JSON.parse(await readFile(path.join(outputRoot, 'config.json'), 'utf8'));
const expectedDynamicRoutes = [
  '^/api/event-preview/?$',
  '^/events/([^/]+?)/?$',
  '^/ideas/([^/]+?)/?$',
  '^/ideas/?$',
  '^/join/([^/]+?)/?$',
  '^/members/([^/]+?)/?$',
  '^/posts/([^/]+?)/?$'
].sort();
const actualDynamicRoutes = config.routes
  .filter((route) => route.dest === '_render' && !route.src.startsWith('^/_'))
  .map((route) => route.src)
  .sort();

if (JSON.stringify(actualDynamicRoutes) !== JSON.stringify(expectedDynamicRoutes)) {
  throw new Error(
    `Unexpected on-demand route manifest.\nExpected: ${JSON.stringify(expectedDynamicRoutes)}\nActual: ${JSON.stringify(actualDynamicRoutes)}`
  );
}

await access(path.join(outputRoot, 'functions/_render.func/.vc-config.json'));
console.log(`Verified ${expectedStaticPages.length} static pages and ${expectedDynamicRoutes.length} on-demand routes.`);
