import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Pencil, Type, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Minus, Plus } from 'lucide-react';
import useStore from '../../store/useStore';

const colors = [
    '#000000', '#ffffff', '#6b7280', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#a855f7', '#ec4899',
];

const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72];

export default function PropertiesPanel() {
    const [collapsed, setCollapsed] = useState(false);
    const {
        tool,
        selectedNodeIds,
        nodes,
        fillColor,
        strokeColor,
        strokeWidth,
        setFillColor,
        setStrokeColor,
        setStrokeWidth,
        updateNode,
    } = useStore();

    // Auto-expand when pen or text tool is active
    useEffect(() => {
        if (tool === 'pen' || tool === 'text' || tool === 'highlighter' || selectedNodeIds.length > 0) {
            setCollapsed(false);
        }
    }, [tool, selectedNodeIds]);

    const selectedNode = selectedNodeIds.length === 1
        ? nodes.find((n) => n.id === selectedNodeIds[0])
        : null;

    const isTextNode = selectedNode?.type === 'text';

    const handleFill = (c) => {
        setFillColor(c);
        if (selectedNode) updateNode(selectedNode.id, { fill: c });
    };

    const handleStroke = (c) => {
        setStrokeColor(c);
        if (selectedNode) updateNode(selectedNode.id, { stroke: c });
    };

    // Text-specific handlers
    const handleFontSize = (size) => {
        if (selectedNode && isTextNode) {
            updateNode(selectedNode.id, { fontSize: size });
        }
    };

    const toggleBold = () => {
        if (selectedNode && isTextNode) {
            const style = selectedNode.fontStyle || 'normal';
            const newStyle = style.includes('bold')
                ? style.replace('bold', '').trim() || 'normal'
                : `bold ${style === 'normal' ? '' : style}`.trim();
            updateNode(selectedNode.id, { fontStyle: newStyle });
        }
    };

    const toggleItalic = () => {
        if (selectedNode && isTextNode) {
            const style = selectedNode.fontStyle || 'normal';
            const newStyle = style.includes('italic')
                ? style.replace('italic', '').trim() || 'normal'
                : `${style === 'normal' ? '' : style} italic`.trim();
            updateNode(selectedNode.id, { fontStyle: newStyle });
        }
    };

    const handleAlign = (align) => {
        if (selectedNode && isTextNode) {
            updateNode(selectedNode.id, { align: align });
        }
    };

    const isDrawingTool = tool === 'pen' || tool === 'text' || tool === 'highlighter';
    const currentFontSize = selectedNode?.fontSize || 24;
    const currentStyle = selectedNode?.fontStyle || 'normal';
    const isBold = currentStyle.includes('bold');
    const isItalic = currentStyle.includes('italic');
    const currentAlign = selectedNode?.align || 'left';

    return (
        <div className="fixed right-3 top-16 z-40">
            <div className="bg-white border border-gray-200 rounded-xl shadow-lg w-48 overflow-hidden">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 text-gray-800"
                >
                    <div className="flex items-center gap-2">
                        {isDrawingTool && (
                            tool === 'pen'
                                ? <Pencil className="w-4 h-4 text-cyan-500" />
                                : <Type className="w-4 h-4 text-cyan-500" />
                        )}
                        <span className="text-xs font-medium">Properties</span>
                    </div>
                    {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>

                {!collapsed && (
                    <div className="px-3 pb-3 border-t border-gray-100">
                        {/* Text-specific controls */}
                        {isTextNode && (
                            <div className="pt-2 pb-2 border-b border-gray-100 mb-2">
                                <label className="text-xs text-gray-500 block mb-2">Text</label>

                                {/* Font Size */}
                                <div className="flex items-center gap-2 mb-2">
                                    <button
                                        onClick={() => handleFontSize(Math.max(8, currentFontSize - 2))}
                                        className="p-1 hover:bg-gray-100 rounded"
                                    >
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <select
                                        value={currentFontSize}
                                        onChange={(e) => handleFontSize(Number(e.target.value))}
                                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white text-center"
                                    >
                                        {fontSizes.map(size => (
                                            <option key={size} value={size}>{size}px</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => handleFontSize(Math.min(200, currentFontSize + 2))}
                                        className="p-1 hover:bg-gray-100 rounded"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Bold, Italic, Alignment */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={toggleBold}
                                        className={`p-1.5 rounded transition-colors ${isBold ? 'bg-cyan-100 text-cyan-700' : 'hover:bg-gray-100'}`}
                                        title="Bold"
                                    >
                                        <Bold className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={toggleItalic}
                                        className={`p-1.5 rounded transition-colors ${isItalic ? 'bg-cyan-100 text-cyan-700' : 'hover:bg-gray-100'}`}
                                        title="Italic"
                                    >
                                        <Italic className="w-4 h-4" />
                                    </button>
                                    <div className="w-px h-5 bg-gray-200 mx-1" />
                                    <button
                                        onClick={() => handleAlign('left')}
                                        className={`p-1.5 rounded transition-colors ${currentAlign === 'left' ? 'bg-cyan-100 text-cyan-700' : 'hover:bg-gray-100'}`}
                                        title="Align Left"
                                    >
                                        <AlignLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleAlign('center')}
                                        className={`p-1.5 rounded transition-colors ${currentAlign === 'center' ? 'bg-cyan-100 text-cyan-700' : 'hover:bg-gray-100'}`}
                                        title="Align Center"
                                    >
                                        <AlignCenter className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleAlign('right')}
                                        className={`p-1.5 rounded transition-colors ${currentAlign === 'right' ? 'bg-cyan-100 text-cyan-700' : 'hover:bg-gray-100'}`}
                                        title="Align Right"
                                    >
                                        <AlignRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Color: Fill */}
                        <div className="pt-2 mb-3">
                            <label className="text-xs text-gray-500 block mb-1.5">
                                {isTextNode ? 'Text Color' : 'Fill'}
                            </label>
                            <div className="flex flex-wrap gap-1">
                                {colors.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => handleFill(c)}
                                        className="w-5 h-5 rounded-md border-2 hover:scale-110 transition-transform"
                                        style={{
                                            backgroundColor: c,
                                            borderColor: (selectedNode?.fill || fillColor) === c ? '#0ea5e9' : '#e5e7eb',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Stroke - hide for text */}
                        {!isTextNode && (
                            <>
                                <div className="mb-3">
                                    <label className="text-xs text-gray-500 block mb-1.5">Stroke</label>
                                    <div className="flex flex-wrap gap-1">
                                        {colors.map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => handleStroke(c)}
                                                className="w-5 h-5 rounded-md border-2 hover:scale-110 transition-transform"
                                                style={{
                                                    backgroundColor: c,
                                                    borderColor: strokeColor === c ? '#0ea5e9' : '#e5e7eb',
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500">Width: {strokeWidth}px</label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="20"
                                        value={strokeWidth}
                                        onChange={(e) => setStrokeWidth(Number(e.target.value))}
                                        className="w-full h-1.5 accent-cyan-500 mt-1"
                                    />
                                </div>
                            </>
                        )}

                        {selectedNodeIds.length > 0 && (
                            <div className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
                                {selectedNodeIds.length} selected
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
