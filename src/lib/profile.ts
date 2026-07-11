import { supabase } from './supabase';
import type { EditableProfile } from './types';

const editableProfileSelect = 'id, handle, display_name, bio, avatar_url, website_url, linkedin_url, github_url, x_url, is_public, created_at, updated_at';
const urlFields = ['avatar_url', 'website_url', 'linkedin_url', 'github_url', 'x_url'] as const;

export function isHttpUrl(value: string | null | undefined) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!isHttpUrl(trimmed)) throw new Error('Profile links must start with http:// or https://.');
  return trimmed;
}

export async function fetchMyProfile() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('You need to sign in first.');

  const { data, error } = await supabase
    .from('profiles')
    .select(editableProfileSelect)
    .eq('id', userData.user.id)
    .single<EditableProfile>();

  if (error) throw error;
  return data;
}

export async function updateMyProfile(profile: Partial<EditableProfile>) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('You need to sign in first.');

  const safeProfile: Partial<EditableProfile> = {
    handle: profile.handle ?? null,
    display_name: profile.display_name || 'New builder',
    bio: profile.bio || '',
    avatar_url: normalizeUrl(profile.avatar_url),
    website_url: normalizeUrl(profile.website_url),
    linkedin_url: normalizeUrl(profile.linkedin_url),
    github_url: normalizeUrl(profile.github_url),
    x_url: normalizeUrl(profile.x_url),
    is_public: Boolean(profile.is_public)
  };

  for (const field of urlFields) {
    if (!isHttpUrl(safeProfile[field])) throw new Error('Profile links must start with http:// or https://.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(safeProfile)
    .eq('id', userData.user.id)
    .select(editableProfileSelect)
    .single<EditableProfile>();

  if (error) throw error;
  return data;
}
