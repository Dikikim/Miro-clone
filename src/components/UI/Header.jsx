import BoardSwitcher from './BoardSwitcher';
import useStore from '../../store/useStore';

export default function Header() {
    const theme = useStore(s => s.theme);
    const isDark = theme === 'dark';

    return (
        <header className="fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-end px-4 pointer-events-none">
            <div className={`relative flex items-center gap-3 rounded-2xl px-4 py-2 pointer-events-auto ${isDark ? 'glass-panel-dark menu-accent-edge' : 'glass-panel'}`}>
                <div className="h-9 w-9 overflow-hidden flex-shrink-0 flex items-center justify-center rounded-full" style={{ background: 'transparent' }}>
                    <img src="/logo/logo.jpg" alt="KKOT" className="h-full w-full object-cover" style={{ mixBlendMode: isDark ? 'screen' : 'multiply', transform: 'scale(1.35)' }} />
                </div>
                <span className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>KKOT</span>
                <div className={`h-5 w-px ${isDark ? 'bg-white/15' : 'bg-black/10'}`} />
                <BoardSwitcher />
            </div>
        </header>
    );
}
