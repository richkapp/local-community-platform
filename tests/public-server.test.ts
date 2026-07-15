import { describe, expect, test } from 'bun:test';
import { publicRecordExistsWithConfig } from '@/lib/public-server';

const baseOptions = {
  baseUrl: 'https://community.supabase.co',
  anonKey: 'public-anon-key'
};

describe('public route existence checks', () => {
  test('returns unknown without configuration and does not issue a request', async () => {
    let calls = 0;
    const result = await publicRecordExistsWithConfig('ideas', 'slug', 'hello', {
      fetcher: (async () => {
        calls += 1;
        return new Response('[]');
      }) as typeof fetch
    });

    expect(result).toBeNull();
    expect(calls).toBe(0);
  });

  test('distinguishes an existing public row from an absent or RLS-hidden row', async () => {
    const seen: string[] = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      seen.push(url);
      expect(init?.headers).toEqual({
        apikey: baseOptions.anonKey,
        Authorization: `Bearer ${baseOptions.anonKey}`
      });
      return new Response(seen.length === 1 ? JSON.stringify([{ slug: 'hello' }]) : '[]', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    expect(await publicRecordExistsWithConfig('ideas', 'slug', 'hello', { ...baseOptions, fetcher })).toBe(true);
    expect(await publicRecordExistsWithConfig('ideas', 'slug', 'missing', { ...baseOptions, fetcher })).toBe(false);
    expect(seen[0]).toContain('/rest/v1/ideas');
    expect(seen[0]).toContain('slug=eq.hello');
    expect(seen[0]).toContain('select=slug');
    expect(seen[0]).toContain('limit=1');
  });

  test('fails open as unknown on backend rejection or network failure', async () => {
    const rejected = await publicRecordExistsWithConfig('events', 'slug', 'event', {
      ...baseOptions,
      fetcher: (async () => new Response('unavailable', { status: 503 })) as typeof fetch
    });
    expect(rejected).toBeNull();

    const errors: unknown[] = [];
    const failed = await publicRecordExistsWithConfig('events', 'slug', 'event', {
      ...baseOptions,
      fetcher: (async () => { throw new Error('network failed'); }) as typeof fetch,
      onError: (_message: string, error: unknown) => errors.push(error)
    });
    expect(failed).toBeNull();
    expect(errors).toHaveLength(1);
  });
});
