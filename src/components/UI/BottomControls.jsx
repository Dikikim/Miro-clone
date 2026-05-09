import { Minus, Plus, Maximize2, Moon, Sun } from 'lucide-react';
import useStore from '../../store/useStore';

export default function BottomControls() {
    const { stageScale, setStageScale, setStagePosition, nodes, theme, toggleTheme } = useStore();

    const zoomPercent = Math.round(stageScale * 100);

    const handleZoomIn = () => setStageScale(Math.min(5, stageScale * 1.2));
    const handleZoomOut = () => setStageScale(Math.max(0.1, stageScale / 1.2));
    const handleZoomReset = () => setStageScale(1);

    const handleZoomToFit = () => {
        if (nodes.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(node => {
            const x = node.x || 0;
            const y = node.y || 0;
            const w = node.width || (node.radius ? node.radius * 2 : node.radiusX ? node.radiusX * 2 : node.size || 100);
            const h = node.height || (node.radius ? node.radius * 2 : node.radiusY ? node.radiusY * 2 : node.size || 100);
            // For center-positioned nodes (circle, polygon, etc.)
            const isCenter = node.type === 'circle' || node.type === 'ellipse' || node.type === 'triangle'
                || node.type === 'star' || node.type === 'pentagon' || node.type === 'hexagon'
                || node.type === 'octagon' || node.type === 'cross' || node.type === 'rhombus';
            const nx = isCenter ? x - w / 2 : x;
            const ny = isCenter ? y - h / 2 : y;
            minX = Math.min(minX, nx);
            minY = Math.min(minY, ny);
            maxX = Math.max(maxX, nx + w);
            maxY = Math.max(maxY, ny + h);
        });

        const padding = 80;
        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const scaleX = (window.innerWidth - padding * 2) / contentW;
        const scaleY = (window.innerHeight - padding * 2) / contentH;
        const newScale = Math.min(Math.max(scaleX, scaleY) > 5 ? 1 : Math.min(scaleX, scaleY), 5);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        setStageScale(newScale);
        setStagePosition({
            x: window.innerWidth / 2 - centerX * newScale,
            y: window.innerHeight / 2 - centerY * newScale,
        });
    };

    const btnStyle = {
        padding: 'clamp(4px, 0.4vw, 10px) clamp(6px, 0.6vw, 14px)',
        fontSize: 'clamp(10px, 0.8vw + 0.3vh, 14px)',
    };

    return (
        <>
            {/* Bottom Right - Zoom */}
            <div className="fixed bottom-3 right-3 z-40">
                <div className={`flex items-center rounded-xl shadow-lg border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`} style={{ gap: '0', padding: '0' }}>
                    <button
                        onClick={handleZoomOut}
                        className={`${theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} rounded-l transition-colors flex items-center justify-center`}
                        style={btnStyle}
                        title="Zoom out"
                    >
                        <Minus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleZoomReset}
                        className={`font-medium ${theme === 'dark' ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} transition-colors text-center`}
                        style={{
                            ...btnStyle,
                            minWidth: 'clamp(36px, 3vw, 52px)'
                        }}
                    >
                        {zoomPercent}%
                    </button>
                    <button
                        onClick={handleZoomIn}
                        className={`${theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} transition-colors flex items-center justify-center`}
                        style={btnStyle}
                        title="Zoom in"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <div className={`w-px h-5 ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'}`} />
                    <button
                        onClick={handleZoomToFit}
                        className={`${theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} transition-colors flex items-center justify-center`}
                        style={btnStyle}
                        title="Zoom to fit all content"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                    <div className={`w-px h-5 ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'}`} />
                    <button
                        onClick={toggleTheme}
                        className={`${theme === 'dark' ? 'text-yellow-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} rounded-r transition-colors flex items-center justify-center`}
                        style={btnStyle}
                        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </>
    );
}
