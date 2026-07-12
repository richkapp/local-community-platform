import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/022_bug_report_notifications.sql', import.meta.url);

async function migration() {
  return readFile(migrationPath, 'utf8');
}

describe('bug-report notification delivery', () => {
  test('queues one idempotent Resend request from the database insert boundary', async () => {
    const sql = await migration();

    expect(sql).toContain('before insert on public.bug_reports');
    expect(sql).toContain("url := 'https://api.resend.com/emails'");
    expect(sql).toContain("'Idempotency-Key', 'bug-report/' || new.id");
    expect(sql).toContain("where name = 'RESEND_API_KEY'");
    expect(sql).toContain("where name = 'BUG_REPORT_NOTIFICATION_EMAIL'");
    expect(sql).toContain("where name = 'BUG_REPORT_FROM_EMAIL'");
    expect(sql).toContain("where name = 'BUG_REPORT_ADMIN_URL'");
    expect(sql).toContain("jsonb_build_object('reply_to', new.email)");
    expect(sql).toContain('timeout_milliseconds := 5000');
    expect(sql).toContain('notification_request_id');
    expect(sql).toContain('notification_enqueued_at');
  });

  test('keeps report insertion independent from notification configuration or delivery', async () => {
    const sql = await migration();

    expect(sql).toContain('exception\n  when others then');
    expect(sql).toContain('new.notification_request_id := null');
    expect(sql).toContain('new.notification_enqueued_at := null');
    expect(sql).toContain("raise warning 'Bug-report notification could not be queued for report %', new.id");
    expect(sql).toContain('return new;');
    expect(sql).toContain('revoke all on function public.enqueue_bug_report_notification() from public, anon, authenticated');
  });
});
