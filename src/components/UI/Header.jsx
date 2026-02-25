import BoardSwitcher from './BoardSwitcher';

export default function Header() {
    return (
        <header className="fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-end px-4 pointer-events-none">
            <div className="flex items-center gap-3 bg-white rounded-full px-4 py-2 shadow-sm border border-gray-200 pointer-events-auto">
                <div className="h-8 w-8 overflow-hidden flex-shrink-0">
                    <img src="/logo/logo.png" alt="KKOT" className="h-12 w-12 object-cover object-top" style={{ mixBlendMode: 'multiply' }} />
                </div>
                <span className="text-sm font-semibold text-gray-800">KKOT</span>
                <div className="h-5 w-px bg-gray-200" />
                <BoardSwitcher />
            </div>
        </header>
    );
}
