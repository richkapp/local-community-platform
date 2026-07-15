import { useCallback, useEffect, useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { createInvite, listInvites, listMemberInvitesForAdmin, revokeInvite, type InviteRecord, type MemberInviteAdminRecord } from '@/lib/admin';
import { toUserMessage } from '@/lib/errors';

function newInviteCode() {
  return `invite-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

function inviteState(invite: InviteRecord) {
  if (invite.revoked_at) return 'Revoked';
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) return 'Expired';
  if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) return 'Used up';
  return 'Active';
}

export default function InviteManager() {
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [memberInvites, setMemberInvites] = useState<MemberInviteAdminRecord[]>([]);
  const [code, setCode] = useState(newInviteCode);
  const [label, setLabel] = useState('Community invite');
  const [maxUses, setMaxUses] = useState('25');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [campaigns, memberLinks] = await Promise.all([listInvites(), listMemberInvitesForAdmin()]);
      setInvites(campaigns);
      setMemberInvites(memberLinks);
    } catch (caught) { setError(toUserMessage('admin-load', caught)); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    setBusy(true); setMessage(''); setError('');
    try {
      const max = Number(maxUses);
      if (!Number.isInteger(max) || max < 1 || max > 50) throw new Error('Choose a capacity from 1 to 50 uses.');
      await createInvite(code.trim().toLowerCase(), label, max, expiresAt ? new Date(expiresAt).toISOString() : null);
      setCode(newInviteCode());
      setMessage('Admin campaign invite created.');
      await load();
    } catch (caught) { setError(toUserMessage('admin-save', caught)); }
    finally { setBusy(false); }
  }

  async function revoke(id: string, replaceMemberLink = false) {
    const warning = replaceMemberLink
      ? 'Replace this member link? The current URL stops working immediately, including any pending signup, and a fresh link takes its place.'
      : 'Revoke this invite? Existing signed-in members keep their accounts, but the link stops working.';
    if (!window.confirm(warning)) return;
    setError('');
    try { await revokeInvite(id); setMessage(replaceMemberLink ? 'Member link replaced.' : 'Invite revoked.'); await load(); }
    catch (caught) { setError(toUserMessage('admin-save', caught)); }
  }

  async function copy(codeToCopy: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/join/${codeToCopy}`);
    setMessage('Invite URL copied.');
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card grid gap-4 p-6 md:grid-cols-2" aria-busy={busy}>
        <div className="md:col-span-2"><h2 className="text-xl font-bold text-white">Create admin campaign invite</h2><p className="mt-2 text-sm text-braga-200">One reusable URL with a capacity you control. Members get separate single-use links in their Settings.</p></div>
        <div className="md:col-span-2"><label className="label" htmlFor="invite-code">Custom URL code</label><input id="invite-code" className="input mt-2 font-mono" value={code} onChange={(event) => setCode(event.target.value.toLowerCase())} pattern="[a-z0-9][a-z0-9-]{3,80}" required /></div>
        <div><label className="label" htmlFor="invite-label">Label</label><input id="invite-label" className="input mt-2" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} required /></div>
        <div><label className="label" htmlFor="invite-uses">Capacity</label><input id="invite-uses" className="input mt-2" type="number" min="1" max="50" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} required /><p className="mt-2 text-xs text-braga-200">1–50 uses per link.</p></div>
        <div><label className="label" htmlFor="invite-expiry">Expires at (optional)</label><input id="invite-expiry" className="input mt-2" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></div>
        <div className="flex items-end"><button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create campaign invite'}</button></div>
      </form>

      {message && <p className="status-message" role="status">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="space-y-3">
        <h2 className="text-xl font-bold text-white">Admin campaign invites</h2>
        {invites.map((invite) => (
          <article key={invite.id} className="card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-white">{invite.label}</p>
              <p className="mt-1 break-all font-mono text-xs text-braga-200">/join/{invite.code}</p>
              <p className="mt-2 text-xs text-braga-300">{inviteState(invite)} · {invite.uses_count}{invite.max_uses === null ? '' : ` / ${invite.max_uses}`} used</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!invite.revoked_at && <button type="button" className="btn-secondary" onClick={() => copy(invite.code)}>Copy URL</button>}
              {!invite.revoked_at && <button type="button" className="rounded-full border border-red-300/30 px-4 py-2 text-sm font-semibold text-red-200" onClick={() => revoke(invite.id)}>Revoke</button>}
            </div>
          </article>
        ))}
        {!invites.length && <p className="card p-6 text-braga-100">No invites yet.</p>}
      </div>

      <details className="card p-5">
        <summary className="cursor-pointer text-xl font-bold text-white">Member invite links</summary>
        <p className="mt-2 text-sm text-braga-200">Inspect current member-owned links. Replace one only when it leaked or must be invalidated; the member keeps a five-link pool.</p>
        <div className="mt-5 space-y-3">
          {memberInvites.map((invite) => (
            <article key={invite.invite_id} className="rounded-2xl border border-white/10 bg-braga-950/40 p-4 md:flex md:items-center md:justify-between md:gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-white">{invite.creator_label}</p>
                <p className="mt-1 break-all font-mono text-xs text-braga-200">/join/{invite.code}</p>
                <p className="mt-2 text-xs text-braga-300">{invite.status === 'pending' ? 'Claim in progress' : invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 md:mt-0">
                {invite.status === 'available' && <button type="button" className="btn-secondary" onClick={() => copy(invite.code)}>Copy URL</button>}
                <button type="button" className="rounded-full border border-red-300/30 px-4 py-2 text-sm font-semibold text-red-200" onClick={() => revoke(invite.invite_id, true)}>Replace link</button>
              </div>
            </article>
          ))}
          {!memberInvites.length && <p className="text-sm text-braga-200">No member links have been generated yet.</p>}
        </div>
      </details>
    </div>
  );
}
