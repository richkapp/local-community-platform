import { supabase } from './supabase';

export async function registerForEvent(eventId: string, note: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('You need to sign in first.');

  const { data, error } = await supabase
    .from('event_registrations')
    .insert({ event_id: eventId, user_id: userData.user.id, note })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function cancelRegistration(registrationId: string) {
  const { error } = await supabase
    .from('event_registrations')
    .update({ status: 'cancelled' })
    .eq('id', registrationId);

  if (error) throw error;
}
