import { useEffect } from 'react';
import useAuth from '../../store/useAuth';
import LoginScreen from './LoginScreen';
import LogoSpinner from '../UI/LogoSpinner';

// Wraps the app: shows a spinner while the session is resolving, the login
// screen when signed out, and the app only once authenticated. Gating here
// (around <App/>) means board data never loads for an anonymous visitor.
export default function LoginGate({ children }) {
    const loading = useAuth(s => s.loading);
    const session = useAuth(s => s.session);
    const init = useAuth(s => s.init);

    useEffect(() => init(), [init]);

    if (loading) {
        const isDark = (() => { try { return localStorage.getItem('kot_theme') === 'dark'; } catch { return false; } })();
        return (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f6f8' }}>
                <LogoSpinner className="w-12 h-12" />
            </div>
        );
    }

    if (!session) return <LoginScreen />;
    return children;
}
