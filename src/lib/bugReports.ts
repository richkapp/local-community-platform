import { supabaseAnonKey, supabaseUrl } from './supabase';

const visitorKey = 'local-community-platform-bug-report-visitor-id';

type BugReportInput = {
  name: string;
  email: string;
  description: string;
  pageUrl: string;
  website: string;
};

type BugReportResponse = {
  ok?: boolean;
  reportId?: string;
  error?: string;
};

export function getBugReportVisitorId() {
  if (typeof window === 'undefined') throw new Error('Bug reports are available in a browser.');
  try {
    const current = window.localStorage.getItem(visitorKey);
    if (current && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(current)) return current;
  } catch {
    // Private browsing can disable storage; the network limit still applies.
  }
  const visitorId = crypto.randomUUID();
  try { window.localStorage.setItem(visitorKey, visitorId); } catch { /* storage is optional */ }
  return visitorId;
}

export async function submitBugReport(input: BugReportInput) {
  const response = await fetch(`${supabaseUrl}/functions/v1/bug-reports`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      visitorId: getBugReportVisitorId(),
      name: input.name,
      email: input.email,
      description: input.description,
      pageUrl: input.pageUrl,
      website: input.website
    })
  });
  const result = await response.json().catch(() => ({})) as BugReportResponse;
  if (!response.ok || !result.ok) throw new Error(result.error || 'The bug report could not be sent. Please try again.');
  return result.reportId;
}
