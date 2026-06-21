import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Auth/session state, kept separate from the canvas store (useStore) so the
// login gate can mount before any board data loads.
const useAuth = create((set, get) => ({
    loading: true,          // true until the first auth event resolves
    session: null,
    user: null,
    profile: null,          // { id, email, full_name, avatar_url, role, teacher_id }

    // Subscribe to auth changes. onAuthStateChange fires an INITIAL_SESSION
    // event on subscribe with the session restored from localStorage, so this
    // also covers the initial load. Returns an unsubscribe fn for cleanup.
    init: () => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            set({ session, user: session?.user ?? null, loading: false });
            if (session?.user) {
                // Defer the profiles query — calling supabase awaits *inside*
                // the auth callback can deadlock the client.
                setTimeout(() => get().loadProfile(), 0);
            } else {
                set({ profile: null });
            }
        });
        return () => subscription.unsubscribe();
    },

    loadProfile: async () => {
        const user = get().user;
        if (!user) return;
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url, role, teacher_id')
            .eq('id', user.id)
            .single();
        if (error) {
            console.error('[auth] loadProfile error:', error.message);
            return;
        }
        set({ profile: data });
    },

    signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
        });
        if (error) console.error('[auth] signIn error:', error.message);
    },

    signOut: async () => {
        await supabase.auth.signOut();
        set({ session: null, user: null, profile: null });
    },
}));

export default useAuth;
