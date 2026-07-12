import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';

const reportId = '11111111-1111-4111-8111-111111111111';
const visitorId = '22222222-2222-4222-8222-222222222222';
const originalFetch = globalThis.fetch;
let handler: (request: Request) => Promise<Response>;
let resendMode: 'success' | 'failure' = 'success';
let resendRequest: Request | null = null;

type DenoRuntime = {
  env: { get(name: string): string | undefined };
  serve(callback: (request: Request) => Promise<Response>): void;
};

beforeAll(async () => {
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://project.example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'server-only-service-key',
    INVITE_REDIRECT_URL: 'https://community.example/auth/confirm',
    RESEND_API_KEY: 're_test_only',
    BUG_REPORT_NOTIFICATION_EMAIL: 'organizer@example.com',
    BUG_REPORT_FROM_EMAIL: 'Community <noreply@example.com>',
    COMMUNITY_NAME: 'Example Community'
  };
  (globalThis as typeof globalThis & { Deno: DenoRuntime }).Deno = {
    env: { get: (name) => env[name] },
    serve: (callback) => { handler = callback; }
  };

  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.url.endsWith('/rest/v1/rpc/submit_bug_report')) {
      return new Response(JSON.stringify(reportId), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (request.url === 'https://api.resend.com/emails') {
      resendRequest = request.clone();
      return resendMode === 'success'
        ? new Response(JSON.stringify({ id: 'email-test-id' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : new Response(JSON.stringify({ message: 'temporary failure' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`Unexpected fetch: ${request.url}`);
  };

  // @ts-expect-error The Edge Function registers its handler through Deno.serve instead of exports.
  await import('../supabase/functions/bug-reports/index.ts');
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  delete (globalThis as typeof globalThis & { Deno?: DenoRuntime }).Deno;
});

function submission(description: string) {
  return new Request('https://project.example.supabase.co/functions/v1/bug-reports', {
    method: 'POST',
    headers: {
      Origin: 'https://community.example',
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.10'
    },
    body: JSON.stringify({
      visitorId,
      name: 'A <Builder>',
      email: 'builder@example.com',
      description,
      pageUrl: 'https://community.example/posts',
      website: ''
    })
  });
}

describe('bug-report notification delivery', () => {
  test('sends one escaped, idempotent organizer email after the report is stored', async () => {
    resendMode = 'success';
    resendRequest = null;
    const response = await handler(submission('The <script>alert("bug")</script> button fails after opening the form.'));
    const result = await response.json() as { ok: boolean; reportId: string; notificationSent: boolean };

    expect(response.status).toBe(201);
    expect(result).toEqual({ ok: true, reportId, notificationSent: true });
    expect(resendRequest).not.toBeNull();
    const sentRequest = resendRequest as unknown as Request;
    expect(sentRequest.headers.get('Idempotency-Key')).toBe(`bug-report/${reportId}`);
    const email = await sentRequest.json() as { to: string[]; reply_to: string; html: string; text: string };
    expect(email.to).toEqual(['organizer@example.com']);
    expect(email.reply_to).toBe('builder@example.com');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).not.toContain('<script>');
    expect(email.text).toContain('Review report: https://community.example/admin/bug-reports');
  });

  test('preserves the stored report when notification delivery exhausts retries', async () => {
    resendMode = 'failure';
    const consoleError = spyOn(console, 'error').mockImplementation(() => {});
    const response = await handler(submission('The report remains stored even when the notification provider is temporarily unavailable.'));
    const result = await response.json() as { ok: boolean; reportId: string; notificationSent: boolean };
    consoleError.mockRestore();

    expect(response.status).toBe(201);
    expect(result).toEqual({ ok: true, reportId, notificationSent: false });
  });
});
