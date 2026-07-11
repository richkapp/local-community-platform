import { useEffect, useMemo, useState } from 'react';
import { FaGithub, FaLinkedinIn, FaXTwitter } from 'react-icons/fa6';
import { LuGlobe, LuLockKeyhole, LuMail, LuSearch } from 'react-icons/lu';
import { listAdminMembers, type AdminMember } from '@/lib/admin';
import { toUserMessage } from '@/lib/errors';

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Never';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs font-bold uppercase tracking-[0.16em] text-braga-300">{label}</dt><dd className="mt-1 break-words text-sm leading-6 text-braga-100">{children || '—'}</dd></div>;
}

function LinkField({ href, icon: Icon, label }: { href: string | null; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; label: string }) {
  return <Field label={label}>{href ? <a className="inline-flex items-center gap-2 text-limewash hover:underline" href={href} target="_blank" rel="noreferrer noopener"><Icon className="h-4 w-4" />{href}</a> : '—'}</Field>;
}

export default function MemberManager() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listAdminMembers().then(setMembers).catch((caught) => setError(toUserMessage('admin-load', caught))).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => [member.email, member.display_name, member.handle, member.role].some((value) => value?.toLowerCase().includes(needle)));
  }, [members, query]);

  if (loading) return <p className="card p-6 text-braga-100" role="status">Loading members…</p>;
  if (error) return <p className="error-message" role="alert">{error}</p>;

  return (
    <div className="space-y-5">
      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-black text-white">Member database</h2><p className="mt-2 text-sm text-braga-200">All {members.length} member records, including profiles hidden from the public directory.</p></div><label className="relative block sm:w-80"><span className="sr-only">Search members</span><LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-braga-300" aria-hidden="true" /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or handle" /></label></div>
      </div>

      {filtered.map((member) => (
        <article key={member.id} className="card p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {member.avatar_url ? <img src={member.avatar_url} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-braga-900 text-xl font-black text-limewash">{member.display_name.slice(0, 2).toUpperCase()}</div>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-bold text-white">{member.display_name}</h3><span className={member.role === 'admin' ? 'rounded-full bg-limewash px-3 py-1 text-xs font-bold uppercase text-ink-950' : 'rounded-full border border-braga-300/30 px-3 py-1 text-xs font-bold uppercase text-braga-100'}>{member.role}</span><span className={member.is_public ? 'rounded-full border border-cyan-300/30 px-3 py-1 text-xs font-bold uppercase text-cyan-200' : 'inline-flex items-center gap-1 rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-xs font-bold uppercase text-violet-200'}>{!member.is_public && <LuLockKeyhole className="h-3 w-3" aria-hidden="true" />}{member.is_public ? 'Public profile' : 'Private profile'}</span></div>
              <a className="mt-2 inline-flex items-center gap-2 text-sm text-limewash hover:underline" href={`mailto:${member.email}`}><LuMail className="h-4 w-4" aria-hidden="true" />{member.email}</a>
            </div>
          </div>
          <dl className="mt-6 grid gap-x-8 gap-y-5 border-t border-braga-300/15 pt-6 md:grid-cols-2">
            <Field label="Member ID"><code className="text-xs">{member.id}</code></Field>
            <Field label="Handle">{member.handle ? `@${member.handle}` : '—'}</Field>
            <Field label="Bio">{member.bio || '—'}</Field>
            <Field label="Email confirmed">{dateTime(member.email_confirmed_at)}</Field>
            <Field label="Last sign-in">{dateTime(member.last_sign_in_at)}</Field>
            <Field label="Account created">{dateTime(member.auth_created_at)}</Field>
            <Field label="Profile created">{dateTime(member.profile_created_at)}</Field>
            <Field label="Profile updated">{dateTime(member.profile_updated_at)}</Field>
            <LinkField label="Website" href={member.website_url} icon={LuGlobe} />
            <LinkField label="LinkedIn" href={member.linkedin_url} icon={FaLinkedinIn} />
            <LinkField label="GitHub" href={member.github_url} icon={FaGithub} />
            <LinkField label="X" href={member.x_url} icon={FaXTwitter} />
            <LinkField label="Avatar URL" href={member.avatar_url} icon={LuGlobe} />
          </dl>
        </article>
      ))}
      {!filtered.length && <p className="card p-6 text-braga-100">No members match that search.</p>}
    </div>
  );
}
