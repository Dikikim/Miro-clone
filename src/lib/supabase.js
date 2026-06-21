import { createClient } from '@supabase/supabase-js';

// Frontend client. Uses the PUBLISHABLE key only — it's safe to ship to the
// browser because Row Level Security (RLS) on the database enforces who can
// read/write what. The sb_secret_ key must never appear here.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    // Don't throw — let the app still boot in localStorage-only mode during
    // the migration, but make the misconfiguration obvious in the console.
    console.warn('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY — check your .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});
