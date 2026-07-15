import { useCallback, useEffect, useMemo, useState } from 'react';
import { listBugReports, updateBugReportStatus, type BugReport, type BugReportStatus } from '@/lib/admin';
import { toUserMessage } from '@/lib/errors';
import { formatCommunityDate } from '@/lib/communityDate';

const statuses: BugReportStatus[] = ['new', 'in_review', 'done'];
const statusLabels: Record<BugReportStatus, string> = {
  new: 'New',
  in_review: 'In review',
  done: 'Done'
};

function formatDate(value: string) {
  return formatCommunityDate(value);
}

export default function BugReportManager() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReports(await listBugReports());
    } catch (caught) {
      setError(toUserMessage('admin-load', caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => Object.fromEntries(
    statuses.map((status) => [status, reports.filter((report) => report.status === status).length])
  ) as Record<BugReportStatus, number>, [reports]);

  async function changeStatus(report: BugReport, status: BugReportStatus) {
    if (report.status === status || savingIds.has(report.id)) return;
    setSavingIds((current) => new Set(current).add(report.id));
    setMessage('');
    setError('');
    try {
      await updateBugReportStatus(report.id, status);
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, status } : item));
      setMessage(`Bug report marked ${statusLabels[status].toLowerCase()}.`);
    } catch (caught) {
      setError(toUserMessage('admin-save', caught));
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(report.id);
        return next;
      });
    }
  }

  if (loading) return <p className="card p-6 text-braga-100" role="status">Loading bug reports…</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3" aria-label="Bug report counts">
        {statuses.map((status) => (
          <div key={status} className="card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-braga-300">{statusLabels[status]}</p>
            <p className="mt-1 text-2xl font-black text-white">{counts[status]}</p>
          </div>
        ))}
      </div>

      {message && <p className="status-message" role="status">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}

      {reports.map((report) => (
        <article key={report.id} className="card p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-limewash/30 px-2.5 py-1 text-xs font-bold text-limewash">{statusLabels[report.status]}</span>
                <span className="text-xs text-braga-300">{formatDate(report.created_at)}</span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-braga-100">{report.description}</p>
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-bold uppercase tracking-[0.14em] text-braga-300">Name</dt><dd className="mt-1 text-white">{report.name || 'Not shared'}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-[0.14em] text-braga-300">Email</dt><dd className="mt-1 break-all text-white">{report.email ? <span className="text-limewash">{report.email}</span> : 'Not shared'}</dd></div>
              </dl>
              {report.page_url && <a href={report.page_url} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex text-sm font-semibold text-limewash hover:underline">Open reported page ↗</a>}
            </div>

            <div className="w-full lg:w-48">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-braga-300" htmlFor={`bug-report-status-${report.id}`}>Status</label>
              <select
                id={`bug-report-status-${report.id}`}
                className="input mt-2 w-full"
                value={report.status}
                disabled={savingIds.has(report.id)}
                onChange={(event) => void changeStatus(report, event.target.value as BugReportStatus)}
              >
                {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
              </select>
              {savingIds.has(report.id) && <p className="mt-2 text-xs text-braga-300" role="status">Saving…</p>}
            </div>
          </div>
        </article>
      ))}

      {!reports.length && !error && <p className="card p-6 text-braga-100">No bug reports yet.</p>}
    </div>
  );
}
