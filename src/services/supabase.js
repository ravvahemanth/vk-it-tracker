import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Check if configured — used to show setup instructions in the app
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey
  && !supabaseUrl.includes('your-project-ref')
  && !supabaseAnonKey.includes('your-anon-key'));

// Use placeholder values when not configured (for local preview only)
const effectiveUrl = supabaseUrl || 'https://placeholder.supabase.co';
const effectiveKey = supabaseAnonKey || 'placeholder-key';

// Standard anon client for regular app usage (RLS-enforced)
export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Admin client using service role key (bypasses RLS) — used only for admin operations:
// - Creating employee auth users via GoTrue Admin API
// - Resetting passwords via GoTrue Admin API
// - Deleting auth users via GoTrue Admin API
// Security: This key is accessible to admin users only (who already have full access)
export const adminSupabase = supabaseServiceRoleKey
  ? createClient(effectiveUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

