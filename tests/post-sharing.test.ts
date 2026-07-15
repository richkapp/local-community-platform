import { describe, expect, test } from 'bun:test';
import { buildPostShareData, sharePost } from '@/lib/postSharing';

describe('post sharing', () => {
  test('builds the canonical post payload and uses native sharing when available', async () => {
    const payloads: ShareData[] = [];
    const outcome = await sharePost({
      client: { share: async (payload) => { payloads.push(payload); } },
      origin: 'https://braga.example',
      slug: 'useful-post'
    });

    expect(outcome).toBe('shared');
    expect(payloads).toEqual([{
      url: 'https://braga.example/posts/useful-post'
    }]);
    expect(buildPostShareData('https://braga.example', 'another-post').url)
      .toBe('https://braga.example/posts/another-post');
  });

  test('copies the post link when native sharing is unavailable or fails', async () => {
    const copied: string[] = [];
    const clipboard = { writeText: async (value: string) => { copied.push(value); } };

    expect(await sharePost({
      client: { clipboard },
      origin: 'https://braga.example',
      slug: 'copy-this'
    })).toBe('copied');

    expect(await sharePost({
      client: { share: async () => { throw new Error('share failed'); }, clipboard },
      origin: 'https://braga.example',
      slug: 'fallback'
    })).toBe('copied');

    expect(copied).toEqual([
      'https://braga.example/posts/copy-this',
      'https://braga.example/posts/fallback'
    ]);
  });

  test('treats a cancelled native share as cancellation instead of copying', async () => {
    const copied: string[] = [];
    const aborted = new Error('cancelled');
    aborted.name = 'AbortError';

    const outcome = await sharePost({
      client: {
        share: async () => { throw aborted; },
        clipboard: { writeText: async (value: string) => { copied.push(value); } }
      },
      origin: 'https://braga.example',
      slug: 'cancelled'
    });

    expect(outcome).toBe('cancelled');
    expect(copied).toEqual([]);
  });
});
