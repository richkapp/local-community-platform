import { useEffect, useMemo, useState } from 'react';
import { FaGithub, FaLinkedinIn, FaXTwitter } from 'react-icons/fa6';
import { LuGlobe, LuLockKeyhole, LuMail, LuSearch, LuShieldCheck, LuTrash2, LuUserRoundX } from 'react-icons/lu';
import {
  deleteMember,
  listAdminMembers,
  setMemberRole,
  setMemberSuspension,
  type AdminMember,
  type MemberRole
} from '@/lib/admin';
import { getCurrentUser } from '@/lib/auth';
import { toUserMessage } from '@/lib/errors';
import { formatCommunityDate } from '@/lib/communityDate';
import AvatarImage from '@/components/profile/AvatarImage';

function dateTime(value: string | null) {
  return value ? formatCommunityDate(value) : 'Never';
}

function roleLabel(role: MemberRole) {
  if (role === 'super_admin') return 'Super admin';
  return role === 'admin' ? 'Admin' : 'Member';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs font-bold uppercase tracking-[0.16em] text-braga-300">{label}</dt><dd className="mt-1 break-words text-sm leading-6 text-braga-100">{children || '—'}</dd></div>;
}

function LinkField({ href, icon: Icon, label }: { href: string | null; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; label: string }) {
  return <Field label={label}>{href ? <a className="inline-flex items-center gap-2 text-limewash hover:underline" href={href} target="_blank" rel="noreferrer noopener"><Icon className="h-4 w-4" />{href}</a> : '—'}</Field>;
}

type MemberAction = 'promote' | 'demote' | 'suspend' | 'unsuspend' | 'delete';
type Props = { isSuperAdmin: boolean };

export default function MemberManager({ isSuperAdmin }: Props) {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listAdminMembers(), getCurrentUser()])
      .then(([records, user]) => { setMembers(records); setCurrentUserId(user?.id ?? null); })
      .catch((caught) => setError(toUserMessage('admin-load', caught)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => [member.email, member.display_name, member.handle, roleLabel(member.role)].some((value) => value?.toLowerCase().includes(needle)));
  }, [members, query]);

  async function runAction(member: AdminMember, action: MemberAction) {
    const prompts: Record<MemberAction, string> = {
      promote: `Make ${member.display_name} an admin? They will gain access to organizer tools and private member data.`,
      demote: `Remove ${member.display_name}'s admin access?`,
      suspend: `Suspend ${member.display_name}? They will be signed out as their session expires and blocked from community actions immediately.`,
      unsuspend: `Restore ${member.display_name}'s account access?`,
      delete: `Permanently delete ${member.display_name}? This removes their account, profile photo, posts, votes, and registrations. This cannot be undone.`
    };
    if (!window.confirm(prompts[action])) return;

    setSavingId(member.id);
    setMessage('');
    setError('');
    try {
      if (action === 'promote') await setMemberRole(member.id, 'admin');
      if (action === 'demote') await setMemberRole(member.id, 'member');
      if (action === 'suspend') await setMemberSuspension(member.id, true);
      if (action === 'unsuspend') await setMemberSuspension(member.id, false);
      if (action === 'delete') await deleteMember(member.id, member.avatar_path);
      setMembers(await listAdminMembers());
      setMessage(action === 'delete' ? `${member.display_name} was deleted.` : `${member.display_name} was updated.`);
    } catch (caught) {
      setError(toUserMessage('admin-save', caught));
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p className="card p-6 text-braga-100" role="status">Loading members…</p>;
  if (error && !members.length) return <p className="error-message" role="alert">{error}</p>;

  return (
    <div className="space-y-5">
      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">Member database</h2>
            <p className="mt-2 text-sm text-braga-200">All {members.length} member records, including profiles hidden from the public directory.</p>
            <p className="mt-2 text-xs leading-5 text-braga-300">{isSuperAdmin ? 'Super admins can assign admins, suspend access, restore accounts, and permanently delete members.' : 'Only a super admin can change roles, suspend accounts, or delete members.'}</p>
          </div>
          <label className="relative block sm:w-80"><span className="sr-only">Search members</span><LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-braga-300" aria-hidden="true" /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or handle" /></label>
        </div>
      </div>

      {message && <p className="status-message" role="status">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}

      {filtered.map((member) => {
        const isCurrentUser = member.id === currentUserId;
        const canManage = isSuperAdmin && !isCurrentUser && member.role !== 'super_admin';
        const saving = savingId === member.id;
        const roleBadge = member.role === 'member'
          ? 'rounded-full border border-braga-300/30 px-3 py-1 text-xs font-bold uppercase text-braga-100'
          : 'rounded-full bg-limewash px-3 py-1 text-xs font-bold uppercase text-ink-950';

        return (
          <article key={member.id} className="card p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <AvatarImage profile={member} imageClassName="h-16 w-16 shrink-0 rounded-2xl object-cover" fallbackClassName="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-braga-900 text-xl font-black text-limewash" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold text-white">{member.display_name}</h3>
                  <span className={roleBadge}>{roleLabel(member.role)}</span>
                  {member.suspended_at && <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase text-amber-200"><LuUserRoundX className="h-3 w-3" aria-hidden="true" />Suspended</span>}
                  <span className={member.is_public ? 'rounded-full border border-cyan-300/30 px-3 py-1 text-xs font-bold uppercase text-cyan-200' : 'inline-flex items-center gap-1 rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-xs font-bold uppercase text-violet-200'}>{!member.is_public && <LuLockKeyhole className="h-3 w-3" aria-hidden="true" />}{member.is_public ? 'Public profile' : 'Private profile'}</span>
                </div>
                <a className="mt-2 inline-flex items-center gap-2 text-sm text-limewash hover:underline" href={`mailto:${member.email}`}><LuMail className="h-4 w-4" aria-hidden="true" />{member.email}</a>
              </div>
            </div>

            {canManage && (
              <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-4" aria-label={`Manage ${member.display_name}`}>
                <button type="button" className="btn-secondary inline-flex items-center gap-2" disabled={saving} onClick={() => void runAction(member, member.role === 'admin' ? 'demote' : 'promote')}><LuShieldCheck className="h-4 w-4" aria-hidden="true" />{member.role === 'admin' ? 'Make member' : 'Make admin'}</button>
                <button type="button" className="btn-secondary inline-flex items-center gap-2" disabled={saving} onClick={() => void runAction(member, member.suspended_at ? 'unsuspend' : 'suspend')}><LuUserRoundX className="h-4 w-4" aria-hidden="true" />{member.suspended_at ? 'Restore account' : 'Suspend member'}</button>
                <button type="button" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-red-400/40 px-4 py-2 font-bold text-red-200 transition hover:border-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50" disabled={saving} onClick={() => void runAction(member, 'delete')}><LuTrash2 className="h-4 w-4" aria-hidden="true" />Delete member</button>
                {saving && <span className="self-center text-xs text-braga-300" role="status">Saving…</span>}
              </div>
            )}
            {isSuperAdmin && isCurrentUser && <p className="mt-5 rounded-2xl border border-limewash/20 bg-limewash/5 p-4 text-sm text-braga-100">This is your super-admin account. It cannot manage or delete itself.</p>}

            <dl className="mt-6 grid gap-x-8 gap-y-5 border-t border-braga-300/15 pt-6 md:grid-cols-2">
              <Field label="Member ID"><code className="text-xs">{member.id}</code></Field>
              <Field label="Handle">{member.handle ? `@${member.handle}` : '—'}</Field>
              <Field label="Bio">{member.bio || '—'}</Field>
              <Field label="Account status">{member.suspended_at ? `Suspended ${dateTime(member.suspended_at)}` : 'Active'}</Field>
              <Field label="Email confirmed">{dateTime(member.email_confirmed_at)}</Field>
              <Field label="Last sign-in">{dateTime(member.last_sign_in_at)}</Field>
              <Field label="Account created">{dateTime(member.auth_created_at)}</Field>
              <Field label="Profile created">{dateTime(member.profile_created_at)}</Field>
              <Field label="Profile updated">{dateTime(member.profile_updated_at)}</Field>
              <LinkField label="Website" href={member.website_url} icon={LuGlobe} />
              <LinkField label="LinkedIn" href={member.linkedin_url} icon={FaLinkedinIn} />
              <LinkField label="GitHub" href={member.github_url} icon={FaGithub} />
              <LinkField label="X" href={member.x_url} icon={FaXTwitter} />
            </dl>
          </article>
        );
      })}
      {!filtered.length && <p className="card p-6 text-braga-100">No members match that search.</p>}
    </div>
  );
}
