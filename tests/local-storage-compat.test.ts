import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();
const { clearIdeaDraft, loadIdeaDraft } = await import('@/lib/ideaDraft');
const { readMigratedStorageValue } = await import('@/lib/browserStorage');

beforeEach(() => window.localStorage.clear());
afterAll(() => GlobalRegistrator.unregister());

describe('browser storage compatibility', () => {
  test('migrates a Braga-era saved post draft to the neutral key', () => {
    const draft = {
      title: 'Saved post',
      body: 'A useful saved post body.',
      category: 'idea',
      tags: ['automation'],
      savedAt: Date.now()
    };
    window.localStorage.setItem('braga-idea-draft-v1', JSON.stringify(draft));

    expect(loadIdeaDraft()).toMatchObject(draft);
    expect(window.localStorage.getItem('braga-idea-draft-v1')).toBeNull();
    expect(window.localStorage.getItem('local-community-post-draft-v1')).not.toBeNull();

    clearIdeaDraft();
    expect(window.localStorage.getItem('local-community-post-draft-v1')).toBeNull();
  });

  test('preserves the anonymous visitor identity and vote history under neutral keys', () => {
    const visitorId = '12345678-1234-1234-1234-123456789abc';
    const postId = 'post-1';
    window.localStorage.setItem('braga-anonymous-idea-visitor-id', visitorId);
    window.localStorage.setItem('braga-anonymous-idea-votes', JSON.stringify([postId]));

    expect(readMigratedStorageValue(
      window.localStorage,
      'local-community-anonymous-visitor-id-v1',
      ['braga-anonymous-idea-visitor-id']
    )).toBe(visitorId);
    expect(readMigratedStorageValue(
      window.localStorage,
      'local-community-anonymous-post-votes-v1',
      ['braga-anonymous-idea-votes']
    )).toBe(JSON.stringify([postId]));
    expect(window.localStorage.getItem('braga-anonymous-idea-visitor-id')).toBeNull();
    expect(window.localStorage.getItem('braga-anonymous-idea-votes')).toBeNull();
    expect(window.localStorage.getItem('local-community-anonymous-visitor-id-v1')).toBe(visitorId);
    expect(window.localStorage.getItem('local-community-anonymous-post-votes-v1')).toBe(JSON.stringify([postId]));
  });
});
