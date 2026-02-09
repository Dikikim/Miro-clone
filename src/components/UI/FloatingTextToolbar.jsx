import { useState, useEffect, useRef } from 'react';
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, List, Link, Lock, MoreHorizontal, Minus, Plus, ChevronDown } from 'lucide-react';
import useStore from '../../store/useStore';

const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];
const colors = [
    '#000000', '#374151', '#6b7280', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff',
];

export default function FloatingTextToolbar({ nodeId, position }) {
    const { nodes, updateNode } = useStore();
    const [showFontSizes, setShowFontSizes] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const toolbarRef = useRef(null);

    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'text') return null;

    const currentFontSize = node.fontSize || 24;
    const currentStyle = node.fontStyle || 'normal';
    const isBold = currentStyle.includes('bold');
    const isItalic = currentStyle.includes('italic');
    const currentAlign = node.align || 'left';
    const currentColor = node.fill || '#000000';

    const toggleBold = () => {
        const newStyle = isBold
            ? currentStyle.replace('bold', '').trim() || 'normal'
            : `bold ${currentStyle === 'normal' ? '' : currentStyle}`.trim();
        updateNode(nodeId, { fontStyle: newStyle });
    };

    const toggleItalic = () => {
        const newStyle = isItalic
            ? currentStyle.replace('italic', '').trim() || 'normal'
            : `${currentStyle === 'normal' ? '' : currentStyle} italic`.trim();
        updateNode(nodeId, { fontStyle: newStyle });
    };

    const handleFontSize = (size) => {
        updateNode(nodeId, { fontSize: size });
        setShowFontSizes(false);
    };

    const handleAlign = (align) => {
        updateNode(nodeId, { align });
    };

    const handleColor = (color) => {
        updateNode(nodeId, { fill: color });
        setShowColorPicker(false);
    };

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
                setShowFontSizes(false);
                setShowColorPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div
            ref={toolbarRef}
            className="fixed z-50 flex items-center gap-0.5 bg-white rounded-lg shadow-xl border border-gray-200 px-1 py-1"
            style={{
                left: position.x,
                top: position.y - 50,
                transform: 'translateX(-50%)',
            }}
        >
            {/* Font Type */}
            <button className="px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-1">
                <span className="text-purple-600 font-semibold">T</span>
                <span>Noto Sans</span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            <div className="w-px h-5 bg-gray-200 mx-0.5" />

            {/* Font Size */}
            <div className="relative">
                <button
                    onClick={() => setShowFontSizes(!showFontSizes)}
                    className="px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-1 min-w-[50px]"
                >
                    {currentFontSize}
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
                {showFontSizes && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[80px] max-h-48 overflow-auto">
                        {fontSizes.map(size => (
                            <button
                                key={size}
                                onClick={() => handleFontSize(size)}
                                className={`w-full px-3 py-1 text-sm text-left hover:bg-gray-100 ${size === currentFontSize ? 'bg-purple-50 text-purple-600' : ''}`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="w-px h-5 bg-gray-200 mx-0.5" />

            {/* Bold */}
            <button
                onClick={toggleBold}
                className={`p-1.5 rounded transition-colors ${isBold ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-600'}`}
                title="Bold (Ctrl+B)"
            >
                <Bold className="w-4 h-4" />
            </button>

            {/* Italic */}
            <button
                onClick={toggleItalic}
                className={`p-1.5 rounded transition-colors ${isItalic ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-600'}`}
                title="Italic (Ctrl+I)"
            >
                <Italic className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-gray-200 mx-0.5" />

            {/* Alignment */}
            <button
                onClick={() => handleAlign('left')}
                className={`p-1.5 rounded transition-colors ${currentAlign === 'left' ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-600'}`}
                title="Align Left"
            >
                <AlignLeft className="w-4 h-4" />
            </button>
            <button
                onClick={() => handleAlign('center')}
                className={`p-1.5 rounded transition-colors ${currentAlign === 'center' ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-600'}`}
                title="Align Center"
            >
                <AlignCenter className="w-4 h-4" />
            </button>
            <button
                onClick={() => handleAlign('right')}
                className={`p-1.5 rounded transition-colors ${currentAlign === 'right' ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-600'}`}
                title="Align Right"
            >
                <AlignRight className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-gray-200 mx-0.5" />

            {/* List */}
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Bullet List">
                <List className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-gray-200 mx-0.5" />

            {/* Text Color */}
            <div className="relative">
                <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="p-1.5 rounded hover:bg-gray-100 flex items-center gap-0.5"
                    title="Text Color"
                >
                    <span className="text-lg font-bold" style={{ color: currentColor }}>A</span>
                    <div className="w-4 h-1 rounded" style={{ backgroundColor: currentColor }} />
                </button>
                {showColorPicker && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-2 w-40">
                        <div className="text-xs text-gray-500 mb-2">Text Color</div>
                        <div className="grid grid-cols-6 gap-1">
                            {colors.map(color => (
                                <button
                                    key={color}
                                    onClick={() => handleColor(color)}
                                    className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Highlight */}
            <button className="p-1.5 rounded hover:bg-gray-100" title="Highlight">
                <div className="w-4 h-4 bg-yellow-300 rounded-sm flex items-center justify-center text-xs font-bold">A</div>
            </button>

            <div className="w-px h-5 bg-gray-200 mx-0.5" />

            {/* Link */}
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Add Link">
                <Link className="w-4 h-4" />
            </button>

            {/* Lock */}
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Lock">
                <Lock className="w-4 h-4" />
            </button>

            {/* More */}
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="More Options">
                <MoreHorizontal className="w-4 h-4" />
            </button>
        </div>
    );
}
