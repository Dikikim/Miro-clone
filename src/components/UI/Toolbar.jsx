import {
    MousePointer2, Square, Type, Pencil, Trash2, Eraser, ChevronRight,
    Circle, Triangle, Star, Diamond, Hexagon, Minus, ArrowRight, ArrowLeftRight, MoreHorizontal, Pentagon, Octagon, Heart, Cloud, RectangleHorizontal, Plus,
    Undo2, Redo2, FolderOpen, Highlighter, StickyNote,
    Timer, Play, Pause, RotateCcw
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
    { id: 'parallelogram', Icon: RectangleHorizontal, label: 'Parallelogram' },
    { id: 'trapezoid', Icon: Square, label: 'Trapezoid' },
    { id: 'rightTriangle', Icon: Triangle, label: 'Right Triangle' },
];

const lineOptions = [
    { id: 'arrow', Icon: ArrowRight, label: 'Arrow' },
    { id: 'doubleArrow', Icon: ArrowLeftRight, label: 'Double Arrow' },
    { id: 'line', Icon: Minus, label: 'Line' },
    { id: 'dashedLine', Icon: Minus, label: 'Dashed Line' },
    { id: 'dottedLine', Icon: MoreHorizontal, label: 'Dotted Line' },
];

const STICKY_COLORS = [
    '#fef08a', '#fde68a', '#d9f99d', '#a7f3d0',
    '#bae6fd', '#ddd6fe', '#fecdd3', '#fed7aa',
];

// Random rotations for the sticky pile, fixed at module load so they never jitter
const STICKY_ROTATIONS = Array.from({ length: 25 }, () => (Math.random() - 0.5) * 8);

// Tools that open a submenu popup when activated
const POPUP_TOOLS = ['shape', 'sticky', 'pen', 'highlighter', 'laser'];

// A glossy red "laser dot" used as the laser-pointer tool icon (replaces the
// hand/pointer glyph). Accepts the same style/className the nav passes to icons.
function LaserDot(props) {
    return (
        <svg viewBox="0 0 24 24" fill="none" {...props}>
            <circle cx="12" cy="12" r="9" fill="#ff3b30" opacity="0.25" />
            <circle cx="12" cy="12" r="5.5" fill="#ff3b30" />
            <circle cx="10.3" cy="10.3" r="1.5" fill="#ffffff" opacity="0.85" />
        </svg>
    );
}

// Tool definitions for the magic nav
const NAV_TOOLS = [
    { id: 'select', Icon: MousePointer2, label: 'Select (V)' },
    { id: 'shape', Icon: Square, label: 'Shapes (S)' },
    { id: 'text', Icon: Type, label: 'Text (T)' },
    { id: 'pen', Icon: Pencil, label: 'Pen (P)' },
    { id: 'highlighter', Icon: Highlighter, label: 'Highlighter (H)' },
    { id: 'eraser', Icon: Eraser, label: 'Eraser (E)' },
    { id: 'sticky', Icon: StickyNote, label: 'Sticky Note (N)' },
    { id: 'laser', Icon: LaserDot, label: 'Laser Pointer (L)' },
];

const ITEM_HEIGHT = 46; // Height of each nav item in px

/** Opaque popup anchored next to a toolbar button. `reserve` keeps it on-screen. */
function ToolPopup({ anchorTop, isDark, width = 220, reserve = 260, children }) {
    const top = anchorTop != null
        ? `${Math.max(8, Math.min(anchorTop, window.innerHeight - reserve))}px`
        : '50%';
    return (
        <div
            className={`fixed rounded-xl p-3 z-50 menu-accent-edge ${isDark ? 'popup-solid-dark' : 'popup-solid'}`}
            style={{
                left: 'clamp(58px, 4vw + 2vh, 70px)',
                top,
                width: `${width}px`,
                maxHeight: 'calc(100vh - 16px)',
                overflowY: 'auto',
                scrollbarWidth: 'thin',
            }}
        >
            {children}
        </div>
    );
}

function SliderControl({ label, min, max, value, onChange, isDark }) {
    const labelCls = `text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`;
    return (
        <div>
            <div className={`${labelCls} mb-1`}>{label}</div>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-1.5 accent-purple-500"
            />
            <div className={`${labelCls} mt-1`}>{value}px</div>
        </div>
    );
}

function ShapeGrid({ options, selectedId, isDark, onSelect }) {
    return (
        <div className="grid grid-cols-4 gap-2 mb-3">
            {options.map(opt => (
                <button
                    key={opt.id}
                    onClick={() => onSelect(opt.id)}
                    className={cn(
                        "w-10 h-10 flex items-center justify-center rounded-lg transition-all border-2",
                        selectedId === opt.id
                            ? "bg-purple-100 text-purple-600 border-purple-400"
                            : isDark ? "hover:bg-gray-700 border-transparent text-gray-300" : "hover:bg-gray-100 border-transparent text-gray-700"
                    )}
                    title={opt.label}
                >
                    <opt.Icon className="w-6 h-6" />
                </button>
            ))}
        </div>
    );
}

function Divider({ isDark }) {
    return <div className={`h-px ${isDark ? 'bg-white/15' : 'bg-black/10'}`} style={{ margin: '4px 6px' }} />;
}

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
    const popupRef = useRef(null);

    // Countdown tick — one interval per run, not one per second
    useEffect(() => {
        if (!isRunning) return;
        intervalRef.current = setInterval(() => {
            setTotalSeconds(prev => {
                if (prev <= 1) {
                    setIsRunning(false);
                    setIsFinished(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(intervalRef.current);
    }, [isRunning]);

    // Play a short double "beep" when the countdown reaches zero.
    useEffect(() => {
        if (!isFinished) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const beep = (at, freq) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
                gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + at + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.18);
                osc.start(ctx.currentTime + at);
                osc.stop(ctx.currentTime + at + 0.2);
            };
            beep(0, 880);
            beep(0.25, 880);
            setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, 900);
        } catch { /* audio unavailable — ignore */ }
    }, [isFinished]);

    // Close on outside click — always close, timer keeps counting in background
    useEffect(() => {
        if (!showTimer) return;
        const handleClickOutside = (e) => {
            // The popup is portaled to <body>, so it's outside containerRef — check it too.
            if (containerRef.current?.contains(e.target)) return;
            if (popupRef.current?.contains(e.target)) return;
            setShowTimer(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showTimer]);

    const displayH = Math.floor(totalSeconds / 3600);
    const displayM = Math.floor((totalSeconds % 3600) / 60);
    const displayS = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');

    const handleStart = () => {
        if (isRunning) {
            setIsRunning(false);
            return;
        }
        if (totalSeconds === 0) {
            const total = hours * 3600 + minutes * 60 + seconds;
            if (total <= 0) return;
            setTotalSeconds(total);
        }
        setIsFinished(false);
        setIsRunning(true);
    };

    const handleReset = () => {
        setIsRunning(false);
        setTotalSeconds(0);
        setIsFinished(false);
    };

    const timerActive = isRunning || totalSeconds > 0;

    return (
        <div style={{ padding: '0 4px' }} ref={containerRef}>
            <button
                onClick={() => setShowTimer(v => !v)}
                className={cn(
                    "flex items-center justify-center rounded-lg transition-all relative",
                    showTimer
                        ? "text-white"
                        : isFinished
                            ? "text-red-500 animate-pulse"
                            : timerActive
                                ? "text-green-500"
                                : isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-black/5"
                )}
                style={{ width: '42px', height: '42px' }}
                title="Timer"
            >
                {/* Active indicator — same gradient circle the magic-nav uses */}
                {showTimer && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #7b5ea7, #4a90d9, #2ec4b6)',
                        boxShadow: '0 0 15px rgba(74, 144, 217, 0.4), 0 0 30px rgba(74, 144, 217, 0.15)',
                        zIndex: 0,
                        pointerEvents: 'none',
                    }} />
                )}
                <Timer style={{ width: '18px', height: '18px', position: 'relative', zIndex: 1 }} />
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

            {showTimer && createPortal(
                <div
                    ref={popupRef}
                    className={`fixed rounded-xl p-3 z-[60] menu-accent-edge ${isDark ? 'popup-solid-dark' : 'popup-solid'}`}
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
                            background: isDark ? '#111827' : '#f3f4f6',
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
                </div>,
                document.body
            )}
        </div>
    );
}

export default function Toolbar() {
    const {
        tool, setTool, shapeType, setShapeType,
        strokeColor, setStrokeColor,
        penStrokeWidth, setPenStrokeWidth,
        highlighterStrokeWidth, setHighlighterStrokeWidth,
        laserStrokeWidth, setLaserStrokeWidth,
        highlighterColor, setHighlighterColor,
        nodes, selectedNodeIds, deleteAllNodes, deleteSelectedNodes,
        isSaving, isLoading, lastSaved,
        undo, redo, canUndo, canRedo,
        theme,
        stickyColor, setStickyColor,
        stickyPileMode, setStickyPileMode,
    } = useStore();

    const isDark = theme === 'dark';

    // activePopup: { name, anchorTop } — the button is measured when the popup
    // opens, so render never has to touch refs
    const [activePopup, setActivePopup] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showMediaModal, setShowMediaModal] = useState(false);
    const popupRef = useRef(null);
    const popupBtnRefs = useRef({});

    const openPopup = useCallback((name) => {
        const btn = popupBtnRefs.current[name];
        setActivePopup({ name, anchorTop: btn ? btn.getBoundingClientRect().top : null });
    }, []);

    // Auto-open popups when the tool is set from outside (e.g. keyboard shortcut)
    useEffect(() => {
        return useStore.subscribe((state, prev) => {
            if (state.tool !== prev.tool && POPUP_TOOLS.includes(state.tool)) {
                openPopup(state.tool);
            }
        });
    }, [openPopup]);

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

    const handleToolClick = (toolName, hasPopup) => {
        if (hasPopup && activePopup?.name === toolName) {
            setActivePopup(null);
            return;
        }
        setTool(toolName);
        if (hasPopup) {
            openPopup(toolName);
        } else {
            setActivePopup(null);
        }
    };

    const handleShapeSelect = (shapeId) => {
        setShapeType(shapeId);
        setTool('shape');
        setActivePopup(null);
    };

    const handleStickyPileClick = (color) => {
        setStickyColor(color);
        setTool('sticky');
        setActivePopup(null);
    };

    // Find the active tool index for the indicator
    const activeIndex = NAV_TOOLS.findIndex(t => t.id === tool);
    const iconBtnCls = isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-black/5";

    return (
        <div className="fixed left-0 top-0 bottom-0 z-40 flex items-center" ref={popupRef}>
            <div
                className={`magic-nav rounded-r-2xl border-l-0 flex flex-col my-2 ml-0 menu-accent-edge ${isDark ? 'glass-panel-dark' : 'glass-panel'}`}
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
                <div className="magic-nav-section" style={{ position: 'relative', padding: '0 4px' }}>
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

                    {NAV_TOOLS.map((navTool) => {
                        const isActive = tool === navTool.id;
                        const hasPopup = POPUP_TOOLS.includes(navTool.id);
                        const Icon = navTool.Icon;

                        return (
                            <button
                                key={navTool.id}
                                ref={(el) => { popupBtnRefs.current[navTool.id] = el; }}
                                onClick={() => handleToolClick(navTool.id, hasPopup)}
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
                                {hasPopup && !isActive && (
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

                <Divider isDark={isDark} />

                {/* Timer Widget */}
                <TimerWidget isDark={isDark} />

                <Divider isDark={isDark} />

                {/* Media Upload */}
                <div style={{ padding: '0 4px' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMediaModal(true);
                            setActivePopup(null);
                        }}
                        className={cn("flex items-center justify-center rounded-lg transition-all relative", iconBtnCls)}
                        style={{ width: '42px', height: '42px' }}
                        title="Add Media (YouTube, Images, Audio, Video, PDF)"
                    >
                        <FolderOpen style={{ width: '18px', height: '18px' }} />
                        <ChevronRight className="absolute opacity-40" style={{ width: '8px', height: '8px', right: '2px', bottom: '4px' }} />
                    </button>
                </div>

                <Divider isDark={isDark} />

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
                                ? "text-red-500 hover:bg-red-500/10"
                                : "text-gray-300 cursor-not-allowed"
                        )}
                        style={{ width: '42px', height: '42px' }}
                        title={selectedNodeIds.length > 0 ? `Delete Selected (${selectedNodeIds.length})` : "Clear All"}
                    >
                        <Trash2 style={{ width: '18px', height: '18px' }} />
                    </button>
                </div>

                <Divider isDark={isDark} />

                {/* Undo/Redo */}
                <div style={{ padding: '0 4px' }}>
                    {[
                        { action: undo, enabled: canUndo(), Icon: Undo2, label: 'Undo (Ctrl+Z)' },
                        { action: redo, enabled: canRedo(), Icon: Redo2, label: 'Redo (Ctrl+Y)' },
                    ].map(item => (
                        <button
                            key={item.label}
                            onClick={item.action}
                            disabled={!item.enabled}
                            className={cn(
                                "flex items-center justify-center rounded-lg transition-colors",
                                item.enabled
                                    ? isDark ? "text-gray-400 hover:text-gray-200 hover:bg-white/10" : "text-gray-500 hover:text-gray-800 hover:bg-black/5"
                                    : "text-gray-300 cursor-not-allowed"
                            )}
                            style={{ width: '42px', height: '42px' }}
                            title={item.label}
                        >
                            <item.Icon style={{ width: '18px', height: '18px' }} />
                        </button>
                    ))}
                </div>

                <Divider isDark={isDark} />

                {/* Status indicator */}
                <div
                    className="flex items-center justify-center"
                    style={{ width: '42px', height: '42px', margin: '0 4px' }}
                    title={isLoading ? "Loading..." : isSaving ? "Saving..." : lastSaved ? "Saved" : "Local"}
                >
                    <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        isLoading ? "bg-blue-500 animate-pulse"
                            : isSaving ? "bg-yellow-500 animate-pulse"
                                : lastSaved ? "bg-green-500" : "bg-gray-400"
                    )} />
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={showConfirm}
                message="Are you sure you want to delete all items?"
                onConfirm={() => { deleteAllNodes(); setShowConfirm(false); }}
                onCancel={() => setShowConfirm(false)}
            />

            {/* Unified Media Modal */}
            {showMediaModal && (
                <UnifiedMediaModal onClose={() => setShowMediaModal(false)} />
            )}

            {/* Sticky Note Pile Popup */}
            {activePopup?.name === 'sticky' && (
                <ToolPopup anchorTop={activePopup.anchorTop} isDark={isDark} reserve={320}>
                    <div className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Sticky Notes</div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-gray-400">Click color, then click canvas to place</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <button
                            onClick={() => setStickyPileMode(!stickyPileMode)}
                            className={`px-2 py-1 text-[10px] rounded-lg border transition-colors ${stickyPileMode ? 'bg-purple-500 text-white border-purple-500' : isDark ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-50 text-gray-600 border-gray-300'}`}
                        >
                            {stickyPileMode ? '📚 Pile ON' : '📝 Single'}
                        </button>
                        <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: stickyColor }} title="Selected color" />
                    </div>

                    {/* Visual pile of 25 sticky notes */}
                    <div className="relative mb-3" style={{ height: '120px' }}>
                        {STICKY_ROTATIONS.map((rotation, i) => {
                            const color = STICKY_COLORS[i % STICKY_COLORS.length];
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
                                        left: `${(i % 5) * 38}px`,
                                        top: `${Math.floor(i / 5) * 22}px`,
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
                </ToolPopup>
            )}

            {/* Shape Popup */}
            {activePopup?.name === 'shape' && (
                <ToolPopup anchorTop={activePopup.anchorTop} isDark={isDark} width={240} reserve={500}>
                    <div className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Shapes</div>
                    <ShapeGrid options={shapeOptions} selectedId={shapeType} isDark={isDark} onSelect={handleShapeSelect} />

                    <div className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Lines</div>
                    <ShapeGrid options={lineOptions} selectedId={shapeType} isDark={isDark} onSelect={handleShapeSelect} />
                </ToolPopup>
            )}

            {/* Pen Popup */}
            {activePopup?.name === 'pen' && (
                <ToolPopup anchorTop={activePopup.anchorTop} isDark={isDark} reserve={380}>
                    <ColorPalette selectedColor={strokeColor} onColorSelect={setStrokeColor} title="Pen Color" showEyedropper={false} />
                    <div className={`h-px my-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                    <SliderControl label="Pen Width" min={1} max={20} value={penStrokeWidth} onChange={setPenStrokeWidth} isDark={isDark} />
                </ToolPopup>
            )}

            {/* Highlighter Popup */}
            {activePopup?.name === 'highlighter' && (
                <ToolPopup anchorTop={activePopup.anchorTop} isDark={isDark} reserve={380}>
                    <ColorPalette selectedColor={highlighterColor} onColorSelect={setHighlighterColor} title="Highlighter Color" showEyedropper={false} />
                    <div className={`h-px my-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                    <SliderControl label="Highlighter Width" min={2} max={50} value={highlighterStrokeWidth} onChange={setHighlighterStrokeWidth} isDark={isDark} />
                </ToolPopup>
            )}

            {/* Laser Pointer Popup */}
            {activePopup?.name === 'laser' && (
                <ToolPopup anchorTop={activePopup.anchorTop} isDark={isDark} reserve={120}>
                    <SliderControl label="Laser Thickness" min={1} max={20} value={laserStrokeWidth} onChange={setLaserStrokeWidth} isDark={isDark} />
                </ToolPopup>
            )}
        </div>
    );
}
