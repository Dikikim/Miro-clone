import { Minus, Plus, Maximize2, Moon, Sun } from 'lucide-react';
import useStore from '../../store/useStore';

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

// Shape types whose x/y is their center rather than top-left
const CENTERED_TYPES = new Set([
    'circle', 'ellipse', 'triangle', 'star', 'pentagon', 'hexagon',
    'octagon', 'cross', 'rhombus', 'diamond', 'heart',
]);

// World-space bounding box for any node, matching how the canvas renders it
const getNodeBBox = (node) => {
    if (node.points && node.points.length >= 2) {
        const ox = node.x || 0;
        const oy = node.y || 0;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < node.points.length; i += 2) {
            minX = Math.min(minX, node.points[i]);
            maxX = Math.max(maxX, node.points[i]);
            minY = Math.min(minY, node.points[i + 1]);
            maxY = Math.max(maxY, node.points[i + 1]);
        }
        return { minX: minX + ox, minY: minY + oy, maxX: maxX + ox, maxY: maxY + oy };
    }

    const x = node.x || 0;
    const y = node.y || 0;
    const w = node.width || (node.radius ? node.radius * 2 : node.radiusX ? node.radiusX * 2 : node.size || 100);
    const h = node.height || (node.radius ? node.radius * 2 : node.radiusY ? node.radiusY * 2 : node.size || 100);
    const nx = CENTERED_TYPES.has(node.type) ? x - w / 2 : x;
    const ny = CENTERED_TYPES.has(node.type) ? y - h / 2 : y;
    return { minX: nx, minY: ny, maxX: nx + w, maxY: ny + h };
};

export default function BottomControls() {
    const { stageScale, stagePosition, setStageScale, setStagePosition, nodes, theme, toggleTheme } = useStore();
    const isDark = theme === 'dark';

    const zoomPercent = Math.round(stageScale * 100);

    // Zoom keeping the viewport center fixed, like pinch-zoom on iOS
    const zoomTo = (targetScale) => {
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale));
        if (scale === stageScale) return;
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        setStagePosition({
            x: cx - ((cx - stagePosition.x) / stageScale) * scale,
            y: cy - ((cy - stagePosition.y) / stageScale) * scale,
        });
        setStageScale(scale);
    };

    const handleZoomToFit = () => {
        if (nodes.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(node => {
            const box = getNodeBBox(node);
            minX = Math.min(minX, box.minX);
            minY = Math.min(minY, box.minY);
            maxX = Math.max(maxX, box.maxX);
            maxY = Math.max(maxY, box.maxY);
        });

        const padding = 80;
        const contentW = Math.max(maxX - minX, 1);
        const contentH = Math.max(maxY - minY, 1);
        const fitScale = Math.min(
            (window.innerWidth - padding * 2) / contentW,
            (window.innerHeight - padding * 2) / contentH
        );
        // Don't over-zoom tiny content; never zoom out beyond the minimum
        const newScale = fitScale > MAX_SCALE ? 1 : Math.max(fitScale, MIN_SCALE);

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
    const btnCls = `${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'} transition-colors flex items-center justify-center`;
    const sepCls = `w-px h-5 ${isDark ? 'bg-white/15' : 'bg-black/10'}`;

    return (
        <div className="fixed bottom-3 right-3 z-40">
            <div className={`relative flex items-center rounded-xl overflow-hidden menu-accent-edge ${isDark ? 'glass-panel-dark' : 'glass-panel'}`}>
                <button onClick={() => zoomTo(stageScale / 1.2)} className={btnCls} style={btnStyle} title="Zoom out">
                    <Minus className="w-4 h-4" />
                </button>
                <button
                    onClick={() => zoomTo(1)}
                    className={`font-medium ${isDark ? 'text-gray-200 hover:bg-white/10' : 'text-gray-700 hover:bg-black/5'} transition-colors text-center`}
                    style={{ ...btnStyle, minWidth: 'clamp(36px, 3vw, 52px)' }}
                    title="Reset zoom to 100%"
                >
                    {zoomPercent}%
                </button>
                <button onClick={() => zoomTo(stageScale * 1.2)} className={btnCls} style={btnStyle} title="Zoom in">
                    <Plus className="w-4 h-4" />
                </button>
                <div className={sepCls} />
                <button onClick={handleZoomToFit} className={btnCls} style={btnStyle} title="Zoom to fit all content">
                    <Maximize2 className="w-4 h-4" />
                </button>
                <div className={sepCls} />
                <button
                    onClick={toggleTheme}
                    className={`${isDark ? 'text-yellow-400 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'} transition-colors flex items-center justify-center`}
                    style={btnStyle}
                    title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}
