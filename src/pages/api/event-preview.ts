import type { APIRoute } from 'astro';

export const prerender = false;

type JsonLdEvent = {
  '@type'?: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  image?: string | string[];
  location?: { name?: string };
};

function lumaUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['luma.com', 'www.luma.com'].includes(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function findEvent(value: unknown): JsonLdEvent | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findEvent(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record['@type'] === 'Event') return record as JsonLdEvent;
  return findEvent(record['@graph']);
}

export const POST: APIRoute = async ({ request }) => {
  const authorization = request.headers.get('authorization') || '';
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';
  if (!authorization.startsWith('Bearer ') || !supabaseUrl || !anonKey) return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401 });

  const adminCheck = await fetch(`${supabaseUrl}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: authorization, 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (!adminCheck.ok || await adminCheck.json() !== true) return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 403 });

  let body: { url?: unknown };
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid request.' }), { status: 400 }); }
  const sourceUrl = lumaUrl(body.url);
  if (!sourceUrl) return new Response(JSON.stringify({ error: 'Enter a valid Luma event URL.' }), { status: 400 });

  const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BragaAI-Builders/1.0)' }, redirect: 'follow' });
  if (!response.ok || !lumaUrl(response.url)) return new Response(JSON.stringify({ error: 'Could not load that Luma event.' }), { status: 502 });
  const html = await response.text();
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let event: JsonLdEvent | null = null;
  for (const match of scripts) {
    try { event = findEvent(JSON.parse(match[1])); } catch { /* try the next JSON-LD block */ }
    if (event) break;
  }
  if (!event?.name || !event.startDate) return new Response(JSON.stringify({ error: 'Luma did not provide complete event details.' }), { status: 422 });

  const image = Array.isArray(event.image) ? event.image[0] : event.image;
  return new Response(JSON.stringify({
    title: event.name,
    description: event.description || '',
    starts_at: event.startDate,
    ends_at: event.endDate || null,
    location_name: event.location?.name || null,
    image_url: image || null,
    external_url: sourceUrl.toString()
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
