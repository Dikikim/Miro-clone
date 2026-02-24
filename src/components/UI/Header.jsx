import { Home, Star, Upload, Users } from 'lucide-react';

export default function Header() {
    return (
        <header className="fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-between px-4">
            {/* Left: Project Info */}
            <div className="flex items-center gap-3 bg-white rounded-full px-4 py-2 shadow-sm border border-gray-200">
                <button className="text-gray-600 hover:text-gray-900 transition-colors">
                    <Home className="w-5 h-5" />
                </button>
                <div className="h-5 w-px bg-gray-200" />
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-800">KKOT</span>
                    <span className="text-xs text-gray-500">Last edited just now</span>
                </div>
                <button className="text-amber-400 hover:text-amber-500 transition-colors ml-1">
                    <Star className="w-4 h-4 fill-current" />
                </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                {/* User avatars */}
                <div className="flex -space-x-2 mr-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 border-2 border-white" />
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 border-2 border-white" />
                    <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">+3</div>
                </div>

                {/* Export */}
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                    <Upload className="w-4 h-4" />
                    Export
                </button>

                {/* Share */}
                <button className="flex items-center gap-2 px-4 py-2 bg-cyan-500 rounded-lg text-sm font-medium text-white hover:bg-cyan-600 transition-colors shadow-sm">
                    <Users className="w-4 h-4" />
                    Share
                </button>

                {/* Profile */}
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-200 to-rose-300 border border-gray-200 ml-1" />
            </div>
        </header>
    );
}
