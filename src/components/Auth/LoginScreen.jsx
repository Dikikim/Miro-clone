import { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import useAuth from '../../store/useAuth';

// Full-screen sign-in gate. Students/teachers must authenticate with Google
// before the canvas mounts.
export default function LoginScreen() {
    const signInWithGoogle = useAuth(s => s.signInWithGoogle);
    const [busy, setBusy] = useState(false);
    const isDark = (() => { try { return localStorage.getItem('kot_theme') === 'dark'; } catch { return false; } })();

    const handleSignIn = async () => {
        setBusy(true);
        await signInWithGoogle();
        // On success the browser redirects to Google and this component unmounts.
        // If we're still here, the call failed (e.g. provider not enabled) — clear
        // the spinner so the user can retry instead of being stuck on "Redirecting…".
        setBusy(false);
    };

    return (
        <div
            className="w-full h-full flex items-center justify-center relative"
            style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f6f8' }}
        >
            <div
                aria-hidden="true"
                style={{
                    position: 'fixed', inset: 0, pointerEvents: 'none',
                    backgroundImage: 'url(/transp_bg.png)', backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center', backgroundSize: 'contain',
                    transform: 'scale(1.43)', opacity: isDark ? 0.10 : 0.08,
                }}
            />
            <div
                className={`relative z-10 w-[360px] max-w-[90vw] rounded-2xl shadow-2xl border px-8 py-10 flex flex-col items-center text-center ${isDark ? 'bg-gray-800 border-white/10' : 'bg-white border-black/5'}`}
            >
                <img src="/logo-icon.png" alt="KKOT" className="h-16 w-16 object-contain mb-4" />
                <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Welcome to KKOT</h1>
                <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Sign in to access your boards
                </p>

                <button
                    onClick={handleSignIn}
                    disabled={busy}
                    className={`mt-7 w-full flex items-center justify-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${isDark ? 'bg-gray-700 border-white/10 text-white hover:bg-gray-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                    <FcGoogle className="w-5 h-5" />
                    {busy ? 'Redirecting…' : 'Continue with Google'}
                </button>

                <p className={`mt-6 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    By continuing you agree to use KKOT for your classroom.
                </p>
            </div>
        </div>
    );
}
