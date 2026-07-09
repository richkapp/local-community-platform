import { supabase } from './supabase';
import type { Profile } from './types';

export async function fetchMyProfile() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('You need to sign in first.');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single<Profile>();

  if (error) throw error;
  return data;
}

export async function updateMyProfile(profile: Partial<Profile>) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('You need to sign in first.');

  const { data, error } = await supabase
    .from('profiles')
    .update(profile)
    .eq('id', userData.user.id)
    .select('*')
    .single<Profile>();

  if (error) throw error;
  return data;
}
