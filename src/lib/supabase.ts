import { createClient } from '@supabase/supabase-js';

const fallbackUrl = 'https://example.supabase.co';
const fallbackKey = 'public-anon-key-placeholder';

export const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || fallbackUrl;
export const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || fallbackKey;
export const siteUrl = import.meta.env.PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4321');

export const isSupabaseConfigured = Boolean(
  import.meta.env.PUBLIC_SUPABASE_URL &&
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY &&
  !import.meta.env.PUBLIC_SUPABASE_URL.includes('YOUR_PROJECT_REF')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // The app is a browser-only client. Invite emails can be opened on a
    // different browser/device, so implicit links are more reliable than a
    // PKCE verifier that only exists in the requesting browser.
    flowType: 'implicit'
  }
});
