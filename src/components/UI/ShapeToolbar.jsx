import { useState, useRef } from 'react';
import { ArrowUpToLine, ArrowDownToLine, Copy, Replace, ChevronDown, Minus, Plus } from 'lucide-react';
import useStore from '../../store/useStore';
import ColorPalette from './ColorPalette';

const SHAPE_TYPES = [
    { id: 'rectangle', label: 'Rectangle' },
    { id: 'roundedRect', label: 'Rounded Rect' },
    { id: 'circle', label: 'Circle' },
    { id: 'ellipse', label: 'Ellipse' },
    { id: 'triangle', label: 'Triangle' },
    { id: 'diamond', label: 'Diamond' },
    { id: 'pentagon', label: 'Pentagon' },
    { id: 'hexagon', label: 'Hexagon' },
    { id: 'octagon', label: 'Octagon' },
    { id: 'star', label: 'Star' },
    { id: 'heart', label: 'Heart' },
    { id: 'cloud', label: 'Cloud' },
    { id: 'cross', label: 'Cross' },
    { id: 'rhombus', label: 'Rhombus' },
    { id: 'parallelogram', label: 'Parallelogram' },
    { id: 'trapezoid', label: 'Trapezoid' },
    { id: 'rightTriangle', label: 'Right Triangle' },
];

// Line/arrow variants the swap menu offers. These map onto two stored node
// types: 'arrow' (with optional doubleArrow) and 'simpleLine' (with optional dash).
const LINE_TYPES = [
    { id: 'line', label: 'Line' },
    { id: 'arrow', label: 'Arrow' },
    { id: 'doubleArrow', label: 'Double Arrow' },
    { id: 'dashedLine', label: 'Dashed Line' },
    { id: 'dottedLine', label: 'Dotted Line' },
];

// Collapse a stored line node back to its swap-menu id so the active option
// can be highlighted.
function getLineSubtype(node) {
    if (node.type === 'arrow') return node.doubleArrow ? 'doubleArrow' : 'arrow';
    if (Array.isArray(node.dash) && node.dash.length) return node.dash[0] >= 10 ? 'dashedLine' : 'dottedLine';
    return 'line';
}

// Extract a "size" from any node, regardless of its dimension storage scheme
function getNodeSize(node) {
    if (node.size) return node.size;
    if (node.radius) return node.radius * 2;
    if (node.outerRadius) return node.outerRadius * 2;
    if (node.radiusX && node.radiusY) return Math.max(node.radiusX, node.radiusY) * 2;
    if (node.width && node.height) return Math.max(node.width, node.height);
    return 100;
}

function getNodeWidth(node) {
    if (node.width) return node.width;
    if (node.radiusX) return node.radiusX * 2;
    if (node.radius) return node.radius * 2;
    if (node.size) return node.size;
    return 100;
}

function getNodeHeight(node) {
    if (node.height) return node.height;
    if (node.radiusY) return node.radiusY * 2;
    if (node.radius) return node.radius * 2;
    if (node.size) return node.size;
    return 100;
}

export default function ShapeToolbar({ nodeId, position }) {
    const { nodes, updateNode, bringToFront, sendToBack, duplicateNode, theme } = useStore();
    const [showFillPicker, setShowFillPicker] = useState(false);
    const [showStrokePicker, setShowStrokePicker] = useState(false);
    const [showSwap, setShowSwap] = useState(false);
    const [swInputVal, setSwInputVal] = useState('');
    const [crInputVal, setCrInputVal] = useState('');
    const [swFocused, setSwFocused] = useState(false);
    const [crFocused, setCrFocused] = useState(false);
    const toolbarRef = useRef(null);
    const isDark = theme === 'dark';

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const shapeTypes = ['rectangle', 'roundedRect', 'circle', 'ellipse', 'triangle', 'diamond',
        'pentagon', 'hexagon', 'octagon', 'star', 'heart', 'cloud', 'cross', 'rhombus', 'frame',
        'parallelogram', 'trapezoid', 'rightTriangle', 'arrow', 'simpleLine'];
    if (!shapeTypes.includes(node.type)) return null;
    // The newer shapes use the same floating menu but without Stroke-Width /
    // Corner-Radius. Lines & arrows get it too, but only the controls that make
    // sense for them: stroke colour, opacity, layering, duplicate (no fill,
    // stroke-width, corner-radius or shape-swap).
    const isBasicShape = ['parallelogram', 'trapezoid', 'rightTriangle'].includes(node.type);
    const isLine = ['arrow', 'simpleLine'].includes(node.type);

    const handleFill = (color) => { updateNode(nodeId, { fill: color }); };
    const handleStroke = (color) => { updateNode(nodeId, { stroke: color }); };
    const handleOpacity = (val) => { updateNode(nodeId, { opacity: Math.max(0.05, Math.min(1, val)) }); };
    const handleStrokeWidth = (val) => { updateNode(nodeId, { strokeWidth: Math.max(0, Math.min(20, val)) }); };
    const handleCornerRadius = (val) => { updateNode(nodeId, { cornerRadius: Math.max(0, Math.min(50, val)) }); };

    const handleSwap = (newType) => {
        const sz = getNodeSize(node);
        const w = getNodeWidth(node);
        const h = getNodeHeight(node);
        const updates = { type: newType };

        // Center-positioned shapes that use radius
        if (['circle', 'triangle', 'pentagon', 'hexagon', 'octagon'].includes(newType)) {
            updates.radius = sz / 2;
            // Clean up other dimension props
            delete updates.width; delete updates.height;
            delete updates.size; delete updates.radiusX; delete updates.radiusY;
            updates.width = undefined; updates.height = undefined;
            updates.size = undefined; updates.radiusX = undefined; updates.radiusY = undefined;
        }
        // Star — needs inner/outer radii
        else if (newType === 'star') {
            updates.outerRadius = sz / 2;
            updates.innerRadius = sz / 4;
            updates.numPoints = 5;
            updates.radius = undefined; updates.width = undefined; updates.height = undefined; updates.size = undefined;
        }
        // Ellipse
        else if (newType === 'ellipse') {
            updates.radiusX = w / 2;
            updates.radiusY = h / 2;
            updates.radius = undefined; updates.width = undefined; updates.height = undefined; updates.size = undefined;
        }
        // Size-based shapes (cross)
        else if (newType === 'cross') {
            updates.size = sz;
            updates.radius = undefined; updates.width = undefined; updates.height = undefined;
        }
        // Width/height shapes (rectangle, roundedRect, diamond, rhombus, cloud, heart, frame)
        else {
            updates.width = w;
            updates.height = h;
            updates.radius = undefined; updates.size = undefined; updates.radiusX = undefined; updates.radiusY = undefined;
        }

        updateNode(nodeId, updates);
        setShowSwap(false);
    };

    // Swap between line/arrow variants while preserving geometry (points) and colour.
    const handleLineSwap = (newType) => {
        const updates = {};
        if (newType === 'arrow' || newType === 'doubleArrow') {
            updates.type = 'arrow';
            updates.doubleArrow = newType === 'doubleArrow';
            updates.pointerLength = node.pointerLength || 15;
            updates.pointerWidth = node.pointerWidth || 15;
            updates.fill = node.fill || node.stroke || '#000000'; // arrowhead colour
            updates.dash = undefined;
        } else {
            updates.type = 'simpleLine';
            updates.doubleArrow = undefined;
            updates.dash = newType === 'dashedLine' ? [12, 8]
                : newType === 'dottedLine' ? [2, 10]
                    : undefined;
        }
        updateNode(nodeId, updates);
        setShowSwap(false);
    };

    const lineSubtype = isLine ? getLineSubtype(node) : null;

    const opacity = node.opacity ?? 1;
    const currentFill = node.fill || '#3b82f6';
    const currentStroke = node.stroke || '#1e40af';
    const strokeWidth = node.strokeWidth ?? 2;
    const cornerRadius = node.cornerRadius ?? 4;

    const toolbarStyle = {
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y - 52}px`,
        transform: 'translateX(-50%)',
        zIndex: 150,
    };

    const btnClass = `p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`;

    return (
        <div ref={toolbarRef} style={toolbarStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div className={`relative flex items-center gap-0.5 px-1.5 py-1 rounded-xl shadow-lg border ${isDark ? 'bg-gray-800 border-transparent menu-accent-edge' : 'bg-white border-gray-200'}`}>

                {/* Fill Color (not for lines) */}
                {!isLine && (
                    <div className="relative">
                        <button
                            onClick={() => { setShowFillPicker(!showFillPicker); setShowStrokePicker(false); setShowSwap(false); }}
                            className={btnClass}
                            title="Fill Color"
                        >
                            <div className="w-5 h-5 rounded border border-gray-300" style={{ backgroundColor: currentFill }} />
                        </button>
                        {showFillPicker && (
                            <div className="absolute top-full left-0 mt-1 z-[160] bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-[220px]">
                                <ColorPalette
                                    selectedColor={currentFill}
                                    onColorSelect={(c) => { handleFill(c); setShowFillPicker(false); }}
                                    context="shapeFill"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Stroke Color */}
                <div className="relative">
                    <button
                        onClick={() => { setShowStrokePicker(!showStrokePicker); setShowFillPicker(false); setShowSwap(false); }}
                        className={btnClass}
                        title="Stroke Color"
                    >
                        <div className="w-5 h-5 rounded border-2" style={{ borderColor: currentStroke, backgroundColor: 'transparent' }} />
                    </button>
                    {showStrokePicker && (
                        <div className="absolute top-full left-0 mt-1 z-[160] bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-[220px]">
                            <ColorPalette
                                selectedColor={currentStroke}
                                onColorSelect={(c) => { handleStroke(c); setShowStrokePicker(false); }}
                                context="shapeStroke"
                            />
                        </div>
                    )}
                </div>

                {!isBasicShape && !isLine && (
                    <>
                        <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                        {/* Stroke Width */}
                        <div className="flex items-center gap-1 px-1" title="Stroke Width">
                            <span className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>SW</span>
                            <button onClick={() => handleStrokeWidth(strokeWidth - 1)} className={btnClass}><Minus className="w-3 h-3" /></button>
                            <input
                                type="number"
                                min="0"
                                max="20"
                                value={swFocused ? swInputVal : strokeWidth}
                                onChange={(e) => {
                                    setSwInputVal(e.target.value);
                                    const v = parseInt(e.target.value, 10);
                                    if (!isNaN(v)) handleStrokeWidth(v);
                                }}
                                onFocus={() => { setSwFocused(true); setSwInputVal(String(strokeWidth)); }}
                                onBlur={() => { setSwFocused(false); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={`w-[36px] text-[10px] font-mono text-center border rounded px-0.5 py-0.5 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'} focus:outline-none focus:ring-1 focus:ring-purple-400`}
                            />
                            <button onClick={() => handleStrokeWidth(strokeWidth + 1)} className={btnClass}><Plus className="w-3 h-3" /></button>
                        </div>
                    </>
                )}

                {/* Corner Radius (only for rect-like shapes) */}
                {['rectangle', 'roundedRect', 'rhombus'].includes(node.type) && (
                    <>
                        <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                        <div className="flex items-center gap-1 px-1" title="Corner Radius">
                            <span className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>CR</span>
                            <button onClick={() => handleCornerRadius(cornerRadius - 2)} className={btnClass}><Minus className="w-3 h-3" /></button>
                            <input
                                type="number"
                                min="0"
                                max="50"
                                value={crFocused ? crInputVal : cornerRadius}
                                onChange={(e) => {
                                    setCrInputVal(e.target.value);
                                    const v = parseInt(e.target.value, 10);
                                    if (!isNaN(v)) handleCornerRadius(v);
                                }}
                                onFocus={() => { setCrFocused(true); setCrInputVal(String(cornerRadius)); }}
                                onBlur={() => { setCrFocused(false); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={`w-[36px] text-[10px] font-mono text-center border rounded px-0.5 py-0.5 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'} focus:outline-none focus:ring-1 focus:ring-purple-400`}
                            />
                            <button onClick={() => handleCornerRadius(cornerRadius + 2)} className={btnClass}><Plus className="w-3 h-3" /></button>
                        </div>
                    </>
                )}

                {/* Swap — shapes morph into other shapes, lines into other line styles */}
                <>
                    <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                    <div className="relative">
                        <button
                            onClick={() => { setShowSwap(!showSwap); setShowFillPicker(false); setShowStrokePicker(false); }}
                            className={`${btnClass} flex items-center gap-0.5`}
                            title={isLine ? 'Swap Line' : 'Swap Shape'}
                        >
                            <Replace className="w-4 h-4" />
                            <ChevronDown className="w-3 h-3 opacity-50" />
                        </button>
                        {showSwap && (
                            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 rounded-xl shadow-xl border py-1 min-w-[130px] max-h-52 overflow-auto z-[160] ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                {(isLine ? LINE_TYPES : SHAPE_TYPES).map(s => {
                                    const active = isLine ? lineSubtype === s.id : node.type === s.id;
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => (isLine ? handleLineSwap(s.id) : handleSwap(s.id))}
                                            className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${active ? 'bg-purple-50 text-purple-600 font-medium' : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'}`}
                                        >
                                            {s.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>

                <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                {/* Opacity */}
                <div className="flex items-center gap-1 px-1">
                    <button onClick={() => handleOpacity(opacity - 0.1)} className={btnClass} title="Decrease Opacity">
                        <Minus className="w-3 h-3" />
                    </button>
                    <span className={`text-[10px] font-mono min-w-[28px] text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {Math.round(opacity * 100)}%
                    </span>
                    <button onClick={() => handleOpacity(opacity + 0.1)} className={btnClass} title="Increase Opacity">
                        <Plus className="w-3 h-3" />
                    </button>
                </div>

                <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                {/* Layering */}
                <button onClick={() => bringToFront(nodeId)} className={btnClass} title="Bring to Front">
                    <ArrowUpToLine className="w-4 h-4" />
                </button>
                <button onClick={() => sendToBack(nodeId)} className={btnClass} title="Send to Back">
                    <ArrowDownToLine className="w-4 h-4" />
                </button>

                <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                {/* Duplicate */}
                <button onClick={() => duplicateNode(nodeId)} className={btnClass} title="Duplicate">
                    <Copy className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
