import { supabase } from './supabase';

export async function createInvite(code: string, label: string, maxUses: number | null, expiresAt: string | null) {
  const { data, error } = await supabase
    .from('invites')
    .insert({ code, label, max_uses: maxUses, expires_at: expiresAt })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function createEvent(payload: {
  slug: string;
  title: string;
  description: string;
  starts_at: string;
  location_name?: string;
  capacity?: number | null;
  status?: 'draft' | 'published';
}) {
  const { data, error } = await supabase.from('events').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}
