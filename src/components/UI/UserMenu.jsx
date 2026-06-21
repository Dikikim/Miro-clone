import { useState, useRef, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import useAuth from '../../store/useAuth';
import useStore from '../../store/useStore';

const ROLE_STYLES = {
    admin: 'bg-purple-100 text-purple-700',
    teacher: 'bg-blue-100 text-blue-700',
    student: 'bg-emerald-100 text-emerald-700',
};

export default function UserMenu() {
    const user = useAuth(s => s.user);
    const profile = useAuth(s => s.profile);
    const signOut = useAuth(s => s.signOut);
    const isDark = useStore(s => s.theme === 'dark');

    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    if (!user) return null;

    const name = profile?.full_name || user.user_metadata?.full_name || user.email;
    const avatar = profile?.avatar_url || user.user_metadata?.avatar_url;
    const role = profile?.role || 'student';
    const initial = (name || '?').trim().charAt(0).toUpperCase();

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(v => !v)}
                title={name}
                className="h-8 w-8 rounded-full overflow-hidden flex items-center justify-center ring-2 ring-transparent hover:ring-purple-400/50 transition"
            >
                {avatar
                    ? <img src={avatar} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    : <span className="h-full w-full flex items-center justify-center text-xs font-semibold bg-purple-500 text-white">{initial}</span>}
            </button>

            {open && (
                <div
                    className={`absolute top-full right-0 mt-2 w-60 rounded-xl shadow-xl border py-2 z-[200] ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                >
                    <div className="px-3 py-2 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                            {avatar
                                ? <img src={avatar} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                : <span className="h-full w-full flex items-center justify-center text-sm font-semibold bg-purple-500 text-white">{initial}</span>}
                        </div>
                        <div className="min-w-0">
                            <div className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{name}</div>
                            <div className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{user.email}</div>
                        </div>
                    </div>
                    <div className="px-3 pb-2">
                        <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${ROLE_STYLES[role] || ROLE_STYLES.student}`}>
                            {role}
                        </span>
                    </div>
                    <div className={`h-px mx-2 my-1 ${isDark ? 'bg-white/10' : 'bg-black/5'}`} />
                    <button
                        onClick={() => { setOpen(false); signOut(); }}
                        className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 ${isDark ? 'text-gray-200 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                        <LogOut className="w-4 h-4" /> Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
