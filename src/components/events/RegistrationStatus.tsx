import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Props = { eventId: string };

export default function RegistrationStatus({ eventId }: Props) {
  const [message, setMessage] = useState('Checking registration...');

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setMessage('Sign in to register for this event.');
        return;
      }

      const { data, error } = await supabase
        .from('event_registrations')
        .select('status')
        .eq('event_id', eventId)
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (error) setMessage(error.message);
      else if (data) setMessage(`Your registration status: ${data.status}`);
      else setMessage('You are not registered yet.');
    }

    load();
  }, [eventId]);

  return <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-braga-100">{message}</p>;
}
