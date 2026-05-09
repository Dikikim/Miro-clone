import {
    MousePointer2, Square, Type, Image, Youtube, Pencil, Trash2, Eraser, FileText, ChevronRight,
    Circle, Triangle, Star, Diamond, Hexagon, Minus, ArrowRight, Pentagon, Octagon, Heart, Cloud, RectangleHorizontal, Plus,
    Undo2, Redo2, FolderOpen, Music, Video, Highlighter, StickyNote, Pointer, Frame, MessageCircle, ChevronDown,
    Timer, Play, Pause, RotateCcw
} from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import { cn } from '../../lib/utils';
import ConfirmModal from './ConfirmModal';
import ColorPalette from './ColorPalette';
import UnifiedMediaModal from '../Upload/UnifiedMediaModal';

const shapeOptions = [
    { id: 'rectangle', Icon: Square, label: 'Rectangle' },
    { id: 'roundedRect', Icon: RectangleHorizontal, label: 'Rounded Rectangle' },
    { id: 'circle', Icon: Circle, label: 'Circle' },
    { id: 'ellipse', Icon: Circle, label: 'Ellipse' },
    { id: 'triangle', Icon: Triangle, label: 'Triangle' },
    { id: 'star', Icon: Star, label: 'Star' },
    { id: 'diamond', Icon: Diamond, label: 'Diamond' },
    { id: 'pentagon', Icon: Pentagon, label: 'Pentagon' },
    { id: 'hexagon', Icon: Hexagon, label: 'Hexagon' },
    { id: 'octagon', Icon: Octagon, label: 'Octagon' },
    { id: 'heart', Icon: Heart, label: 'Heart' },
    { id: 'cloud', Icon: Cloud, label: 'Cloud' },
    { id: 'cross', Icon: Plus, label: 'Cross/Plus' },
    { id: 'rhombus', Icon: Diamond, label: 'Rhombus' },
];

const lineOptions = [
    { id: 'arrow', Icon: ArrowRight, label: 'Arrow' },
    { id: 'line', Icon: Minus, label: 'Line' },
];

const STICKY_COLORS = [
    '#fef08a', '#fde68a', '#d9f99d', '#a7f3d0',
    '#bae6fd', '#ddd6fe', '#fecdd3', '#fed7aa',
];

// Tool definitions for the magic nav
const NAV_TOOLS = [
    { id: 'select', Icon: MousePointer2, label: 'Select (V)' },
    { id: 'shape', Icon: Square, label: 'Shapes (S)', hasPopup: true },
    { id: 'text', Icon: Type, label: 'Text (T)' },
    { id: 'pen', Icon: Pencil, label: 'Pen (P)', hasPopup: true },
    { id: 'highlighter', Icon: Highlighter, label: 'Highlighter (H)', hasPopup: true },
    { id: 'eraser', Icon: Eraser, label: 'Eraser (E)' },
    { id: 'sticky', Icon: StickyNote, label: 'Sticky Note (N)', hasPopup: true },
    { id: 'comment', Icon: MessageCircle, label: 'Comment' },
    { id: 'laser', Icon: Pointer, label: 'Laser Pointer (L)' },
];

/**
 * Countdown/Stopwatch timer widget for the toolbar.
 */
function TimerWidget({ isDark }) {
    const [showTimer, setShowTimer] = useState(false);
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(5);
    const [seconds, setSeconds] = useState(0);
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const intervalRef = useRef(null);
    const containerRef = useRef(null);

    // Countdown tick
    useEffect(() => {
        if (isRunning && totalSeconds > 0) {
            intervalRef.current = setInterval(() => {
                setTotalSeconds(prev => {
                    if (prev <= 1) {
                        clearInterval(intervalRef.current);
                        setIsRunning(false);
                        setIsFinished(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isRunning, totalSeconds]);

    // Close on outside click — always close, timer keeps counting in background
    useEffect(() => {
        if (!showTimer) return;
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowTimer(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showTimer]);



    const displayH = Math.floor(totalSeconds / 3600);
    const displayM = Math.floor((totalSeconds % 3600) / 60);
    const displayS = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');

    const handleStart = () => {
        if (!isRunning && totalSeconds === 0) {
            const total = hours * 3600 + minutes * 60 + seconds;
            if (total <= 0) return;
            setTotalSeconds(total);
            setIsFinished(false);
            setIsRunning(true);
        } else if (!isRunning && totalSeconds > 0) {
            setIsFinished(false);
            setIsRunning(true);
        } else {
            setIsRunning(false);
        }
    };

    const handleReset = () => {
        setIsRunning(false);
        setTotalSeconds(0);
        setIsFinished(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    const timerActive = isRunning || totalSeconds > 0;

    return (
        <div style={{ padding: '0 4px' }} ref={containerRef}>
            <button
                onClick={() => setShowTimer(v => !v)}
                className={cn(
                    "flex items-center justify-center rounded-lg transition-all relative",
                    showTimer
                        ? "text-purple-500"
                        : isFinished
                            ? "text-red-500 animate-pulse"
                            : timerActive
                                ? "text-green-500"
                                : isDark ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:bg-gray-100"
                )}
                style={{ width: '42px', height: '42px' }}
                title="Timer"
            >
                <Timer style={{ width: '18px', height: '18px' }} />
                {timerActive && (
                    <div
                        className="absolute"
                        style={{
                            bottom: '3px',
                            right: '3px',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isRunning ? '#22c55e' : '#f59e0b',
                        }}
                    />
                )}
            </button>

            {showTimer && (
                <div
                    className={`fixed rounded-xl shadow-xl border p-3 z-50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                    style={{
                        left: '58px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '200px',
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className={`text-xs mb-2 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>⏱ Timer</div>

                    {/* Display */}
                    <div
                        className="text-center rounded-lg py-3 mb-3"
                        style={{
                            fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
                            fontSize: '28px',
                            fontWeight: '700',
                            letterSpacing: '1px',
                            background: isDark ? '#1f2937' : '#f3f4f6',
                            color: isFinished ? '#ef4444' : timerActive ? (isDark ? '#e0e0e0' : '#1f2937') : (isDark ? '#9ca3af' : '#6b7280'),
                            transition: 'color 0.3s',
                        }}
                    >
                        {timerActive || isFinished
                            ? `${pad(displayH)}:${pad(displayM)}:${pad(displayS)}`
                            : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`}
                        {isFinished && <div className="text-xs text-red-500 mt-1 font-normal">Time's up!</div>}
                    </div>

                    {/* Input fields (only when not running) */}
                    {!timerActive && !isFinished && (
                        <div className="flex items-center justify-center gap-1 mb-3">
                            {[
                                { label: 'H', value: hours, setter: setHours, max: 23 },
                                { label: 'M', value: minutes, setter: setMinutes, max: 59 },
                                { label: 'S', value: seconds, setter: setSeconds, max: 59 },
                            ].map(({ label, value, setter, max }) => (
                                <div key={label} className="flex flex-col items-center">
                                    <input
                                        type="number"
                                        min={0}
                                        max={max}
                                        value={value}
                                        onChange={(e) => setter(Math.max(0, Math.min(max, parseInt(e.target.value) || 0)))}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        className={`w-[46px] text-center text-sm font-semibold rounded-lg border py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                                        style={{ MozAppearance: 'textfield' }}
                                    />
                                    <span className={`text-[9px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={handleStart}
                            className={`flex items-center justify-center gap-1 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                isRunning
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                    : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                            title={isRunning ? 'Pause' : 'Start'}
                        >
                            {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            {isRunning ? 'Pause' : 'Start'}
                        </button>
                        <button
                            onClick={handleReset}
                            className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                            title="Reset"
                        >
                            <RotateCcw className="w-3 h-3" />
                            Reset
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function Toolbar() {
    const {
        tool, setTool, shapeType, setShapeType,
        fillColor, setFillColor,
        strokeColor, setStrokeColor,
        penStrokeWidth, setPenStrokeWidth,
        highlighterStrokeWidth, setHighlighterStrokeWidth,
        objectStrokeWidth, setObjectStrokeWidth,
        textColor, setTextColor,
        textFontFamily, setTextFontFamily,
        textFontSize, setTextFontSize,
        highlighterColor, setHighlighterColor,
        cornerRadius, setCornerRadius,
        nodes, selectedNodeIds, deleteAllNodes, deleteSelectedNodes,
        isSaving, isLoading, lastSaved,
        undo, redo, canUndo, canRedo,
        theme,
        addNode,
    } = useStore();

    const isDark = theme === 'dark';

    // Memoize random rotations for sticky pile so they don't jitter on re-render
    const stickyRotations = useMemo(() => Array.from({ length: 25 }, () => (Math.random() - 0.5) * 8), []);

    const [activePopup, setActivePopup] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showMediaModal, setShowMediaModal] = useState(false);
    const popupRef = useRef(null);
    const penBtnRef = useRef(null);
    const shapeBtnRef = useRef(null);
    const highlighterBtnRef = useRef(null);
    const textBtnRef = useRef(null);
    const stickyBtnRef = useRef(null);
    const navListRef = useRef(null);

    // Auto-open popups when the tool is set from outside (e.g. keyboard shortcut)
    useEffect(() => {
        if (tool === 'shape' && activePopup !== 'shape') {
            setActivePopup('shape');
        } else if (tool === 'sticky' && activePopup !== 'sticky') {
            setActivePopup('sticky');
        } else if (tool === 'pen' && activePopup !== 'pen') {
            setActivePopup('pen');
        } else if (tool === 'highlighter' && activePopup !== 'highlighter') {
            setActivePopup('highlighter');
        }
    }, [tool]);

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                setActivePopup(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToolClick = (toolName, hasPopup = false) => {
        if (hasPopup) {
            if (activePopup === toolName) {
                setActivePopup(null);
            } else {
                setActivePopup(toolName);
                setTool(toolName);
            }
        } else {
            setTool(toolName);
            setActivePopup(null);
        }
    };

    const handleShapeSelect = (shapeId) => {
        setShapeType(shapeId);
        setTool('shape');
        setActivePopup(null);
    };

    const handleStickyPileClick = (color) => {
        // Set the selected color in store and switch to sticky tool
        useStore.getState().setStickyColor(color);
        setTool('sticky');
        setActivePopup(null);
    };

    // Find the active tool index for the indicator
    const activeIndex = NAV_TOOLS.findIndex(t => t.id === tool);
    const ITEM_HEIGHT = 46; // Height of each nav item in px

    return (
        <div className="fixed left-0 top-0 bottom-0 z-40 flex items-center" ref={popupRef}>
            <div
                className={`magic-nav rounded-r-xl shadow-lg border border-l-0 flex flex-col my-2 ml-0 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                style={{
                    padding: '4px 0',
                    maxHeight: 'calc(100vh - 16px)',
                    overflowY: 'auto',
                    overflowX: 'visible',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    position: 'relative',
                }}
            >
                {/* Magic Navigation Section */}
                <div className="magic-nav-section" ref={navListRef} style={{ position: 'relative', padding: '0 4px' }}>
                    {/* Animated Indicator */}
                    {activeIndex >= 0 && (
                        <div
                            className="magic-indicator"
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: `${activeIndex * ITEM_HEIGHT + ITEM_HEIGHT / 2}px`,
                                transform: 'translate(-50%, -50%)',
                                width: '42px',
                                height: '42px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #7b5ea7, #4a90d9, #2ec4b6)',
                                boxShadow: '0 0 15px rgba(74, 144, 217, 0.4), 0 0 30px rgba(74, 144, 217, 0.15)',
                                transition: 'top 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55)',
                                zIndex: 0,
                                pointerEvents: 'none',
                            }}
                        />
                    )}

                    {NAV_TOOLS.map((navTool, index) => {
                        const isActive = tool === navTool.id;
                        const Icon = navTool.Icon;
                        const btnRef = navTool.id === 'shape' ? shapeBtnRef
                            : navTool.id === 'pen' ? penBtnRef
                                : navTool.id === 'highlighter' ? highlighterBtnRef
                                    : navTool.id === 'text' ? textBtnRef
                                        : navTool.id === 'sticky' ? stickyBtnRef
                                            : null;

                        return (
                            <button
                                key={navTool.id}
                                ref={btnRef}
                                onClick={() => handleToolClick(navTool.id, navTool.hasPopup)}
                                className={cn(
                                    "magic-nav-item flex items-center justify-center transition-all relative",
                                    isActive
                                        ? "text-white"
                                        : isDark
                                            ? "text-gray-400 hover:text-gray-200"
                                            : "text-gray-500 hover:text-gray-700"
                                )}
                                style={{
                                    width: '42px',
                                    height: `${ITEM_HEIGHT}px`,
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    zIndex: 1,
                                    position: 'relative',
                                    borderRadius: '8px',
                                }}
                                title={navTool.label}
                            >
                                <Icon
                                    style={{
                                        width: isActive ? '20px' : '18px',
                                        height: isActive ? '20px' : '18px',
                                        transition: 'all 0.3s ease',
                                        filter: isActive ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
                                    }}
                                />
                                {navTool.hasPopup && !isActive && (
                                    <ChevronRight
                                        className="absolute opacity-40"
                                        style={{
                                            width: '8px',
                                            height: '8px',
                                            right: '2px',
                                            bottom: '6px',
                                        }}
                                    />
                                )}
                                {/* Tooltip label that appears on hover */}
                                <span
                                    className={cn(
                                        "magic-nav-label absolute whitespace-nowrap text-xs font-medium opacity-0 pointer-events-none transition-all",
                                        isActive && "opacity-100"
                                    )}
                                    style={{
                                        left: '52px',
                                        color: isActive ? '#4a90d9' : (isDark ? '#9ca3af' : '#6b7280'),
                                        fontSize: '10px',
                                        letterSpacing: '0.05em',
                                        textShadow: isActive ? '0 0 8px rgba(74, 144, 217, 0.3)' : 'none',
                                    }}
                                >
                                    {navTool.label.split(' (')[0]}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className={`h-px mx-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} style={{ margin: '4px 6px' }} />

                {/* Timer Widget */}
                <TimerWidget isDark={isDark} />

                <div className={`h-px mx-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} style={{ margin: '4px 6px' }} />

                {/* Media Upload */}
                <div style={{ padding: '0 4px' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMediaModal(true);
                            setActivePopup(null);
                        }}
                        className={cn(
                            "flex items-center justify-center rounded-lg transition-all relative group",
                            isDark ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:bg-gray-100"
                        )}
                        style={{ width: '42px', height: '42px' }}
                        title="Add Media (YouTube, Images, Audio, Video, PDF)"
                    >
                        <FolderOpen style={{ width: '18px', height: '18px' }} />
                        <ChevronRight className="absolute opacity-40" style={{ width: '8px', height: '8px', right: '2px', bottom: '4px' }} />
                    </button>
                </div>

                <div className={`h-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} style={{ margin: '4px 6px' }} />

                {/* Delete */}
                <div style={{ padding: '0 4px' }}>
                    <button
                        onClick={() => {
                            if (selectedNodeIds.length > 0) {
                                deleteSelectedNodes();
                            } else if (nodes.length > 0) {
                                setShowConfirm(true);
                            }
                        }}
                        disabled={nodes.length === 0}
                        className={cn(
                            "flex items-center justify-center rounded-lg transition-colors",
                            nodes.length > 0
                                ? "text-red-500 hover:bg-red-50"
                                : "text-gray-300 cursor-not-allowed"
                        )}
                        style={{ width: '42px', height: '42px' }}
                        title={selectedNodeIds.length > 0 ? `Delete Selected (${selectedNodeIds.length})` : "Clear All"}
                    >
                        <Trash2 style={{ width: '18px', height: '18px' }} />
                    </button>
                </div>

                <div className={`h-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} style={{ margin: '4px 6px' }} />

                {/* Undo/Redo */}
                <div style={{ padding: '0 4px' }}>
                    <button
                        onClick={() => undo()}
                        disabled={!canUndo()}
                        className={cn(
                            "flex items-center justify-center rounded-lg transition-colors",
                            canUndo()
                                ? isDark ? "text-gray-400 hover:text-gray-200 hover:bg-gray-700" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                                : "text-gray-300 cursor-not-allowed"
                        )}
                        style={{ width: '42px', height: '42px' }}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 style={{ width: '18px', height: '18px' }} />
                    </button>
                    <button
                        onClick={() => redo()}
                        disabled={!canRedo()}
                        className={cn(
                            "flex items-center justify-center rounded-lg transition-colors",
                            canRedo()
                                ? isDark ? "text-gray-400 hover:text-gray-200 hover:bg-gray-700" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                                : "text-gray-300 cursor-not-allowed"
                        )}
                        style={{ width: '42px', height: '42px' }}
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 style={{ width: '18px', height: '18px' }} />
                    </button>
                </div>

                <div className={`h-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} style={{ margin: '4px 6px' }} />

                {/* Status indicator */}
                <div
                    className="flex items-center justify-center"
                    style={{ width: '42px', height: '42px', margin: '0 4px' }}
                    title={isLoading ? "Loading..." : isSaving ? "Saving..." : lastSaved ? "Saved" : "Local"}
                >
                    {isLoading ? (
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
                    ) : isSaving ? (
                        <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full animate-pulse" />
                    ) : lastSaved ? (
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                    ) : (
                        <div className="w-2.5 h-2.5 bg-gray-400 rounded-full" />
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={showConfirm}
                message="Are you sure you want to delete all items?"
                onConfirm={() => { deleteAllNodes(); setShowConfirm(false); }}
                onCancel={() => setShowConfirm(false)}
            />

            {/* Sticky Note Pile Popup */}
            {activePopup === 'sticky' && (
                <div
                    className={`fixed rounded-xl shadow-xl border p-3 z-50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                    style={{
                        left: 'clamp(58px, 4vw + 2vh, 70px)',
                        top: stickyBtnRef.current ? `${stickyBtnRef.current.getBoundingClientRect().top}px` : '50%',
                        width: '220px',
                    }}
                >
                    <div className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Sticky Notes</div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-gray-400">Click color, then click canvas to place</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <button
                            onClick={() => {
                                const st = useStore.getState();
                                st.setStickyPileMode(!st.stickyPileMode);
                            }}
                            className={`px-2 py-1 text-[10px] rounded-lg border transition-colors ${useStore.getState().stickyPileMode ? 'bg-purple-500 text-white border-purple-500' : isDark ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-50 text-gray-600 border-gray-300'}`}
                        >
                            {useStore.getState().stickyPileMode ? '📚 Pile ON' : '📝 Single'}
                        </button>
                        <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: useStore.getState().stickyColor }} title="Selected color" />
                    </div>

                    {/* Visual pile of 25 sticky notes */}
                    <div className="relative mb-3" style={{ height: '120px' }}>
                        {Array.from({ length: 25 }).map((_, i) => {
                            const color = STICKY_COLORS[i % STICKY_COLORS.length];
                            const row = Math.floor(i / 5);
                            const col = i % 5;
                            const rotation = stickyRotations[i];
                            return (
                                <button
                                    key={i}
                                    onClick={() => handleStickyPileClick(color)}
                                    className="absolute cursor-pointer hover:z-10 hover:scale-110 transition-transform"
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        backgroundColor: color,
                                        borderRadius: '3px',
                                        boxShadow: '1px 1px 3px rgba(0,0,0,0.15)',
                                        left: `${col * 38}px`,
                                        top: `${row * 22}px`,
                                        transform: `rotate(${rotation}deg)`,
                                        zIndex: i,
                                    }}
                                    title={`Add ${color} sticky note`}
                                />
                            );
                        })}
                    </div>

                    {/* Color options */}
                    <div className={`text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Colors</div>
                    <div className="grid grid-cols-8 gap-1">
                        {STICKY_COLORS.map(color => (
                            <button
                                key={color}
                                onClick={() => handleStickyPileClick(color)}
                                className="w-5 h-5 rounded transition-transform hover:scale-125"
                                style={{ backgroundColor: color, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                                title={color}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Unified Media Modal */}
            {showMediaModal && (
                <UnifiedMediaModal onClose={() => setShowMediaModal(false)} />
            )}

            {/* Shape Popup with ColorPalette */}
            {activePopup === 'shape' && (
                <div
                    className={`fixed rounded-xl shadow-xl border p-3 z-50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                    style={{
                        left: 'clamp(58px, 4vw + 2vh, 70px)',
                        top: shapeBtnRef.current ? `${Math.min(shapeBtnRef.current.getBoundingClientRect().top, window.innerHeight - 500)}px` : '50%',
                        width: '240px',
                        maxHeight: 'calc(100vh - 40px)',
                        overflowY: 'auto',
                        scrollbarWidth: 'thin',
                    }}
                >
                    {/* Shapes Grid */}
                    <div className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Shapes</div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {shapeOptions.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => handleShapeSelect(opt.id)}
                                className={cn(
                                    "w-10 h-10 flex items-center justify-center rounded-lg transition-all border-2",
                                    shapeType === opt.id
                                        ? "bg-purple-100 text-purple-600 border-purple-400"
                                        : isDark ? "hover:bg-gray-700 border-transparent text-gray-300" : "hover:bg-gray-100 border-transparent text-gray-700"
                                )}
                                title={opt.label}
                            >
                                <opt.Icon className="w-6 h-6" />
                            </button>
                        ))}
                    </div>

                    {/* Lines */}
                    <div className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Lines</div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {lineOptions.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => handleShapeSelect(opt.id)}
                                className={cn(
                                    "w-10 h-10 flex items-center justify-center rounded-lg transition-all border-2",
                                    shapeType === opt.id
                                        ? "bg-purple-100 text-purple-600 border-purple-400"
                                        : isDark ? "hover:bg-gray-700 border-transparent text-gray-300" : "hover:bg-gray-100 border-transparent text-gray-700"
                                )}
                                title={opt.label}
                            >
                                <opt.Icon className="w-6 h-6" />
                            </button>
                        ))}
                    </div>

                    {/* Object Stroke Width */}
                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Stroke Width</div>
                    <input
                        type="range"
                        min="0"
                        max="10"
                        value={objectStrokeWidth}
                        onChange={(e) => setObjectStrokeWidth(Number(e.target.value))}
                        className="w-full h-1.5 accent-purple-500"
                    />
                    <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{objectStrokeWidth}px</div>

                    <div className={`h-px my-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                    {/* Corner Radius */}
                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Corner Radius</div>
                    <input
                        type="range"
                        min="0"
                        max="50"
                        value={cornerRadius}
                        onChange={(e) => setCornerRadius(Number(e.target.value))}
                        className="w-full h-1.5 accent-purple-500"
                    />
                    <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{cornerRadius}px</div>
                </div>
            )}

            {/* Pen Popup with ColorPalette */}
            {activePopup === 'pen' && (
                <div
                    className={`fixed rounded-xl shadow-xl border p-3 z-50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                    style={{
                        left: 'clamp(58px, 4vw + 2vh, 70px)',
                        top: penBtnRef.current ? `${penBtnRef.current.getBoundingClientRect().top}px` : '50%',
                        width: '220px',
                        maxHeight: 'calc(100vh - 40px)',
                        overflowY: 'auto',
                        scrollbarWidth: 'thin',
                    }}
                >
                    <ColorPalette selectedColor={strokeColor} onColorSelect={setStrokeColor} title="Pen Color" />

                    <div className={`h-px my-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                    {/* Pen Stroke Width (independent) */}
                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Pen Width</div>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        value={penStrokeWidth}
                        onChange={(e) => setPenStrokeWidth(Number(e.target.value))}
                        className="w-full h-1.5 accent-purple-500"
                    />
                    <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{penStrokeWidth}px</div>
                </div>
            )}

            {/* Highlighter Popup with ColorPalette */}
            {activePopup === 'highlighter' && (
                <div
                    className={`fixed rounded-xl shadow-xl border p-3 z-50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                    style={{
                        left: 'clamp(58px, 4vw + 2vh, 70px)',
                        top: highlighterBtnRef.current ? `${highlighterBtnRef.current.getBoundingClientRect().top}px` : '50%',
                        width: '220px',
                        maxHeight: 'calc(100vh - 40px)',
                        overflowY: 'auto',
                        scrollbarWidth: 'thin',
                    }}
                >
                    <ColorPalette selectedColor={highlighterColor} onColorSelect={setHighlighterColor} title="Highlighter Color" />

                    <div className={`h-px my-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                    {/* Highlighter Stroke Width (independent) */}
                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Highlighter Width</div>
                    <input
                        type="range"
                        min="2"
                        max="50"
                        value={highlighterStrokeWidth}
                        onChange={(e) => setHighlighterStrokeWidth(Number(e.target.value))}
                        className="w-full h-1.5 accent-purple-500"
                    />
                    <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{highlighterStrokeWidth}px</div>
                </div>
            )}
        </div>
    );
}
