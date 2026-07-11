import { useEffect, useState } from 'react';
import { isCurrentUserAdmin } from '@/lib/admin';
import { toUserMessage } from '@/lib/errors';
import InviteManager from './InviteManager';
import EventManager from './EventManager';
import IdeaModerator from './IdeaModerator';
import MemberManager from './MemberManager';
import BugReportManager from './BugReportManager';
import { communityConfig } from '@/config/community';

type AdminMode = 'overview' | 'members' | 'invites' | 'events' | 'ideas' | 'bug-reports';
type Props = { mode?: AdminMode };

const modes: Array<{ key: Exclude<AdminMode, 'overview'>; label: string; description: string }> = [
  { key: 'members', label: 'Members', description: 'Review every member record, including private profiles and account details.' },
  { key: 'invites', label: 'Invites', description: 'Create, copy, inspect, and revoke private access links.' },
  { key: 'events', label: 'Events', description: 'Create drafts and publish, unpublish, or cancel events.' },
  { key: 'ideas', label: 'Posts', description: 'Review, complete, reopen, or hide community ideas, resources, and perspectives.' },
  { key: 'bug-reports', label: 'Bug Reports', description: 'Review incoming bug reports and mark each one new, in review, or done.' }
];

export default function AdminDashboard({ mode = 'overview' }: Props) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    isCurrentUserAdmin()
      .then(setIsAdmin)
      .catch((caught) => { setError(toUserMessage('admin-access', caught)); setIsAdmin(false); });
  }, []);

  if (isAdmin === null) return <p className="card p-6 text-braga-100" role="status">Checking organizer access…</p>;
  if (!isAdmin) return <div className="card p-6"><h1 className="text-2xl font-semibold text-white">Organizer access required</h1><p className="mt-3 text-braga-100">This area is available only to {communityConfig.name} organizers.</p>{error && <p className="error-message mt-4" role="alert">{error}</p>}<a href="/" className="btn-secondary mt-6">Back home</a></div>;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-braga-300">Organizer tools</p>
        <h1 className="mt-2 text-3xl font-black text-white">{communityConfig.name} admin</h1>
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Admin sections">
          <a className={mode === 'overview' ? 'btn-primary' : 'btn-secondary'} href="/admin">Overview</a>
          {modes.map((item) => <a key={item.key} className={mode === item.key ? 'btn-primary' : 'btn-secondary'} href={`/admin/${item.key}`}>{item.label}</a>)}
        </nav>
      </div>

      {mode === 'overview' && <div className="grid gap-5 md:grid-cols-2">{modes.map((item) => <a key={item.key} href={`/admin/${item.key}`} className="card p-6 transition hover:border-limewash/60"><h2 className="text-xl font-bold text-white">{item.label}</h2><p className="mt-2 text-sm leading-6 text-braga-100">{item.description}</p><span className="mt-5 inline-flex font-semibold text-limewash">Open {item.label.toLowerCase()} →</span></a>)}</div>}
      {mode === 'members' && <MemberManager />}
      {mode === 'invites' && <InviteManager />}
      {mode === 'events' && <EventManager />}
      {mode === 'ideas' && <IdeaModerator />}
      {mode === 'bug-reports' && <BugReportManager />}
    </div>
  );
}
