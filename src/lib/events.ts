import { supabase } from './supabase';

export async function registerForEvent(eventId: string, note: string) {
  const normalizedNote = note.trim();
  if (normalizedNote.length > 500) throw new Error('Registration notes must be 500 characters or fewer.');

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('You need to sign in first.');

  const { data, error } = await supabase.rpc('register_for_event', {
    target_event_id: eventId,
    registration_note: normalizedNote
  });
  if (error) throw error;
  return data;
}

export async function cancelRegistration(eventId: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('You need to sign in first.');

  const { data, error } = await supabase.rpc('cancel_event_registration', {
    target_event_id: eventId
  });
  if (error) throw error;
  return data;
}
