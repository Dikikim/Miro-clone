import { useState, useEffect, useRef } from 'react';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    ChevronDown, ChevronUp, List, ListOrdered, Minus, Plus
} from 'lucide-react';
import useStore from '../../store/useStore';
import ColorPalette from './ColorPalette';
import { toggleList } from '../../utils/textListHelpers';
import { nodeBaseAttrs, applyToRange, rangeEvery, setBold, setItalic } from '../../utils/richText';

const FONT_LIST = [
    'Arial', 'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
    'Raleway', 'Nunito', 'Playfair Display', 'Merriweather', 'Source Code Pro',
    'Fira Code', 'PT Sans', 'Oswald', 'Quicksand', 'Comfortaa', 'Cabin',
    'Ubuntu', 'Karla', 'Work Sans', 'DM Sans', 'Outfit', 'Space Grotesk',
    'Caveat', 'Pacifico',
];

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96, 128];

// Sticky-note specific menus
const STICKY_SIZES = [['S', 200], ['M', 320], ['L', 440]];
const STICKY_BG_COLORS = [
    '#fef08a', '#fde047', '#fdba74', '#fca5a5',
    '#f9a8d4', '#d8b4fe', '#a5b4fc', '#93c5fd',
    '#67e8f9', '#6ee7b7', '#bef264', '#e5e7eb',
];
const EMOJIS = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
    '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
    '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
    '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '🙁', '😮', '😲',
    '🥺', '😦', '😨', '😰', '😢', '😭', '😱', '😖', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠',
    '🤬', '😈', '👿', '💀', '💩', '🤡', '👻', '👽', '🤖', '🎃',
    '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🙏', '✌️', '🤞', '🤟', '🤘', '👌', '🤏',
    '👈', '👉', '👆', '👇', '☝️', '✋', '🖐️', '🖖', '👋', '💪', '✍️', '🤳',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💖', '💘', '💯', '✅',
    '❌', '❗', '❓', '⚠️', '🚫', '💢', '💬', '💭', '🔥', '⭐', '🌟', '✨', '⚡', '💥', '🎉', '🎊',
    '🏆', '🥇', '🎯', '📌', '📍', '📎', '📝', '✏️', '📒', '📅', '🕒', '⏰', '💡', '🔑', '🔒', '📞',
    '💻', '📱', '📷', '🔔', '💰', '💳', '🛒', '🌈', '☀️', '🌙', '☁️', '❄️', '🌊', '🌳', '🌸', '🍀',
    '🍎', '🍌', '🍓', '🍕', '🍔', '🍩', '🎂', '☕', '🍺', '🚗', '✈️', '🚀', '⚽', '🏀', '🎮', '🎵',
];

export default function FloatingTextToolbar({ nodeId, position }) {
    const { nodes, updateNode, setTextFontSize, setTextFontFamily, theme } = useStore();
    const isDark = theme === 'dark';

    const [showFontFamilies, setShowFontFamilies] = useState(false);
    const [showFontSizes, setShowFontSizes] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [showStickyColor, setShowStickyColor] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [fontSizeInput, setFontSizeInput] = useState('');
    const [fontSizeInputFocused, setFontSizeInputFocused] = useState(false);

    const toolbarRef = useRef(null);
    // Live position. While editing, the canvas text node is stale (its text is
    // only committed on blur), so its measured width is wrong and centering on
    // it pulls the toolbar to the left of what you're typing. Track the live
    // editing textarea instead, and keep the toolbar inside the viewport.
    const [livePos, setLivePos] = useState(position);

    // Close dropdowns on outside click.
    // Must stay above the early return — hooks can't run conditionally.
    useEffect(() => {
        const handleOutside = (e) => {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
                setShowFontFamilies(false);
                setShowFontSizes(false);
                setShowColorPicker(false);
                setShowMoreOptions(false);
                setShowStickyColor(false);
                setShowEmoji(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    useEffect(() => {
        // Event-driven so it survives a backgrounded tab (rAF is throttled when
        // hidden). When an editor textarea exists, centre over it and re-measure
        // as it grows (input) or the editor appears/disappears (MutationObserver).
        const measure = () => {
            const editor = document.querySelector('textarea[data-text-editor="true"]');
            const half = (toolbarRef.current?.offsetWidth || 360) / 2;
            const clamp = (x) => Math.max(half + 8, Math.min(window.innerWidth - half - 8, x));
            const target = editor ? (() => { const r = editor.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top }; })() : position;
            const nx = clamp(target.x), ny = target.y;
            setLivePos((p) => (Math.abs(p.x - nx) > 0.5 || Math.abs(p.y - ny) > 0.5) ? { x: nx, y: ny } : p);
        };
        measure();
        document.addEventListener('input', measure);
        window.addEventListener('resize', measure);
        // The editing textarea is appended directly to <body>; watch for it.
        const observer = new MutationObserver(measure);
        observer.observe(document.body, { childList: true });
        return () => {
            document.removeEventListener('input', measure);
            window.removeEventListener('resize', measure);
            observer.disconnect();
        };
    }, [position]);

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
    // The "A" swatch shows the effective colour — default black text renders white
    // in dark mode, so show it white here too (otherwise it's invisible on the bar).
    const displayColor = (isDark && (currentColor === '#000000' || currentColor === '#1a1a1a')) ? '#ffffff' : currentColor;

    // Apply a per-character style transform to the selected range — or the whole
    // text when nothing is selected — for text AND sticky notes. Collapses back
    // to a node-level style (clearing segments) when the result is uniform, so
    // plain text stays cheap to render.
    const styleSelection = (makeTransform) => {
        const ta = document.querySelector('textarea[data-text-editor="true"]');
        const text = ta ? ta.value : (node.text || '');
        const base = nodeBaseAttrs(node);
        const hasSel = ta && ta.selectionStart !== ta.selectionEnd && text.length > 0;
        const start = hasSel ? ta.selectionStart : 0;
        const end = hasSel ? ta.selectionEnd : text.length;
        const transform = makeTransform({ text, start, end, base });
        const { segments, uniform, attr } = applyToRange(text, node.colorSegments, base, start, end, transform);
        const update = { text };
        const writeBase = () => {
            update.fontSize = attr.fontSize;
            update.fontFamily = attr.fontFamily;
            update.fontStyle = attr.fontStyle;
            update.textDecoration = attr.textDecoration;
            if (isSticky) update.textColor = attr.fill; else update.fill = attr.fill;
        };
        if (uniform) {
            writeBase();
            update.colorSegments = null;
        } else {
            update.colorSegments = segments;
            if (!hasSel) writeBase(); // whole-text change: keep node base in sync for new typing
        }
        updateNode(nodeId, update);
    };

    const toggleBold = () => styleSelection(({ text, start, end, base }) => {
        const on = !rangeEvery(text, node.colorSegments, base, start, end, a => a.fontStyle.includes('bold'));
        return a => ({ ...a, fontStyle: setBold(a.fontStyle, on) });
    });
    const toggleItalic = () => styleSelection(({ text, start, end, base }) => {
        const on = !rangeEvery(text, node.colorSegments, base, start, end, a => a.fontStyle.includes('italic'));
        return a => ({ ...a, fontStyle: setItalic(a.fontStyle, on) });
    });
    const toggleUnderline = () => styleSelection(({ text, start, end, base }) => {
        const on = !rangeEvery(text, node.colorSegments, base, start, end, a => a.textDecoration === 'underline');
        return a => ({ ...a, textDecoration: on ? 'underline' : '' });
    });
    const toggleStrike = () => styleSelection(({ text, start, end, base }) => {
        const on = !rangeEvery(text, node.colorSegments, base, start, end, a => a.textDecoration === 'line-through');
        return a => ({ ...a, textDecoration: on ? 'line-through' : '' });
    });

    const setFontSizeSel = (size) => styleSelection(() => a => ({ ...a, fontSize: size }));
    const changeFontSizeSel = (delta) => styleSelection(() => a => ({ ...a, fontSize: Math.max(4, Math.min(200, a.fontSize + delta)) }));
    const setFontFamilySel = (family) => styleSelection(() => a => ({ ...a, fontFamily: family }));

    const handleTextColorChange = (color) => {
        styleSelection(() => a => ({ ...a, fill: color }));
        setShowColorPicker(false);
    };

    // Toggle bullet/number on just the line(s) the caret/selection covers, so
    // lists can be mixed line-by-line. While editing we mutate the live textarea
    // and let its input handler sync the node; otherwise we update the node text.
    const handleListType = (type) => {
        const ta = document.querySelector('textarea[data-text-editor="true"]');
        if (ta) {
            const { text, selStart, selEnd } = toggleList(ta.value, ta.selectionStart, ta.selectionEnd, type);
            ta.value = text;
            ta.selectionStart = selStart;
            ta.selectionEnd = selEnd;
            ta.focus();
            ta.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            const cur = node.text || '';
            const { text } = toggleList(cur, 0, cur.length, type);
            updateNode(nodeId, { text });
        }
        setShowMoreOptions(false);
    };

    // ── Sticky-note only menus ──
    const setStickySize = (w, h) => updateNode(nodeId, { width: w, height: h });
    const setStickyBg = (color) => { updateNode(nodeId, { fill: color }); setShowStickyColor(false); };
    const insertEmoji = (emoji) => {
        const ta = document.querySelector('textarea[data-text-editor="true"]');
        if (ta) {
            const s = ta.selectionStart, e = ta.selectionEnd;
            ta.value = ta.value.slice(0, s) + emoji + ta.value.slice(e);
            ta.selectionStart = ta.selectionEnd = s + emoji.length;
            ta.focus();
            ta.dispatchEvent(new Event('input', { bubbles: true })); // live-sync to the node
        } else {
            updateNode(nodeId, { text: (node.text || '') + emoji });
        }
        setShowEmoji(false);
    };

    const handleFontSizeInputCommit = () => {
        const val = parseInt(fontSizeInput, 10);
        if (!isNaN(val) && val >= 4 && val <= 200) {
            setFontSizeSel(val);
            setTextFontSize(val);
        }
        setFontSizeInputFocused(false);
    };

    const left = livePos.x;
    const top = Math.max(60, livePos.y - 54);

    const sepCls = `w-px h-5 mx-0.5 flex-shrink-0 ${isDark ? 'bg-white/20' : 'bg-gray-200'}`;
    const btnBase = 'p-1.5 rounded transition-colors flex-shrink-0 flex items-center justify-center';
    const btnIdle = isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-600';
    const btnActive = isDark ? 'bg-purple-500/40 text-white' : 'bg-purple-100 text-purple-600';
    // Dropdown surface + item tokens (dark vs light)
    const ddPanel = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
    const ddText = isDark ? 'text-white' : 'text-black';
    const ddHover = isDark ? 'hover:bg-white/10' : 'hover:bg-gray-50';
    const ddActive = isDark ? 'bg-purple-500/30 text-purple-200' : 'bg-purple-50 text-purple-600';

    return (
        <div
            ref={toolbarRef}
            data-floating-toolbar="true"
            className={`fixed z-[1100] flex items-center gap-0.5 rounded-xl shadow-2xl border border-transparent px-2 py-1.5 menu-accent-edge ${isDark ? 'bg-gray-800' : 'bg-white'}`}
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
                    className={`flex items-center gap-1 px-2 py-1 rounded text-sm max-w-[110px] ${ddText} ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                >
                    <span className="truncate" style={{ fontFamily: `'${currentFontFamily}', sans-serif` }}>
                        {currentFontFamily}
                    </span>
                    <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                </button>
                {showFontFamilies && (
                    <div
                        className={`absolute top-full left-0 mt-1 rounded-lg shadow-xl border py-1 w-44 z-[160] ${ddPanel}`}
                        style={{ maxHeight: '240px', overflowY: 'auto', overflowX: 'hidden', whiteSpace: 'normal' }}
                        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                    >
                        {FONT_LIST.map(font => (
                            <button
                                key={font}
                                tabIndex={-1}
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                onClick={() => { setFontFamilySel(font); setTextFontFamily(font); setShowFontFamilies(false); }}
                                className={`w-full px-3 py-1.5 text-sm text-left ${ddHover} ${currentFontFamily === font ? ddActive + ' font-medium' : ddText}`}
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
                    onClick={() => changeFontSizeSel(-2)}
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
                            className={`w-[44px] text-sm text-center border border-purple-400 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-400 ${isDark ? 'text-white bg-gray-700' : 'text-black bg-white'}`}
                            style={{ appearance: 'textfield', MozAppearance: 'textfield', WebkitAppearance: 'none' }}
                        />
                    ) : (
                        <button
                            tabIndex={-1}
                            onClick={() => { setShowFontSizes(v => !v); setShowFontFamilies(false); setShowColorPicker(false); setShowMoreOptions(false); }}
                            onDoubleClick={() => { setFontSizeInput(String(currentFontSize)); setFontSizeInputFocused(true); setShowFontSizes(false); }}
                            className={`flex items-center gap-0.5 px-1.5 py-1 rounded text-sm min-w-[38px] justify-center ${ddText} ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                        >
                            {currentFontSize}
                            <ChevronDown className="w-3 h-3 text-gray-400" />
                        </button>
                    )}
                    {showFontSizes && !fontSizeInputFocused && (
                        <div
                            className={`absolute top-full left-0 mt-1 rounded-lg shadow-xl border py-1 w-16 z-[160] ${ddPanel}`}
                            style={{ maxHeight: '200px', overflowY: 'auto', overflowX: 'hidden', whiteSpace: 'normal' }}
                            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                        >
                            {FONT_SIZES.map(size => (
                                <button
                                    key={size}
                                    tabIndex={-1}
                                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                    onClick={() => { setFontSizeSel(size); setTextFontSize(size); setShowFontSizes(false); }}
                                    className={`w-full px-2 py-1 text-sm text-center ${ddHover} ${size === currentFontSize ? ddActive + ' font-medium' : ddText}`}
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
                    onClick={() => changeFontSizeSel(2)}
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
                    <span className="text-sm font-bold leading-none" style={{ color: displayColor }}>A</span>
                    <div className="w-4 h-1 rounded-full mt-0.5" style={{ backgroundColor: displayColor }} />
                </button>
                {showColorPicker && (
                    <div
                        className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 rounded-xl shadow-xl border p-3 z-[160] w-[220px] ${ddPanel}`}
                        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                    >
                        <ColorPalette
                            selectedColor={currentColor}
                            onColorSelect={handleTextColorChange}
                            title="Text Color"
                            showEyedropper={false}
                        />
                    </div>
                )}
            </div>

            {/* ── Sticky-note only: size, note colour, emoji ── */}
            {isSticky && (
                <>
                    <div className={sepCls} />
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                        {STICKY_SIZES.map(([label, sz]) => (
                            <button key={label} tabIndex={-1}
                                onClick={() => setStickySize(sz, sz)}
                                className={`${btnBase} ${node.width === sz ? btnActive : btnIdle} w-6 h-6 text-xs font-semibold`}
                                title={`${label} note`}>{label}</button>
                        ))}
                    </div>
                    <div className={sepCls} />
                    <div className="relative flex-shrink-0">
                        <button tabIndex={-1}
                            onClick={() => { setShowStickyColor(v => !v); setShowEmoji(false); setShowColorPicker(false); setShowFontFamilies(false); setShowFontSizes(false); setShowMoreOptions(false); }}
                            className={`${btnBase} ${btnIdle}`} title="Note color">
                            <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: node.fill || '#fef08a' }} />
                        </button>
                        {showStickyColor && (
                            <div className={`absolute top-full right-0 mt-2 rounded-xl shadow-xl border p-2 z-[160] w-[136px] ${ddPanel}`}
                                onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}>
                                <div className="grid grid-cols-4 gap-1.5 justify-items-center">
                                    {STICKY_BG_COLORS.map(c => (
                                        <button key={c} tabIndex={-1} onClick={() => setStickyBg(c)}
                                            className={`w-6 h-6 rounded border-2 hover:scale-110 transition-transform ${(node.fill || '#fef08a') === c ? 'border-purple-500' : 'border-gray-200'}`}
                                            style={{ backgroundColor: c }} title={c} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="relative flex-shrink-0">
                        <button tabIndex={-1}
                            onClick={() => { setShowEmoji(v => !v); setShowStickyColor(false); setShowColorPicker(false); setShowFontFamilies(false); setShowFontSizes(false); setShowMoreOptions(false); }}
                            className={`${btnBase} ${btnIdle} text-base`} title="Emoji">🙂</button>
                        {showEmoji && (
                            <div className={`absolute top-full right-0 mt-2 rounded-xl shadow-xl border p-2 z-[160] w-[300px] ${ddPanel}`}
                                onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}>
                                <div className="grid grid-cols-8 gap-0.5 max-h-[260px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                    {EMOJIS.map(em => (
                                        <button key={em} tabIndex={-1} onClick={() => insertEmoji(em)}
                                            className={`w-8 h-8 flex items-center justify-center rounded text-xl ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`} title={em}>{em}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

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
                        className={`absolute top-full right-0 mt-1 rounded-xl shadow-xl border py-1 w-44 z-[160] ${ddPanel}`}
                        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                    >
                        <div className="px-3 py-1.5 text-xs text-gray-400 font-medium uppercase tracking-wide">List Style</div>
                        <button
                            tabIndex={-1}
                            onClick={() => handleListType('bullet')}
                            className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 ${ddHover} ${ddText}`}
                        >
                            <List className="w-4 h-4" /> Bullet List
                        </button>
                        <button
                            tabIndex={-1}
                            onClick={() => handleListType('number')}
                            className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 ${ddHover} ${ddText}`}
                        >
                            <ListOrdered className="w-4 h-4" /> Numbered List
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

