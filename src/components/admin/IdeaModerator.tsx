import { useCallback, useEffect, useState } from 'react';
import { deleteIdea, listAdminIdeas, updateIdeaStatus } from '@/lib/admin';
import { toUserMessage } from '@/lib/errors';
import type { Idea } from '@/lib/types';
import { ripCategoryLabel, ripTagLabel } from '@/lib/rips';
import PostParticipationManager from './PostParticipationManager';

const statuses: Idea['status'][] = ['open', 'selected', 'closed', 'hidden'];

export default function IdeaModerator({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setIdeas(await listAdminIdeas()); }
    catch (caught) { setError(toUserMessage('admin-load', caught)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function changeStatus(id: string, status: Idea['status']) {
    setError('');
    try { await updateIdeaStatus(id, status); setMessage(`Idea marked ${status === 'closed' ? 'done' : status}.`); await load(); }
    catch (caught) { setError(toUserMessage('admin-save', caught)); }
  }

  async function remove(idea: Idea) {
    if (!window.confirm(`Delete “${idea.title}”? This cannot be undone.`)) return;
    setError('');
    try { await deleteIdea(idea.id); setMessage('Idea deleted.'); await load(); }
    catch (caught) { setError(toUserMessage('admin-save', caught)); }
  }

  return (
    <div className="space-y-4">
      {isSuperAdmin && <PostParticipationManager />}
      {message && <p className="status-message" role="status">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {ideas.map((idea) => (
        <article key={idea.id} className="card p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0"><div className="mb-2 flex flex-wrap gap-2"><span className="rounded-full border border-limewash/30 px-2 py-1 text-xs font-bold text-limewash">{ripCategoryLabel(idea.category)}</span>{idea.tags.map((tag) => <span key={tag} className="rounded-full border border-violet-300/25 px-2 py-1 text-xs text-violet-200">{ripTagLabel(tag)}</span>)}</div><a href={`/posts/${idea.slug}`} className="text-lg font-bold text-white hover:text-limewash">{idea.title}</a><p className="mt-2 line-clamp-3 text-sm text-braga-100">{idea.body}</p><p className="mt-2 text-xs text-braga-300">By {idea.profiles?.display_name ?? 'Builder'} · current status: {idea.status === 'closed' ? 'done' : idea.status}</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary" disabled={idea.status === 'closed'} onClick={() => changeStatus(idea.id, 'closed')}>{idea.status === 'closed' ? 'Done' : 'Mark done'}</button><label className="sr-only" htmlFor={`idea-status-${idea.id}`}>Status for {idea.title}</label><select id={`idea-status-${idea.id}`} className="input min-w-36" value={idea.status} onChange={(event) => changeStatus(idea.id, event.target.value as Idea['status'])}>{statuses.map((status) => <option key={status} value={status}>{status === 'closed' ? 'done' : status}</option>)}</select><button type="button" className="rounded-full border border-red-300/30 px-4 py-2 text-sm font-semibold text-red-200" onClick={() => void remove(idea)}>Delete</button></div>
          </div>
        </article>
      ))}
      {!ideas.length && <p className="card p-6 text-braga-100">No posts to moderate.</p>}
    </div>
  );
}
