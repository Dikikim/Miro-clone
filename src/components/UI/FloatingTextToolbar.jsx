import { useState, useEffect, useRef } from 'react';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    ChevronDown, ChevronUp, List, ListOrdered, Minus, Plus
} from 'lucide-react';
import useStore from '../../store/useStore';
import ColorPalette from './ColorPalette';

const FONT_LIST = [
    'Arial', 'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
    'Raleway', 'Nunito', 'Playfair Display', 'Merriweather', 'Source Code Pro',
    'Fira Code', 'PT Sans', 'Oswald', 'Quicksand', 'Comfortaa', 'Cabin',
    'Ubuntu', 'Karla', 'Work Sans', 'DM Sans', 'Outfit', 'Space Grotesk',
    'Caveat', 'Pacifico',
];

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96, 128];

// Helper: add list prefixes to raw text
function addListPrefixes(text, listType) {
    if (!listType || !text) return text;
    const lines = text.split('\n');
    return lines.map((line, i) => {
        const stripped = line.replace(/^(•\s|\d+\.\s)/, '');
        if (listType === 'bullet') return `• ${stripped}`;
        if (listType === 'number') return `${i + 1}. ${stripped}`;
        return stripped;
    }).join('\n');
}

// Helper: strip list prefixes from text
function stripListPrefixes(text) {
    if (!text) return text;
    return text.split('\n').map(line =>
        line.replace(/^(•\s|\d+\.\s)/, '')
    ).join('\n');
}

export default function FloatingTextToolbar({ nodeId, position }) {
    const { nodes, updateNode, setTextFontSize, setTextFontFamily } = useStore();

    const [showFontFamilies, setShowFontFamilies] = useState(false);
    const [showFontSizes, setShowFontSizes] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [fontSizeInput, setFontSizeInput] = useState('');
    const [fontSizeInputFocused, setFontSizeInputFocused] = useState(false);

    const toolbarRef = useRef(null);

    const node = nodes.find(n => n.id === nodeId);
    if (!node || (node.type !== 'text' && node.type !== 'sticky')) return null;

    const isSticky = node.type === 'sticky';
    const currentFontFamily = node.fontFamily || 'Arial';
    const currentFontSize = node.fontSize || 24;
    const fontStyle = node.fontStyle || 'normal';
    const isBold = fontStyle.includes('bold');
    const isItalic = fontStyle.includes('italic');
    const isUnderline = node.textDecoration === 'underline';
    const isStrike = node.textDecoration === 'line-through';
    const currentColor = isSticky ? (node.textColor || '#1a1a1a') : (node.fill || '#000000');
    const listType = node.listType || null;

    const closeAll = () => {
        setShowFontFamilies(false);
        setShowFontSizes(false);
        setShowColorPicker(false);
        setShowMoreOptions(false);
    };

    const toggleBold = () => {
        const newStyle = isBold
            ? (isItalic ? 'italic' : 'normal')
            : (isItalic ? 'bold italic' : 'bold');
        updateNode(nodeId, { fontStyle: newStyle });
    };

    const toggleItalic = () => {
        const newStyle = isItalic
            ? (isBold ? 'bold' : 'normal')
            : (isBold ? 'bold italic' : 'italic');
        updateNode(nodeId, { fontStyle: newStyle });
    };

    const toggleUnderline = () => {
        updateNode(nodeId, { textDecoration: isUnderline ? 'none' : 'underline' });
    };

    const toggleStrike = () => {
        updateNode(nodeId, { textDecoration: isStrike ? 'none' : 'line-through' });
    };

    const handleTextColorChange = (color) => {
        if (isSticky) {
            updateNode(nodeId, { textColor: color });
        } else {
            updateNode(nodeId, { fill: color });
        }
        setShowColorPicker(false);
    };

    const handleListType = (type) => {
        // Read from the active textarea if editing, because node.text may be stale
        const activeTextarea = document.querySelector('textarea[data-text-editor="true"]');
        const currentText = activeTextarea ? activeTextarea.value : (node.text || '');
        const stripped = stripListPrefixes(currentText);

        if (listType === type) {
            updateNode(nodeId, { listType: null, text: stripped });
        } else {
            const prefixed = addListPrefixes(stripped, type);
            updateNode(nodeId, { listType: type, text: prefixed });
        }
        setShowMoreOptions(false);
    };

    const handleFontSizeInputCommit = () => {
        const val = parseInt(fontSizeInput, 10);
        if (!isNaN(val) && val >= 4 && val <= 200) {
            updateNode(nodeId, { fontSize: val });
            setTextFontSize(val);
        }
        setFontSizeInputFocused(false);
    };

    // Close dropdowns on outside click
    useEffect(() => {
        const handleOutside = (e) => {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
                closeAll();
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const left = position.x;
    const top = Math.max(60, position.y - 54);

    const sepCls = 'w-px h-5 bg-gray-200 mx-0.5 flex-shrink-0';
    const btnBase = 'p-1.5 rounded transition-colors flex-shrink-0 flex items-center justify-center';
    const btnIdle = 'hover:bg-gray-100 text-gray-600';
    const btnActive = 'bg-purple-100 text-purple-600';

    return (
        <div
            ref={toolbarRef}
            data-floating-toolbar="true"
            className="fixed z-[1100] flex items-center gap-0.5 bg-white rounded-xl shadow-2xl border border-gray-200 px-2 py-1.5"
            style={{
                left,
                top,
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                overflow: 'visible',
            }}
            onMouseDown={e => {
                e.stopPropagation();
                e.preventDefault();
            }}
        >
            {/* ── Font Family ── */}
            <div className="relative flex-shrink-0">
                <button
                    tabIndex={-1}
                    onClick={() => { setShowFontFamilies(v => !v); setShowFontSizes(false); setShowColorPicker(false); setShowMoreOptions(false); }}
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-sm text-black max-w-[110px]"
                >
                    <span className="truncate" style={{ fontFamily: `'${currentFontFamily}', sans-serif` }}>
                        {currentFontFamily}
                    </span>
                    <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                </button>
                {showFontFamilies && (
                    <div
                        className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-44 z-[160]"
                        style={{ maxHeight: '240px', overflowY: 'auto', overflowX: 'hidden', whiteSpace: 'normal' }}
                        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                    >
                        {FONT_LIST.map(font => (
                            <button
                                key={font}
                                tabIndex={-1}
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                onClick={() => { updateNode(nodeId, { fontFamily: font }); setTextFontFamily(font); setShowFontFamilies(false); }}
                                className={`w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${currentFontFamily === font ? 'bg-purple-50 text-purple-600 font-medium' : 'text-black'}`}
                                style={{ fontFamily: `'${font}', sans-serif`, display: 'block', whiteSpace: 'nowrap' }}
                            >
                                {font}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className={sepCls} />

            {/* ── Font Size ── */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                    tabIndex={-1}
                    onClick={() => { const newSize = Math.max(4, currentFontSize - 2); updateNode(nodeId, { fontSize: newSize }); setTextFontSize(newSize); }}
                    className={`${btnBase} ${btnIdle} w-6 h-6 text-base`}
                    title="Decrease size"
                >
                    <Minus className="w-3 h-3" />
                </button>
                <div className="relative">
                    {fontSizeInputFocused ? (
                        <input
                            type="number"
                            min="4"
                            max="200"
                            autoFocus
                            value={fontSizeInput}
                            onChange={(e) => setFontSizeInput(e.target.value)}
                            onBlur={() => handleFontSizeInputCommit()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleFontSizeInputCommit(); }
                                if (e.key === 'Escape') { e.preventDefault(); setFontSizeInputFocused(false); }
                                e.stopPropagation();
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-[44px] text-sm text-black text-center border border-purple-400 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                            style={{ appearance: 'textfield', MozAppearance: 'textfield', WebkitAppearance: 'none' }}
                        />
                    ) : (
                        <button
                            tabIndex={-1}
                            onClick={() => { setShowFontSizes(v => !v); setShowFontFamilies(false); setShowColorPicker(false); setShowMoreOptions(false); }}
                            onDoubleClick={() => { setFontSizeInput(String(currentFontSize)); setFontSizeInputFocused(true); setShowFontSizes(false); }}
                            className="flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-gray-100 text-sm text-black min-w-[38px] justify-center"
                        >
                            {currentFontSize}
                            <ChevronDown className="w-3 h-3 text-gray-400" />
                        </button>
                    )}
                    {showFontSizes && !fontSizeInputFocused && (
                        <div
                            className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-16 z-[160]"
                            style={{ maxHeight: '200px', overflowY: 'auto', overflowX: 'hidden', whiteSpace: 'normal' }}
                            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                        >
                            {FONT_SIZES.map(size => (
                                <button
                                    key={size}
                                    tabIndex={-1}
                                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                    onClick={() => { updateNode(nodeId, { fontSize: size }); setTextFontSize(size); setShowFontSizes(false); }}
                                    className={`w-full px-2 py-1 text-sm text-center hover:bg-gray-50 ${size === currentFontSize ? 'bg-purple-50 text-purple-600 font-medium' : 'text-black'}`}
                                    style={{ display: 'block', whiteSpace: 'nowrap' }}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    tabIndex={-1}
                    onClick={() => { const newSize = Math.min(200, currentFontSize + 2); updateNode(nodeId, { fontSize: newSize }); setTextFontSize(newSize); }}
                    className={`${btnBase} ${btnIdle} w-6 h-6 text-base`}
                    title="Increase size"
                >
                    <Plus className="w-3 h-3" />
                </button>
            </div>

            <div className={sepCls} />

            {/* ── Bold / Italic / Underline / Strikethrough ── */}
            <button tabIndex={-1} onClick={toggleBold} className={`${btnBase} ${isBold ? btnActive : btnIdle}`} title="Bold (Ctrl+B)">
                <Bold className="w-4 h-4" />
            </button>
            <button tabIndex={-1} onClick={toggleItalic} className={`${btnBase} ${isItalic ? btnActive : btnIdle}`} title="Italic (Ctrl+I)">
                <Italic className="w-4 h-4" />
            </button>
            <button tabIndex={-1} onClick={toggleUnderline} className={`${btnBase} ${isUnderline ? btnActive : btnIdle}`} title="Underline (Ctrl+U)">
                <UnderlineIcon className="w-4 h-4" />
            </button>
            <button tabIndex={-1} onClick={toggleStrike} className={`${btnBase} ${isStrike ? btnActive : btnIdle}`} title="Strikethrough">
                <Strikethrough className="w-4 h-4" />
            </button>

            <div className={sepCls} />

            {/* ── Text Color ── */}
            <div className="relative flex-shrink-0">
                <button
                    tabIndex={-1}
                    onClick={() => { setShowColorPicker(v => !v); setShowFontFamilies(false); setShowFontSizes(false); setShowMoreOptions(false); }}
                    className={`${btnBase} ${btnIdle} gap-0.5 flex-col`}
                    title="Text Color"
                    style={{ minWidth: 28 }}
                >
                    <span className="text-sm font-bold leading-none" style={{ color: currentColor }}>A</span>
                    <div className="w-4 h-1 rounded-full mt-0.5" style={{ backgroundColor: currentColor }} />
                </button>
                {showColorPicker && (
                    <div
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-[160]"
                        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                    >
                        <ColorPalette
                            selectedColor={currentColor}
                            onColorSelect={handleTextColorChange}
                            title="Text Color"
                        />
                    </div>
                )}
            </div>

            <div className={sepCls} />

            {/* ── More Options (bullet list, numbered list) ── */}
            <div className="relative flex-shrink-0">
                <button
                    tabIndex={-1}
                    onClick={() => { setShowMoreOptions(v => !v); setShowFontFamilies(false); setShowFontSizes(false); setShowColorPicker(false); }}
                    className={`${btnBase} ${showMoreOptions ? btnActive : btnIdle} gap-1 px-2 text-xs`}
                    title="More Options"
                >
                    More
                    {showMoreOptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showMoreOptions && (
                    <div
                        className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 py-1 w-44 z-[160]"
                        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                    >
                        <div className="px-3 py-1.5 text-xs text-gray-400 font-medium uppercase tracking-wide">List Style</div>
                        <button
                            tabIndex={-1}
                            onClick={() => handleListType('bullet')}
                            className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-gray-50 ${listType === 'bullet' ? 'text-purple-600 bg-purple-50' : 'text-black'}`}
                        >
                            <List className="w-4 h-4" /> Bullet List
                        </button>
                        <button
                            tabIndex={-1}
                            onClick={() => handleListType('number')}
                            className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-gray-50 ${listType === 'number' ? 'text-purple-600 bg-purple-50' : 'text-black'}`}
                        >
                            <ListOrdered className="w-4 h-4" /> Numbered List
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
