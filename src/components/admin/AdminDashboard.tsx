import { useEffect, useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { createEvent, createInvite } from '@/lib/admin';
import { supabase } from '@/lib/supabase';

type AdminMode = 'overview' | 'invites' | 'events' | 'registrations';

type Props = { mode?: AdminMode };

export default function AdminDashboard({ mode = 'overview' }: Props) {
  const [message, setMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [inviteCode, setInviteCode] = useState('braga-whatsapp');
  const [eventTitle, setEventTitle] = useState('Monthly Builder Night');

  useEffect(() => {
    async function check() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
      setIsAdmin(data?.role === 'admin');
    }
    check();
  }, []);

  async function addInvite(event: FormSubmitEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await createInvite(inviteCode, 'WhatsApp invite', 250, null);
      setMessage('Invite created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create invite.');
    }
  }

  async function addEvent(event: FormSubmitEvent) {
    event.preventDefault();
    setMessage('');
    try {
      const slug = eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      await createEvent({
        slug: `${slug}-${crypto.randomUUID().slice(0, 6)}`,
        title: eventTitle,
        description: 'Monthly Braga AI Builders meetup.',
        starts_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        location_name: 'Braga, Portugal',
        capacity: 40,
        status: 'draft'
      });
      setMessage('Draft event created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create event.');
    }
  }

  if (isAdmin === null) return <p className="card p-6 text-braga-100">Checking admin access...</p>;
  if (!isAdmin) return <p className="card p-6 text-red-300">Admin access required.</p>;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-braga-300">Admin mode: {mode}</p>
        <h1 className="mt-2 text-3xl font-black text-white">Organizer dashboard</h1>
        {message && <p className="mt-4 text-sm text-limewash">{message}</p>}
      </div>

      {(mode === 'overview' || mode === 'invites') && (
        <form onSubmit={addInvite} className="card space-y-4 p-6">
          <h2 className="text-xl font-bold text-white">Create invite</h2>
          <input className="input" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toLowerCase())} />
          <button className="btn-primary">Create WhatsApp invite</button>
        </form>
      )}

      {(mode === 'overview' || mode === 'events') && (
        <form onSubmit={addEvent} className="card space-y-4 p-6">
          <h2 className="text-xl font-bold text-white">Create draft event</h2>
          <input className="input" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} />
          <button className="btn-primary">Create draft event</button>
        </form>
      )}

      {(mode === 'overview' || mode === 'registrations') && (
        <div className="card p-6">
          <h2 className="text-xl font-bold text-white">Registrations</h2>
          <p className="mt-2 text-slate-300">Use Supabase table exports for v1 registration operations. A richer CSV export can be added after the first live event.</p>
        </div>
      )}
    </div>
  );
}
