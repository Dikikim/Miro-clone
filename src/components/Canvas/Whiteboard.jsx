import { useRef, useEffect, useCallback, useState, cloneElement } from 'react';
import AudioPlayer from '../Upload/AudioPlayer';
import { Stage, Layer, Rect, Circle, Ellipse, Text, Transformer, Image as KonvaImage, Group, Line, RegularPolygon, Arrow, Star as KonvaStar, Shape } from 'react-konva';
import useStore from '../../store/useStore';
import PdfOverlay from './PdfOverlay';
import ShapeToolbar from '../UI/ShapeToolbar';
import FloatingTextToolbar from '../UI/FloatingTextToolbar';
import LogoSpinner from '../UI/LogoSpinner';
import { renumber, remapCaret, listEnter } from '../../utils/textListHelpers';
import { nodeBaseAttrs, charAttrsFromSegments, sameAttrs } from '../../utils/richText';

// Shared offscreen context for measuring run widths so multi-colour text lines
// up exactly with how Konva renders each run (same canvas measureText).
const _measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const _measureCtx = _measureCanvas ? _measureCanvas.getContext('2d') : null;
function measureRunWidth(str, fontStyle, fontSize, fontFamily) {
    if (!_measureCtx) return str.length * fontSize * 0.5;
    _measureCtx.font = `${fontStyle || 'normal'} normal ${fontSize}px ${fontFamily}`;
    return _measureCtx.measureText(str).width;
}

// Sticky notes auto-shrink their text to fit the card. The editor textarea must
// use the SAME size or its (invisible) caret drifts away from the rendered text
// — most visibly with bullet/numbered lists, which produce many short lines.
// Single source of truth, shared by the renderer and the edit overlay.
function fitStickyFontSize(text, width, height, baseFontSize = 18) {
    const pad = 14;
    const maxW = width - pad * 2;
    const maxH = height - pad * 2;
    let size = baseFontSize || 18;
    if (text && text.length > 0 && maxW > 0 && maxH > 0) {
        for (let fs = size; fs >= 10; fs--) {
            const charsPerLine = Math.max(1, Math.floor(maxW / (fs * 0.58)));
            let lines = 0;
            for (const para of text.split('\n')) lines += Math.max(1, Math.ceil(para.length / charsPerLine));
            size = fs;
            if (lines * fs * 1.3 <= maxH) break;
        }
    }
    return size;
}

// Renders a text node whose characters carry different styles (colour, size,
// font, weight, decoration) as a Group of per-run <Text> elements, laid out line
// by line with per-line height and baseline alignment. Used when colorSegments
// holds more than one run; otherwise the plain single <Text> is used.
// Default near-black text is invisible on the dark canvas → render it white in
// dark mode (text + sticky notes). Explicit non-default colours are kept. Reads
// the theme live so it stays correct inside memoised callbacks.
function adaptTextFill(color, sticky) {
    const c = color || (sticky ? '#1a1a1a' : '#000000');
    const isDark = useStore.getState().theme === 'dark';
    return (isDark && (c === '#000000' || c === '#1a1a1a')) ? '#ffffff' : c;
}

function RichTextNode({ node, commonProps, isDark }) {
    const text = node.text || '';
    const lineHeight = node.lineHeight || 1;
    const base = nodeBaseAttrs(node);
    if (isDark && (base.fill === '#000000' || base.fill === '#1a1a1a')) base.fill = '#ffffff';
    const attrs = charAttrsFromSegments(node.colorSegments, text.length, base);
    const lines = text.split('\n');

    const elements = [];
    let charIdx = 0;
    let maxWidth = 0;
    let yTop = 0;
    let key = 0;
    lines.forEach((line) => {
        // Line height follows the largest glyph on the line.
        let lineMax = base.fontSize;
        for (let k = 0; k < line.length; k++) lineMax = Math.max(lineMax, attrs[charIdx + k].fontSize);
        let x = 0;
        let i = 0;
        while (i < line.length) {
            const a = attrs[charIdx + i];
            let j = i + 1;
            while (j < line.length && sameAttrs(attrs[charIdx + j], a)) j++;
            const runText = line.slice(i, j);
            const y = yTop + 0.8 * (lineMax - a.fontSize); // baseline-align smaller runs
            elements.push(
                <Text key={key++} x={x} y={y} text={runText}
                    fontSize={a.fontSize} fontFamily={a.fontFamily} fontStyle={a.fontStyle}
                    textDecoration={a.textDecoration} fill={a.fill} listening={false} />
            );
            x += measureRunWidth(runText, a.fontStyle, a.fontSize, a.fontFamily);
            i = j;
        }
        if (x > maxWidth) maxWidth = x;
        yTop += lineMax * lineHeight;
        charIdx += line.length + 1; // +1 for the newline
    });

    return (
        <Group {...commonProps} x={node.x} y={node.y} opacity={node.opacity ?? 1}>
            {/* Transparent hit area so the node stays clickable/draggable. The
                per-run <Text> elements are listening={false}, which would
                otherwise leave the Group with no hit region. */}
            <Rect x={0} y={0} width={Math.max(maxWidth, 1)} height={Math.max(yTop, 1)} fill="transparent" />
            {elements}
        </Group>
    );
}

// Lay out wrapped, multi-colour text into positioned <Text> runs for sticky
// notes. Honours hard newlines and greedy word-wrap at maxW; each run is
// coloured from `colors` (per-character, indexed into the full text).
// Word-wrap a sticky's text to the card width, rendering per-run <Text> with each
// run's own colour/size/font/style so formatting can be applied to single words.
// Each visual line's height follows its largest glyph; smaller runs are
// baseline-aligned. `attrs` is the per-character attribute array.
function wrappedRichRuns(text, attrs, baseSize, maxW) {
    const els = [];
    let y = 0;        // top of the current visual line
    let key = 0;
    let buf = [];     // runs queued for the current visual line: { text, attr, x }
    let lineMax = 0;
    let curX = 0;

    const flush = () => {
        const h = lineMax || baseSize;
        for (const r of buf) {
            const yy = y + 0.8 * (h - r.attr.fontSize); // baseline-align smaller runs
            els.push(
                <Text key={key++} x={r.x} y={yy} text={r.text}
                    fontSize={r.attr.fontSize} fontFamily={r.attr.fontFamily}
                    fontStyle={r.attr.fontStyle} textDecoration={r.attr.textDecoration}
                    fill={r.attr.fill} listening={false} />
            );
        }
        y += h;
        buf = []; lineMax = 0; curX = 0;
    };

    const wordWidth = (word, startIdx) => {
        let w = 0;
        for (let k = 0; k < word.length; k++) {
            const a = attrs[startIdx + k];
            w += measureRunWidth(word[k], a.fontStyle, a.fontSize, a.fontFamily);
        }
        return w;
    };

    const pushWord = (word, startIdx) => {
        let s = 0;
        while (s < word.length) {
            const a = attrs[startIdx + s];
            let e = s + 1;
            while (e < word.length && sameAttrs(attrs[startIdx + e], a)) e++;
            const part = word.slice(s, e);
            buf.push({ text: part, attr: a, x: curX });
            curX += measureRunWidth(part, a.fontStyle, a.fontSize, a.fontFamily);
            if (a.fontSize > lineMax) lineMax = a.fontSize;
            s = e;
        }
    };

    // Break a word that is wider than the whole card across multiple lines so
    // very large words don't overflow the sticky.
    const placeChars = (str, startIdx) => {
        for (let k = 0; k < str.length; k++) {
            const a = attrs[startIdx + k];
            const cw = measureRunWidth(str[k], a.fontStyle, a.fontSize, a.fontFamily);
            if (curX > 0 && curX + cw > maxW) flush();
            const last = buf.length ? buf[buf.length - 1] : null;
            if (last && sameAttrs(last.attr, a)) last.text += str[k];
            else buf.push({ text: str[k], attr: a, x: curX });
            curX += cw;
            if (a.fontSize > lineMax) lineMax = a.fontSize;
        }
    };

    let gi = 0; // absolute char index into `text` (including newlines)
    text.split('\n').forEach((line) => {
        const tokens = line.split(' ');
        let idx = gi;
        for (let t = 0; t < tokens.length; t++) {
            const word = tokens[t] + (t < tokens.length - 1 ? ' ' : '');
            const bareW = wordWidth(tokens[t], idx);
            if (curX > 0 && curX + bareW > maxW) flush();
            if (bareW > maxW) placeChars(word, idx);
            else pushWord(word, idx);
            idx += word.length;
        }
        gi = idx + 1; // skip the newline
        flush();      // hard newline ends the visual line
    });
    return els;
}

// Editor input handler shared by both text editors: renumber numbered lines
// (keeping the caret), push the text to the visible node live so colour/list/
// typing render immediately, then resize the editor.
function syncLiveText(textarea, nodeId, autoExpand) {
    const before = textarea.value;
    const after = renumber(before);
    if (after !== before) {
        const pos = textarea.selectionStart;
        textarea.value = after;
        const np = remapCaret(before, pos, after);
        textarea.selectionStart = textarea.selectionEnd = np;
    }
    useStore.getState().updateNodeTransient(nodeId, { text: textarea.value });
    autoExpand();
}

function useImage(src) {
    const [image, setImage] = useState(null);
    useEffect(() => {
        if (!src) return;
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setImage(img);
        img.src = src;
        return () => { img.onload = null; };
    }, [src]);
    return image;
}

function ImageNode({ node, commonProps }) {
    const image = useImage(node.src);
    if (!image) return null;
    return <KonvaImage {...commonProps} x={node.x} y={node.y} width={node.width} height={node.height} image={image} />;
}

function YoutubeNode({ node, commonProps }) {
    const image = useImage(node.videoId ? `https://img.youtube.com/vi/${node.videoId}/hqdefault.jpg` : null);
    const w = node.width || 480;
    const h = node.height || 270;
    const playBtnW = Math.min(68, w * 0.14);
    const playBtnH = Math.min(48, h * 0.18);
    const cx = w / 2, cy = h / 2;
    const hintFs = Math.max(9, Math.min(12, w * 0.025));

    // Don't render Konva node if playing (iframe overlay takes over)
    if (node.playing) {
        return (
            <Group {...commonProps} x={node.x} y={node.y}>
                <Rect width={w} height={h} fill="#000" cornerRadius={12} />
            </Group>
        );
    }

    return (
        <Group {...commonProps} x={node.x} y={node.y}>
            <Rect width={w} height={h} fill="#0f0f0f" cornerRadius={12} />
            {image && <KonvaImage listening={false} image={image} width={w} height={h} cornerRadius={12} />}
            <Rect listening={false} x={cx - playBtnW / 2} y={cy - playBtnH / 2} width={playBtnW} height={playBtnH} fill="#ff0000" cornerRadius={12} shadowColor="black" shadowBlur={10} shadowOpacity={0.5} />
            <Line listening={false} points={[cx - 10, cy - 12, cx - 10, cy + 12, cx + 14, cy]} fill="white" closed />
            <Rect listening={false} x={10} y={h - 32} width={w - 20} height={22} fill="rgba(0,0,0,0.7)" cornerRadius={4} />
            <Text listening={false} x={10} y={h - 28} width={w - 20} text="🎬 Double-click to play" fontSize={hintFs} fill="#fff" align="center" />
        </Group>
    );
}

function AudioNode({ node, commonProps }) {
    const w = node.width || 300;
    const h = node.height || 80;
    const fileName = node.fileName || 'Audio file';
    const isPlaying = node.playing;
    const hintText = isPlaying ? '🔊 Playing... double-click to stop' : '🎧 Double-click to play';

    // Everything scales with the box. The note icon and paddings track height,
    // and the text grows with height too — but is also clamped to the available
    // width so the whole label stays inside the card when the node is upscaled.
    const pad = h * 0.14;
    const iconRadius = h * 0.3;
    const iconCx = pad + iconRadius;
    const iconCy = h / 2;
    const noteFs = iconRadius * 1.1;
    const textX = iconCx + iconRadius + pad;
    const availW = Math.max(20, w - textX - pad);

    const nameFs = Math.max(9, Math.min(h * 0.27, availW / Math.max(6, fileName.length * 0.55)));
    const hintFs = Math.max(8, Math.min(h * 0.19, nameFs * 0.72, availW / Math.max(10, hintText.length * 0.5)));

    const maxNameLen = Math.max(4, Math.floor(availW / (nameFs * 0.55)));
    const displayName = fileName.length > maxNameLen ? fileName.slice(0, maxNameLen - 1) + '…' : fileName;

    const cornerR = Math.min(16, h * 0.18);
    const gap = h * 0.06;
    const textBlockH = nameFs + gap + hintFs;
    const textStartY = (h - textBlockH) / 2;

    return (
        <Group {...commonProps} x={node.x} y={node.y}>
            {/* Background card */}
            <Rect width={w} height={h} fill={isPlaying ? '#f5f3ff' : '#ffffff'} stroke={isPlaying ? '#8b5cf6' : '#e5e7eb'} strokeWidth={isPlaying ? 2 : 1} cornerRadius={cornerR} shadowColor="black" shadowBlur={8} shadowOpacity={0.1} />

            {/* Music icon circle */}
            <Circle listening={false} x={iconCx} y={iconCy} radius={iconRadius} fill="#8b5cf6" />

            {/* Music note icon */}
            <Text listening={false} x={iconCx - noteFs * 0.4} y={iconCy - noteFs * 0.55} text={isPlaying ? '▶' : '♪'} fontSize={noteFs} fill="white" />

            {/* File name */}
            <Text listening={false} x={textX} y={textStartY} text={displayName} fontSize={nameFs} fill="#1f2937" fontStyle="bold" width={availW} wrap="none" ellipsis />

            {/* Double-click hint */}
            <Text listening={false} x={textX} y={textStartY + nameFs + gap} text={hintText} fontSize={hintFs} fill={isPlaying ? '#8b5cf6' : '#6b7280'} width={availW} wrap="none" ellipsis />
        </Group>
    );
}

function VideoNode({ node, commonProps }) {
    const w = node.width || 400;
    const h = node.height || 225;
    const playBtnSize = 60;
    const fileName = node.fileName || 'Video file';

    return (
        <Group {...commonProps} x={node.x} y={node.y}>
            {/* Background */}
            <Rect width={w} height={h} fill="#1f2937" cornerRadius={12} />

            {/* Video preview gradient overlay */}
            <Rect listening={false} width={w} height={h} fill="#374151" cornerRadius={12} />

            {/* Play button circle */}
            <Circle listening={false} x={w / 2} y={h / 2} radius={playBtnSize / 2} fill="rgba(255,255,255,0.9)" shadowColor="black" shadowBlur={10} shadowOpacity={0.3} />

            {/* Play triangle */}
            <Line
                listening={false}
                points={[w / 2 - 8, h / 2 - 12, w / 2 - 8, h / 2 + 12, w / 2 + 14, h / 2]}
                fill="#1f2937"
                closed
            />

            {/* Video icon badge */}
            <Rect listening={false} x={10} y={10} width={28} height={28} fill="#ef4444" cornerRadius={6} />
            <Text listening={false} x={15} y={14} text="▶" fontSize={16} fill="white" />

            {/* File name and hint at bottom */}
            <Rect listening={false} x={0} y={h - 36} width={w} height={36} fill="rgba(0,0,0,0.7)" cornerRadius={[0, 0, 12, 12]} />
            <Text listening={false} x={12} y={h - 30} text={fileName.length > 35 ? fileName.substring(0, 35) + '...' : fileName} fontSize={11} fill="#ffffff" width={w - 24} />
            <Text listening={false} x={12} y={h - 14} text="🎬 Double-click to play" fontSize={10} fill="#9ca3af" />
        </Group>
    );
}

function PdfDocumentNode({ node, commonProps }) {
    const { updateNode } = useStore();
    const [recoveredSrc, setRecoveredSrc] = useState(null);
    const coverToUse = node.coverSrc || recoveredSrc;
    const image = useImage(coverToUse);
    const w = node.width || 300;
    const h = node.height || 400;

    // Auto-recover cover from PDF bytes in IDB if coverSrc is empty
    useEffect(() => {
        if (node.coverSrc && node.coverSrc.length > 10) return; // already have a valid cover
        let cancelled = false;
        const recover = async () => {
            try {
                const { loadMediaFromDB } = await import('../../store/useStore');
                const { renderPdfPage, base64ToBytes } = await import('../../utils/pdfHelpers');
                const pdfBase64 = await loadMediaFromDB(`${node.id}_pdf`);
                if (!pdfBase64 || cancelled) return;
                const bytes = base64ToBytes(pdfBase64);
                const { dataUrl } = await renderPdfPage(bytes, node.currentPage || 1, 1.5);
                if (!cancelled) {
                    setRecoveredSrc(dataUrl);
                    updateNode(node.id, { coverSrc: dataUrl });
                }
            } catch (e) {
                console.error('PDF cover recovery error:', e);
            }
        };
        recover();
        return () => { cancelled = true; };
    }, [node.id, node.coverSrc, node.currentPage, updateNode]);

    return (
        <Group {...commonProps} x={node.x} y={node.y}>
            {/* Shadow/background */}
            <Rect width={w} height={h} fill="#ffffff" stroke="#d1d5db" strokeWidth={1} cornerRadius={4}
                shadowColor="black" shadowBlur={12} shadowOpacity={0.15} shadowOffsetY={4} />

            {/* Cover image */}
            {image && <KonvaImage listening={false} image={image} width={w} height={h} cornerRadius={4} />}

            {/* If no image yet, show placeholder */}
            {!image && (
                <>
                    <Rect width={w} height={h} fill="#f3f4f6" cornerRadius={4} />
                    <Text listening={false} x={w / 2 - 30} y={h / 2 - 10} text="📄 PDF" fontSize={18} fill="#9ca3af" />
                </>
            )}
        </Group>
    );
}

export default function Whiteboard() {
    const stageRef = useRef(null);
    const layerRef = useRef(null);
    const transformerRef = useRef(null);
    const isDrawing = useRef(false);
    const currentLineId = useRef(null);
    const mouseButtonRef = useRef(0); // Track which mouse button is pressed
    const isPanning = useRef(false); // Manual canvas panning state
    const lastPointer = useRef({ x: 0, y: 0 }); // Last pointer position for panning
    const dragStartPositions = useRef({}); // Track initial positions for multi-drag
    const editingTextIdRef = useRef(null);
    // Reactive id of the node currently being edited, so its empty-state
    // placeholder can be hidden (the editor's own placeholder shows instead).
    const [editingNodeId, setEditingNodeId] = useState(null);
    // The node stays VISIBLE while editing — a transparent textarea sits on top
    // and the node's text is live-synced — so text, colour and list changes show
    // immediately, and the text never vanishes when the editor closes. We only
    // drop the transformer to avoid a double selection border during editing.
    const hideEditingTextNode = useCallback((nodeId) => {
        editingTextIdRef.current = nodeId;
        setEditingNodeId(nodeId);
        if (transformerRef.current) {
            transformerRef.current.nodes([]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, []);
    const showEditingTextNode = useCallback(() => {
        editingTextIdRef.current = null;
        setEditingNodeId(null);
    }, []);
    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [drawingShape, setDrawingShape] = useState(null);
    const [selectionRect, setSelectionRect] = useState(null);
    const [laserLines, setLaserLines] = useState([]);
    const laserCurrentId = useRef(null);
    const [pendingComment, setPendingComment] = useState(null); // { x, y } in canvas coords

    const {
        nodes, selectedNodeIds, tool, shapeType, stagePosition, stageScale,
        fillColor, strokeColor, penStrokeWidth, highlighterStrokeWidth, laserStrokeWidth, objectStrokeWidth, textColor, highlighterColor,
        cornerRadius: storeCornerRadius,
        addNode, updateNode, deleteNode, selectNode, clearSelection, setStagePosition, setStageScale,
        beginStrokeNode, updateNodeTransient, commitTransient,
        showContextMenu,
        addComment,
        theme,
    } = useStore();

    const isDarkTheme = theme === 'dark';
    // Per-character base for rich (multi-colour) text, with its default fill adapted.
    const adaptedBase = (n) => {
        const b = nodeBaseAttrs(n);
        return { ...b, fill: adaptTextFill(b.fill, n.type === 'sticky') };
    };

    useEffect(() => {
        const handleResize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (transformerRef.current && layerRef.current) {
            // Exclude the node currently being edited so its transform handles don't
            // show over the live text editor (the node stays visible while editing).
            const editingId = editingTextIdRef.current;
            const selected = selectedNodeIds
                .filter((id) => id !== editingId)
                .map((id) => layerRef.current.findOne(`#${id}`))
                .filter(Boolean);
            transformerRef.current.nodes(selected);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, [selectedNodeIds, nodes]);

    const getPos = useCallback(() => {
        const stage = stageRef.current;
        if (!stage) return null;
        const pointer = stage.getPointerPosition();
        if (!pointer) return null;
        const pos = stage.position();
        const scale = stage.scaleX();
        return { x: (pointer.x - pos.x) / scale, y: (pointer.y - pos.y) / scale };
    }, []);

    const handleWheel = useCallback((e) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const newScale = Math.max(0.1, Math.min(5, direction > 0 ? oldScale * 1.1 : oldScale / 1.1));
        setStageScale(newScale);
        setStagePosition({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
    }, [setStageScale, setStagePosition]);

    const handleMouseDown = useCallback((e) => {
        // Track which mouse button was pressed
        const button = e.evt ? e.evt.button : 0;
        mouseButtonRef.current = button;

        // Middle mouse button (button 1) — always pan, even over objects
        if (button === 1) {
            e.evt?.preventDefault();
            isPanning.current = true;
            lastPointer.current = stageRef.current.getPointerPosition();
            return;
        }

        // Only respond to left mouse button (button 0) for tool actions
        if (button !== 0) return;

        const onEmpty = e.target === e.target.getStage();

        const pos = getPos();
        if (!pos) return;

        if (tool === 'pen') {
            isDrawing.current = true;
            currentLineId.current = beginStrokeNode({ type: 'line', points: [pos.x, pos.y], stroke: strokeColor, strokeWidth: penStrokeWidth, lineCap: 'round', lineJoin: 'round' });
            return;
        }

        if (tool === 'highlighter') {
            isDrawing.current = true;
            currentLineId.current = beginStrokeNode({ type: 'highlight', points: [pos.x, pos.y], stroke: highlighterColor, strokeWidth: highlighterStrokeWidth, opacity: 0.4, lineCap: 'round', lineJoin: 'round' });
            return;
        }

        if (tool === 'eraser' && !onEmpty) {
            const clickedId = e.target.id();
            const nodeData = nodes.find(n => n.id === clickedId);
            if (clickedId && nodeData && nodeData.type === 'line') {
                deleteNode(clickedId);
            }
            return;
        }

        if (!onEmpty) return;

        // Clicked on empty canvas
        if (tool === 'select') {
            clearSelection();
            // Start rubber-band selection
            setSelectionRect({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y });
            return;
        }

        // Start drawing shape by dragging
        if (tool === 'shape' || tool === 'frame') {
            setDrawingShape({ type: tool === 'frame' ? 'frame' : shapeType, startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y });
            return;
        }

        // Sticky note — place immediately (single or pile)
        if (tool === 'sticky') {
            const { stickyColor, stickyPileMode } = useStore.getState();
            const color = stickyColor || '#fef08a';
            if (stickyPileMode) {
                // Place a pile of 3 stickers slightly offset/rotated
                const offsets = [
                    { dx: 4, dy: 6, rot: -3 },
                    { dx: -3, dy: 3, rot: 2 },
                    { dx: 0, dy: 0, rot: 0 },
                ];
                offsets.forEach(({ dx, dy }) => {
                    addNode({ type: 'sticky', x: pos.x - 100 + dx, y: pos.y - 100 + dy, width: 200, height: 200, text: '', fill: color, fontSize: 18 });
                });
            } else {
                addNode({ type: 'sticky', x: pos.x - 100, y: pos.y - 100, width: 200, height: 200, text: '', fill: color, fontSize: 18 });
            }
            useStore.getState().setTool('select');
            return;
        }

        // Comment tool — place a comment pin with inline input
        if (tool === 'comment') {
            setPendingComment({ x: pos.x, y: pos.y });
            return;
        }

        // Laser pointer — ephemeral drawing
        if (tool === 'laser') {
            const id = Date.now().toString();
            laserCurrentId.current = id;
            setLaserLines(prev => [...prev, { id, points: [pos.x, pos.y], opacity: 1 }]);
            isDrawing.current = true;
            return;
        }

        // Only create new text on empty canvasvs
        if (tool === 'text') {
            const textFontFamily = useStore.getState().textFontFamily || 'Arial';
            const textFontSizeVal = useStore.getState().textFontSize || 24;
            const newNodeId = addNode({ type: 'text', x: pos.x, y: pos.y, text: '', fontSize: textFontSizeVal, fill: textColor, fontFamily: textFontFamily });
            // Switch to select so clicking away commits this node instead of spawning another
            useStore.getState().setTool('select');
            // Select the node so FloatingTextToolbar renders, then open textarea for editing
            setTimeout(() => {
                selectNode(newNodeId);
                const textNode = layerRef.current?.findOne(`#${newNodeId}`);
                if (textNode && stageRef.current) {
                    hideEditingTextNode(newNodeId);
                    const stage = stageRef.current;
                    const textPosition = textNode.absolutePosition();
                    const areaPosition = {
                        x: stage.container().offsetLeft + textPosition.x,
                        y: stage.container().offsetTop + textPosition.y,
                    };

                    // Create bare textarea — FloatingTextToolbar handles formatting
                    const textarea = document.createElement('textarea');
                    textarea.setAttribute('data-text-editor', 'true');
                    document.body.appendChild(textarea);
                    textarea.value = '';
                    textarea.placeholder = 'Type something';
                    textarea.rows = 1;
                    const currentFontFam = useStore.getState().textFontFamily || 'Arial';
                    const currentFontSz = useStore.getState().textFontSize || 24;
                    textarea.style.cssText = `
                        position: absolute;
                        top: ${areaPosition.y - 2}px;
                        left: ${areaPosition.x - 2}px;
                        min-width: 100px;
                        width: auto;
                        font-size: ${currentFontSz * stageScale}px;
                        border: 2px solid #0ea5e9;
                        padding: 2px 4px;
                        background: transparent;
                        color: transparent;
                        caret-color: ${adaptTextFill(textColor, false)};
                        outline: none;
                        resize: none;
                        line-height: 1;
                        font-family: '${currentFontFam}', sans-serif;
                        z-index: 1000;
                        border-radius: 2px;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                        box-sizing: border-box;
                    `;
                    textarea.style.setProperty('-webkit-scrollbar', 'none');

                    // Keep the textarea's font metrics in sync with toolbar style
                    // changes so the (invisible) caret stays aligned with the live
                    // Konva text rendered underneath.
                    const unsubStyleSync = useStore.subscribe((state) => {
                        const updatedNode = state.nodes.find(n => n.id === newNodeId);
                        if (!updatedNode || textareaRemoved) return;
                        const fs = updatedNode.fontStyle || 'normal';
                        textarea.style.fontWeight = fs.includes('bold') ? 'bold' : 'normal';
                        textarea.style.fontStyle = fs.includes('italic') ? 'italic' : 'normal';
                        textarea.style.fontFamily = `'${updatedNode.fontFamily || 'Arial'}', sans-serif`;
                        textarea.style.fontSize = `${(updatedNode.fontSize || 24) * stageScale}px`;
                        textarea.style.caretColor = adaptTextFill(updatedNode.fill, false);
                        autoExpand();
                    });

                    // Reads current styles from textarea.style so it picks up live changes
                    const autoExpand = () => {
                        const curFontSize = textarea.style.fontSize || `${currentFontSz * stageScale}px`;
                        const curFontFamily = textarea.style.fontFamily || `'${currentFontFam}', sans-serif`;
                        const curFontWeight = textarea.style.fontWeight || 'normal';
                        const lines = textarea.value.split('\n');
                        let maxWidth = 100;
                        lines.forEach(line => {
                            const tempSpan = document.createElement('span');
                            tempSpan.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:${curFontSize};font-family:${curFontFamily};font-weight:${curFontWeight};padding:0;`;
                            tempSpan.textContent = line || textarea.placeholder;
                            document.body.appendChild(tempSpan);
                            maxWidth = Math.max(maxWidth, tempSpan.offsetWidth + 30);
                            tempSpan.remove();
                        });
                        textarea.style.width = `${maxWidth}px`;
                        textarea.style.height = 'auto';
                        textarea.style.height = `${textarea.scrollHeight}px`;
                    };
                    textarea.addEventListener('input', () => syncLiveText(textarea, newNodeId, autoExpand));
                    autoExpand();
                    textarea.focus();

                    let textareaRemoved = false;
                    const removeTextarea = (save = true) => {
                        if (textareaRemoved) return;
                        textareaRemoved = true;
                        unsubStyleSync(); // Stop watching for style changes
                        if (save && textarea.value.trim()) {
                            updateNode(newNodeId, { text: textarea.value });
                        } else {
                            deleteNode(newNodeId);
                        }
                        textarea.remove();
                        showEditingTextNode();
                    };

                    textarea.addEventListener('blur', (e) => {
                        // If focus moved to the floating toolbar, don't close
                        const related = e.relatedTarget;
                        if (related) {
                            const toolbar = related.closest('[data-floating-toolbar]');
                            if (toolbar) {
                                // Re-focus textarea after toolbar interaction
                                setTimeout(() => { if (!textareaRemoved) textarea.focus(); }, 0);
                                return;
                            }
                        }
                        // Delay removal slightly to allow toolbar mousedown to re-focus
                        setTimeout(() => {
                            if (!textareaRemoved && !document.activeElement?.closest('[data-floating-toolbar]')) {
                                removeTextarea(true);
                            }
                        }, 150);
                    });
                    textarea.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) { e.preventDefault(); removeTextarea(true); return; }
                        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                            const res = listEnter(textarea.value, textarea.selectionStart);
                            if (res) {
                                e.preventDefault();
                                textarea.value = res.text;
                                textarea.selectionStart = textarea.selectionEnd = res.caret;
                                syncLiveText(textarea, newNodeId, autoExpand);
                                return;
                            }
                        }
                        if (e.key === 'Escape') { e.preventDefault(); removeTextarea(false); }
                    });
                }
            }, 50);
            return;
        }
    }, [tool, shapeType, strokeColor, penStrokeWidth, highlighterStrokeWidth, highlighterColor, addNode, beginStrokeNode, updateNode, deleteNode, clearSelection, selectNode, getPos, nodes, stageScale, textColor, hideEditingTextNode, showEditingTextNode]);

    const handleMouseMove = useCallback((e) => {
        // Manual panning — move the stage position by the mouse delta (middle button)
        if (isPanning.current) {
            const stage = stageRef.current;
            if (stage) {
                const pointer = stage.getPointerPosition();
                if (pointer) {
                    const dx = pointer.x - lastPointer.current.x;
                    const dy = pointer.y - lastPointer.current.y;
                    const pos = stage.position();
                    setStagePosition({
                        x: pos.x + dx,
                        y: pos.y + dy,
                    });
                    lastPointer.current = pointer;
                }
            }
            return;
        }
        const pos = getPos();
        if (!pos) return;

        // Rubber-band selection — update rectangle
        if (selectionRect && tool === 'select') {
            setSelectionRect({ ...selectionRect, currentX: pos.x, currentY: pos.y });
            return;
        }

        if (drawingShape && tool === 'shape') {
            setDrawingShape({ ...drawingShape, currentX: pos.x, currentY: pos.y });
            return;
        }

        if (isDrawing.current && (tool === 'pen' || tool === 'highlighter') && currentLineId.current) {
            const node = nodes.find(n => n.id === currentLineId.current);
            // Transient update — history/save happen once on mouseup
            if (node) updateNodeTransient(currentLineId.current, { points: [...node.points, pos.x, pos.y] });
            return;
        }

        // Laser pointer — accumulate points without touching store
        if (isDrawing.current && tool === 'laser' && laserCurrentId.current) {
            setLaserLines(prev => prev.map(l =>
                l.id === laserCurrentId.current
                    ? { ...l, points: [...l.points, pos.x, pos.y] }
                    : l
            ));
            return;
        }

        if (tool === 'eraser' && e.evt.buttons === 1) {
            const target = e.target;
            if (target !== target.getStage()) {
                const clickedId = target.id();
                const nodeData = nodes.find(n => n.id === clickedId);
                if (clickedId && nodeData && (nodeData.type === 'line' || nodeData.type === 'highlight')) {
                    deleteNode(clickedId);
                }
            }
        }
    }, [tool, nodes, updateNodeTransient, deleteNode, getPos, drawingShape, selectionRect, setStagePosition]);

    // Helper to compute bounding box for any node type
    const getNodeBounds = useCallback((node) => {
        const t = node.type;
        if (t === 'rectangle' || t === 'roundedRect' || t === 'image' || t === 'pdf' || t === 'audio' || t === 'video' || t === 'cloud') {
            return { x: node.x, y: node.y, width: node.width || 300, height: node.height || 80 };
        }
        if (t === 'circle' || t === 'triangle' || t === 'pentagon' || t === 'hexagon' || t === 'octagon') {
            const r = node.radius || 50;
            return { x: node.x - r, y: node.y - r, width: r * 2, height: r * 2 };
        }
        if (t === 'ellipse') {
            const rx = node.radiusX || 50, ry = node.radiusY || 50;
            return { x: node.x - rx, y: node.y - ry, width: rx * 2, height: ry * 2 };
        }
        if (t === 'star') {
            const r = node.outerRadius || 50;
            return { x: node.x - r, y: node.y - r, width: r * 2, height: r * 2 };
        }
        if (t === 'diamond' || t === 'heart' || t === 'cross') {
            const s = node.size || node.width || 50;
            return { x: node.x - s / 2, y: node.y - s / 2, width: s, height: node.height || s };
        }
        if (t === 'text') {
            return { x: node.x, y: node.y, width: node.width || 100, height: (node.fontSize || 24) * 1.5 };
        }
        if (t === 'youtube') {
            return { x: node.x, y: node.y, width: node.width || 480, height: node.height || 270 };
        }
        if (t === 'line' || t === 'highlight' || t === 'simpleLine' || t === 'arrow') {
            const pts = node.points || [];
            if (pts.length < 2) return { x: 0, y: 0, width: 0, height: 0 };
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (let i = 0; i < pts.length; i += 2) {
                minX = Math.min(minX, pts[i]);
                maxX = Math.max(maxX, pts[i]);
                minY = Math.min(minY, pts[i + 1]);
                maxY = Math.max(maxY, pts[i + 1]);
            }
            // Points are relative to the node's x/y offset (set when the line is dragged)
            return { x: minX + (node.x || 0), y: minY + (node.y || 0), width: maxX - minX, height: maxY - minY };
        }
        return { x: node.x || 0, y: node.y || 0, width: node.width || 50, height: node.height || 50 };
    }, []);

    const handleMouseUp = useCallback(() => {
        // Finalize rubber-band selection
        if (selectionRect) {
            const { startX, startY, currentX, currentY } = selectionRect;
            const selX = Math.min(startX, currentX);
            const selY = Math.min(startY, currentY);
            const selW = Math.abs(currentX - startX);
            const selH = Math.abs(currentY - startY);

            if (selW > 5 || selH > 5) {
                // Find nodes that intersect the selection rectangle
                const idsToSelect = [];
                nodes.forEach(node => {
                    if (node.locked) return; // Skip locked nodes
                    const bounds = getNodeBounds(node);
                    // Check overlap between selection rect and node bounds
                    const overlaps = (
                        selX < bounds.x + bounds.width &&
                        selX + selW > bounds.x &&
                        selY < bounds.y + bounds.height &&
                        selY + selH > bounds.y
                    );
                    if (overlaps) idsToSelect.push(node.id);
                });
                if (idsToSelect.length > 0) {
                    idsToSelect.forEach(id => selectNode(id, true));
                }
            }
            setSelectionRect(null);
        }

        if (drawingShape) {
            const { type, startX, startY, currentX, currentY } = drawingShape;
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);
            const x = Math.min(startX, currentX);
            const y = Math.min(startY, currentY);
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            const size = Math.max(20, Math.max(width, height));

            if (width > 5 || height > 5) {
                const baseProps = { fill: fillColor, stroke: strokeColor, strokeWidth: objectStrokeWidth };

                switch (type) {
                    case 'rectangle':
                        addNode({ type: 'rectangle', x, y, width: Math.max(20, width), height: Math.max(20, height), cornerRadius: storeCornerRadius, ...baseProps });
                        break;
                    case 'roundedRect':
                        addNode({ type: 'roundedRect', x, y, width: Math.max(20, width), height: Math.max(20, height), cornerRadius: storeCornerRadius || 15, ...baseProps });
                        break;
                    case 'circle':
                        addNode({ type: 'circle', x: centerX, y: centerY, radius: size / 2, ...baseProps });
                        break;
                    case 'ellipse':
                        addNode({ type: 'ellipse', x: centerX, y: centerY, radiusX: Math.max(10, width / 2), radiusY: Math.max(10, height / 2), ...baseProps });
                        break;
                    case 'triangle':
                        addNode({ type: 'triangle', x: centerX, y: centerY, radius: size / 2, ...baseProps });
                        break;
                    case 'star':
                        addNode({ type: 'star', x: centerX, y: centerY, innerRadius: size / 4, outerRadius: size / 2, numPoints: 5, ...baseProps });
                        break;
                    case 'arrow':
                        addNode({ type: 'arrow', points: [startX, startY, currentX, currentY], ...baseProps, pointerLength: 15, pointerWidth: 15 });
                        break;
                    case 'line':
                        addNode({ type: 'simpleLine', points: [startX, startY, currentX, currentY], ...baseProps });
                        break;
                    case 'diamond':
                        addNode({ type: 'diamond', x: centerX, y: centerY, width: Math.max(20, width), height: Math.max(20, height), ...baseProps });
                        break;
                    case 'pentagon':
                        addNode({ type: 'pentagon', x: centerX, y: centerY, radius: size / 2, ...baseProps });
                        break;
                    case 'hexagon':
                        addNode({ type: 'hexagon', x: centerX, y: centerY, radius: size / 2, ...baseProps });
                        break;
                    case 'octagon':
                        addNode({ type: 'octagon', x: centerX, y: centerY, radius: size / 2, ...baseProps });
                        break;
                    case 'heart':
                        addNode({ type: 'heart', x, y, width: Math.max(20, width), height: Math.max(20, height), ...baseProps });
                        break;
                    case 'rhombus':
                        addNode({ type: 'rhombus', x: centerX, y: centerY, width: Math.max(20, width), height: Math.max(20, height), cornerRadius: storeCornerRadius, ...baseProps });
                        break;
                    case 'cloud':
                        addNode({ type: 'cloud', x, y, width: Math.max(40, width), height: Math.max(30, height), ...baseProps });
                        break;
                    case 'cross':
                        addNode({ type: 'cross', x: centerX, y: centerY, size: size, ...baseProps });
                        break;
                    case 'doubleArrow':
                        addNode({ type: 'arrow', points: [startX, startY, currentX, currentY], ...baseProps, pointerLength: 15, pointerWidth: 15, doubleArrow: true });
                        break;
                    case 'dashedLine':
                        addNode({ type: 'simpleLine', points: [startX, startY, currentX, currentY], ...baseProps, dash: [12, 8] });
                        break;
                    case 'dottedLine':
                        addNode({ type: 'simpleLine', points: [startX, startY, currentX, currentY], ...baseProps, dash: [2, 10] });
                        break;
                    case 'parallelogram':
                    case 'trapezoid':
                    case 'rightTriangle':
                        addNode({ type, x: centerX, y: centerY, width: Math.max(20, width), height: Math.max(20, height), ...baseProps });
                        break;
                    case 'frame':
                        addNode({ type: 'frame', x, y, width: Math.max(60, width), height: Math.max(60, height), label: 'Frame', stroke: '#6366f1', strokeWidth: 2 });
                        break;
                }
            }
            setDrawingShape(null);
        }

        // Laser pointer — start fade
        if (tool === 'laser' && laserCurrentId.current) {
            const fadeId = laserCurrentId.current;
            laserCurrentId.current = null;
            const fadeInterval = setInterval(() => {
                setLaserLines(prev => {
                    const updated = prev.map(l =>
                        l.id === fadeId ? { ...l, opacity: l.opacity - 0.05 } : l
                    ).filter(l => l.opacity > 0);
                    if (!updated.find(l => l.id === fadeId)) clearInterval(fadeInterval);
                    return updated;
                });
            }, 100);
        }

        // Commit a finished pen/highlighter stroke as a single history/save step
        if (currentLineId.current) {
            commitTransient();
        }

        isDrawing.current = false;
        currentLineId.current = null;
        isPanning.current = false;
    }, [drawingShape, selectionRect, nodes, getNodeBounds, selectNode, addNode, commitTransient, fillColor, strokeColor, objectStrokeWidth, storeCornerRadius, tool]);

    const handleClick = useCallback((e, id) => {
        // Only respond to left mouse button
        if (e.evt && e.evt.button !== 0) return;
        e.cancelBubble = true;
        // Selection is handled in onMouseDown for instant feedback.
        // handleClick only handles tool-specific actions like eraser.
        if (tool === 'eraser') {
            const nodeData = nodes.find(n => n.id === id);
            if (nodeData && (nodeData.type === 'line' || nodeData.type === 'highlight')) {
                deleteNode(id);
            }
        }
    }, [deleteNode, tool, nodes]);

    const handleDblClick = useCallback((e, node) => {
        // Only respond to left mouse button
        if (e.evt && e.evt.button !== 0) return;
        e.cancelBubble = true;

        // YouTube - play video inline inside the node box
        if (node.type === 'youtube' && node.videoId) {
            updateNode(node.id, { playing: !node.playing });
            return;
        }

        // Audio - play audio inline
        if (node.type === 'audio' && node.src) {
            updateNode(node.id, { playing: !node.playing });
            return;
        }

        // Video - play video file inline
        if (node.type === 'video' && node.src) {
            updateNode(node.id, { playing: !node.playing });
            return;
        }

        // Text & Sticky - edit on double-click
        if (node.type !== 'text' && node.type !== 'sticky') return;

        // Clean up any previous text editing overlay
        const oldToolbar = document.getElementById('text-format-toolbar');
        if (oldToolbar) oldToolbar.remove();
        document.querySelectorAll('textarea[data-text-editor]').forEach(el => el.remove());

        // Grab position data BEFORE hiding the Konva node
        const stage = stageRef.current;
        const textNode = layerRef.current.findOne(`#${node.id}`);
        if (!stage || !textNode) return;

        const textPosition = textNode.absolutePosition();
        const areaPosition = { x: stage.container().offsetLeft + textPosition.x, y: stage.container().offsetTop + textPosition.y };

        // Mark this node as being edited (it stays visible and is live-synced)
        hideEditingTextNode(node.id);

        // Create textarea - expands horizontally
        const textarea = document.createElement('textarea');
        textarea.setAttribute('data-text-editor', 'true');
        textarea.setAttribute('data-editing-node-id', node.id);
        document.body.appendChild(textarea);
        textarea.value = node.text;
        textarea.placeholder = 'Type something';
        textarea.rows = 1;
        const _fs = node.fontSize || 24;
        const _ff = node.fontFamily || 'Arial';
        const _style = node.fontStyle || 'normal';
        // For sticky notes, use textColor; for text nodes, use fill
        const _color = adaptTextFill(node.type === 'sticky' ? node.textColor : node.fill, node.type === 'sticky');
        const _align = node.align || 'left';
        const _bold = _style.includes('bold');
        const _italic = _style.includes('italic');
        const _under = node.textDecoration === 'underline';
        const _strike = node.textDecoration === 'line-through';
        textarea.style.cssText = `
            position: absolute;
            top: ${areaPosition.y - 2}px;
            left: ${areaPosition.x - 2}px;
            min-width: 100px;
            width: auto;
            font-size: ${_fs * stageScale}px;
            border: 2px solid #0ea5e9;
            padding: 2px 4px;
            background: transparent;
            color: transparent;
            caret-color: ${_color};
            outline: none;
            resize: none;
            line-height: 1;
            font-family: '${_ff}', sans-serif;
            z-index: 1000;
            border-radius: 2px;
            font-weight: ${_bold ? 'bold' : 'normal'};
            font-style: ${_italic ? 'italic' : 'normal'};
            text-decoration: ${_strike ? 'line-through' : _under ? 'underline' : 'none'};
            text-align: ${_align};
            white-space: pre-wrap;
            word-wrap: break-word;
            scrollbar-width: none;
            -ms-overflow-style: none;
            box-sizing: border-box;
        `;

        // Sticky note-specific overrides for textarea sizing
        if (node.type === 'sticky') {
            textarea.style.top = `${areaPosition.y + 14 * stageScale}px`;
            textarea.style.left = `${areaPosition.x + 14 * stageScale}px`;
            textarea.style.width = `${(node.width - 28) * stageScale}px`;
            textarea.style.minWidth = '0px';
            textarea.style.border = 'none';
        }
        textarea.style.setProperty('-webkit-scrollbar', 'none');

        // Keep the textarea's font metrics in sync with toolbar style changes so
        // the (invisible) caret stays aligned with the live Konva text underneath.
        const unsubStyleSync = useStore.subscribe((state) => {
            const updatedNode = state.nodes.find(n => n.id === node.id);
            if (!updatedNode || textareaRemoved) return;
            const fs = updatedNode.fontStyle || 'normal';
            textarea.style.fontWeight = fs.includes('bold') ? 'bold' : 'normal';
            textarea.style.fontStyle = fs.includes('italic') ? 'italic' : 'normal';
            textarea.style.fontFamily = `'${updatedNode.fontFamily || 'Arial'}', sans-serif`;
            textarea.style.fontSize = `${(updatedNode.fontSize || 24) * stageScale}px`;
            textarea.style.caretColor = adaptTextFill(updatedNode.type === 'sticky' ? updatedNode.textColor : updatedNode.fill, updatedNode.type === 'sticky');
            autoExpand();
        });
        let textareaRemoved = false;

        // Auto-expand width and height as user types
        // Reads current styles from textarea.style so it picks up live changes from FloatingTextToolbar
        const autoExpand = () => {
            // Stickies shrink their text to fit the card; mirror that here so the
            // caret tracks the rendered text as list lines pile up.
            if (node.type === 'sticky') {
                const fitted = fitStickyFontSize(textarea.value, node.width, node.height, node.fontSize || 18);
                textarea.style.fontSize = `${fitted * stageScale}px`;
            }
            const currentFontSize = textarea.style.fontSize || `${_fs * stageScale}px`;
            const currentFontFamily = textarea.style.fontFamily || `'${_ff}', sans-serif`;
            const currentFontWeight = textarea.style.fontWeight || 'normal';
            const lines = textarea.value.split('\n');
            let maxWidth = 100;
            lines.forEach(line => {
                const tempSpan = document.createElement('span');
                tempSpan.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:${currentFontSize};font-family:${currentFontFamily};font-weight:${currentFontWeight};padding:0;`;
                tempSpan.textContent = line || textarea.placeholder;
                document.body.appendChild(tempSpan);
                maxWidth = Math.max(maxWidth, tempSpan.offsetWidth + 30);
                tempSpan.remove();
            });

            // Limit width for sticky notes to prevent overflowing the card
            if (node.type === 'sticky') {
                const stickyMaxW = (node.width - 24) * stageScale;
                maxWidth = Math.min(maxWidth, stickyMaxW);
            }

            textarea.style.width = `${maxWidth}px`;

            // Expand height using scrollHeight
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        };
        textarea.addEventListener('input', () => syncLiveText(textarea, node.id, autoExpand));
        autoExpand();
        textarea.focus();
        textarea.select();

        const removeTextarea = (save = true) => {
            if (textareaRemoved) return;
            textareaRemoved = true;
            unsubStyleSync(); // Stop watching for style changes
            // Commit the final text, or revert to the original on Escape. The node
            // stayed visible and live-synced throughout, so this records one entry.
            updateNode(node.id, { text: save ? textarea.value : node.text });
            textarea.remove();
            showEditingTextNode();
        };

        textarea.addEventListener('blur', (e) => {
            // If focus moved to the floating toolbar, don't close
            const related = e.relatedTarget;
            if (related) {
                const toolbar = related.closest('[data-floating-toolbar]');
                if (toolbar) {
                    setTimeout(() => { if (!textareaRemoved) textarea.focus(); }, 0);
                    return;
                }
            }
            setTimeout(() => {
                if (!textareaRemoved && !document.activeElement?.closest('[data-floating-toolbar]')) {
                    removeTextarea(true);
                }
            }, 150);
        });
        textarea.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' && (e.ctrlKey || e.shiftKey))) { e.preventDefault(); removeTextarea(true); return; }
            if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                const res = listEnter(textarea.value, textarea.selectionStart);
                if (res) {
                    e.preventDefault();
                    textarea.value = res.text;
                    textarea.selectionStart = textarea.selectionEnd = res.caret;
                    syncLiveText(textarea, node.id, autoExpand);
                    return;
                }
            }
            if (e.key === 'Escape') { e.preventDefault(); removeTextarea(false); }
        });
    }, [updateNode, stageScale, hideEditingTextNode, showEditingTextNode]);

    const handleDragEnd = useCallback((e, id) => {
        // If this node is part of a multi-selection, update all selected nodes
        if (selectedNodeIds.length > 1 && selectedNodeIds.includes(id)) {
            const layer = layerRef.current;
            if (layer) {
                selectedNodeIds.forEach((nodeId) => {
                    const konvaNode = layer.findOne(`#${nodeId}`);
                    if (konvaNode) {
                        updateNode(nodeId, { x: konvaNode.x(), y: konvaNode.y() });
                    }
                });
            }
        } else {
            updateNode(id, { x: e.target.x(), y: e.target.y() });
        }
        dragStartPositions.current = {};
    }, [updateNode, selectedNodeIds]);

    const handleTransformEnd = useCallback((e, id, type) => {
        const n = e.target;
        const sx = n.scaleX(), sy = n.scaleY();
        n.scaleX(1); n.scaleY(1);

        if (['rectangle', 'roundedRect', 'image', 'youtube', 'diamond', 'audio', 'video', 'pdf', 'cloud', 'rhombus', 'heart', 'parallelogram', 'trapezoid', 'rightTriangle'].includes(type)) {
            const nodeData = nodes.find(nd => nd.id === id);
            const origW = nodeData ? (nodeData.width || nodeData.size || 300) : (n.width() || 300);
            const origH = nodeData ? (nodeData.height || nodeData.size || 80) : (n.height() || 80);
            updateNode(id, { x: n.x(), y: n.y(), width: Math.max(20, origW * sx), height: Math.max(20, origH * sy) });
        } else if (['circle', 'triangle', 'pentagon', 'hexagon', 'octagon'].includes(type)) {
            updateNode(id, { x: n.x(), y: n.y(), radius: Math.max(10, n.radius() * Math.max(sx, sy)) });
        } else if (type === 'ellipse') {
            updateNode(id, { x: n.x(), y: n.y(), radiusX: Math.max(10, n.radiusX() * sx), radiusY: Math.max(10, n.radiusY() * sy) });
        } else if (type === 'star') {
            updateNode(id, { x: n.x(), y: n.y(), innerRadius: Math.max(5, n.innerRadius() * Math.max(sx, sy)), outerRadius: Math.max(10, n.outerRadius() * Math.max(sx, sy)) });
        } else if (type === 'cross') {
            const nodeData = nodes.find(nd => nd.id === id);
            const origSize = nodeData?.size || 100;
            updateNode(id, { x: n.x(), y: n.y(), size: Math.max(20, origSize * Math.max(sx, sy)) });
        } else if (type === 'text') {
            // n may be a Group (multi-colour rich text) with no fontSize(); read from store
            const nodeData = nodes.find(nd => nd.id === id);
            const baseFs = nodeData?.fontSize || (typeof n.fontSize === 'function' ? n.fontSize() : 24);
            updateNode(id, { x: n.x(), y: n.y(), fontSize: Math.max(8, Math.round(baseFs * sy)) });
        } else if (type === 'sticky') {
            const nodeData = nodes.find(nd => nd.id === id);
            const origW = nodeData?.width || 150;
            const origH = nodeData?.height || 150;
            updateNode(id, { x: n.x(), y: n.y(), width: Math.max(60, origW * sx), height: Math.max(60, origH * sy) });
        } else if (type === 'arrow' || type === 'simpleLine') {
            const nodeData = nodes.find(nd => nd.id === id);
            if (nodeData?.points) {
                const scaledPoints = nodeData.points.map((val, i) => i % 2 === 0 ? val * sx : val * sy);
                updateNode(id, { x: n.x(), y: n.y(), points: scaledPoints });
            }
        }
    }, [updateNode, nodes]);

    const renderNode = (node) => {
        // When using drawing tools, make nodes non-interactive so clicks pass through
        const isDrawingTool = tool === 'shape' || tool === 'text' || tool === 'pen' || tool === 'highlighter' || tool === 'laser' || tool === 'sticky' || tool === 'frame' || tool === 'comment';

        const props = {
            id: node.id,
            draggable: tool === 'select' && !node.locked,
            listening: !isDrawingTool,
            opacity: node.opacity ?? 1,
            onClick: (e) => handleClick(e, node.id),
            onTap: (e) => handleClick(e, node.id),
            onDblClick: (e) => handleDblClick(e, node),
            onDblTap: (e) => handleDblClick(e, node),
            onContextMenu: (e) => {
                e.evt?.preventDefault();
                const stage = stageRef.current;
                if (!stage) return;
                const pointer = stage.getPointerPosition();
                showContextMenu(pointer.x, pointer.y, node.id);
            },
            onMouseDown: (e) => {
                // Track button and prevent drag for non-left buttons
                const button = e.evt ? e.evt.button : 0;
                mouseButtonRef.current = button;
                if (button === 1) {
                    // Middle button: stop node drag but let event bubble to stage for panning
                    if (e.target && e.target.stopDrag) {
                        e.target.stopDrag();
                    }
                } else if (button !== 0) {
                    // Right-click or other: block entirely
                    e.cancelBubble = true;
                    if (e.target && e.target.stopDrag) {
                        e.target.stopDrag();
                    }
                } else if (tool === 'select') {
                    // Don't select locked nodes
                    if (node.locked) return;
                    // Select (highlight) immediately on mousedown so drag is seamless
                    e.cancelBubble = true; // Prevent stage mousedown from firing
                    const isMulti = e.evt?.shiftKey || e.evt?.ctrlKey || e.evt?.metaKey || false;
                    const alreadySelected = selectedNodeIds.includes(node.id);
                    // If node is already in a multi-selection, don't re-select (preserve group for drag)
                    if (alreadySelected && selectedNodeIds.length > 1 && !isMulti) {
                        // Keep current selection — allows group drag
                    } else {
                        selectNode(node.id, isMulti);
                    }
                }
            },
            onDragStart: () => {
                // Record starting positions of ALL selected nodes for group drag
                if (selectedNodeIds.length > 1 && selectedNodeIds.includes(node.id)) {
                    const layer = layerRef.current;
                    if (layer) {
                        const positions = {};
                        selectedNodeIds.forEach((id) => {
                            const konvaNode = layer.findOne(`#${id}`);
                            if (konvaNode) {
                                positions[id] = { x: konvaNode.x(), y: konvaNode.y() };
                            }
                        });
                        dragStartPositions.current = positions;
                    }
                }
            },
            onDragMove: (e) => {
                // Move all other selected nodes by the same delta
                const positions = dragStartPositions.current;
                if (Object.keys(positions).length > 1 && selectedNodeIds.includes(node.id)) {
                    const draggedStart = positions[node.id];
                    if (!draggedStart) return;
                    const dx = e.target.x() - draggedStart.x;
                    const dy = e.target.y() - draggedStart.y;
                    const layer = layerRef.current;
                    if (layer) {
                        selectedNodeIds.forEach((id) => {
                            if (id !== node.id && positions[id]) {
                                const konvaNode = layer.findOne(`#${id}`);
                                if (konvaNode) {
                                    konvaNode.x(positions[id].x + dx);
                                    konvaNode.y(positions[id].y + dy);
                                }
                            }
                        });
                        layer.batchDraw();
                    }
                }
            },
            onDragEnd: (e) => handleDragEnd(e, node.id),
            onTransformEnd: (e) => handleTransformEnd(e, node.id, node.type),
        };

        switch (node.type) {
            case 'rectangle':
                return <Rect {...props} x={node.x} y={node.y} width={node.width} height={node.height} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} cornerRadius={node.cornerRadius || 4} />;
            case 'roundedRect':
                return <Rect {...props} x={node.x} y={node.y} width={node.width} height={node.height} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} cornerRadius={node.cornerRadius || 15} />;
            case 'circle':
                return <Circle {...props} x={node.x} y={node.y} radius={node.radius} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            case 'ellipse':
                return <Ellipse {...props} x={node.x} y={node.y} radiusX={node.radiusX} radiusY={node.radiusY} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            case 'triangle':
                return <RegularPolygon {...props} x={node.x} y={node.y} sides={3} radius={node.radius} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            case 'star':
                return <KonvaStar {...props} x={node.x} y={node.y} numPoints={node.numPoints || 5} innerRadius={node.innerRadius} outerRadius={node.outerRadius} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            case 'arrow':
                return <Arrow {...props} x={node.x || 0} y={node.y || 0} points={node.points} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} hitStrokeWidth={Math.max(20, (node.strokeWidth || 2) * 2)} pointerLength={node.pointerLength} pointerWidth={node.pointerWidth} pointerAtBeginning={!!node.doubleArrow} dash={node.dash} />;
            case 'simpleLine':
                return <Line {...props} x={node.x || 0} y={node.y || 0} points={node.points} stroke={node.stroke} strokeWidth={node.strokeWidth} hitStrokeWidth={Math.max(20, node.strokeWidth * 2)} lineCap="round" dash={node.dash} />;
            case 'parallelogram': {
                const w = node.width, h = node.height, s = w * 0.25;
                return <Line {...props} x={node.x} y={node.y} points={[-w / 2 + s, -h / 2, w / 2, -h / 2, w / 2 - s, h / 2, -w / 2, h / 2]} closed fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            }
            case 'trapezoid': {
                const w = node.width, h = node.height, s = w * 0.2;
                return <Line {...props} x={node.x} y={node.y} points={[-w / 2 + s, -h / 2, w / 2 - s, -h / 2, w / 2, h / 2, -w / 2, h / 2]} closed fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            }
            case 'rightTriangle': {
                const w = node.width, h = node.height;
                return <Line {...props} x={node.x} y={node.y} points={[-w / 2, -h / 2, -w / 2, h / 2, w / 2, h / 2]} closed fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            }
            case 'diamond': {
                const hw = node.width / 2, hh = node.height / 2;
                return <Line {...props} x={node.x} y={node.y} points={[0, -hh, hw, 0, 0, hh, -hw, 0]} closed fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            }
            case 'pentagon':
                return <RegularPolygon {...props} x={node.x} y={node.y} sides={5} radius={node.radius} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            case 'hexagon':
                return <RegularPolygon {...props} x={node.x} y={node.y} sides={6} radius={node.radius} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            case 'octagon':
                return <RegularPolygon {...props} x={node.x} y={node.y} sides={8} radius={node.radius} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            case 'heart': {
                // Convert size-based to width/height for proper Transformer bounds
                const heartW = node.width || node.size || 100;
                const heartH = node.height || node.size || 100;
                return (
                    <Shape
                        {...props}
                        sceneFunc={(ctx, shape) => {
                            const w = heartW;
                            const h = heartH;
                            // Draw heart within 0,0 to w,h bounding box
                            ctx.beginPath();
                            ctx.moveTo(w / 2, h * 0.2);
                            ctx.bezierCurveTo(w / 2, 0, 0, 0, 0, h * 0.35);
                            ctx.bezierCurveTo(0, h * 0.6, w / 2, h * 0.8, w / 2, h);
                            ctx.bezierCurveTo(w / 2, h * 0.8, w, h * 0.6, w, h * 0.35);
                            ctx.bezierCurveTo(w, 0, w / 2, 0, w / 2, h * 0.2);
                            ctx.closePath();
                            ctx.fillStrokeShape(shape);
                        }}
                        x={node.x}
                        y={node.y}
                        width={heartW}
                        height={heartH}
                        fill={node.fill}
                        stroke={node.stroke}
                        strokeWidth={node.strokeWidth}
                    />
                );
            }
            case 'rhombus':
                return (
                    <Rect
                        {...props}
                        x={node.x}
                        y={node.y}
                        width={node.width}
                        height={node.height}
                        fill={node.fill}
                        stroke={node.stroke}
                        strokeWidth={node.strokeWidth}
                        cornerRadius={node.cornerRadius || 4}
                        rotation={45}
                        offsetX={node.width / 2}
                        offsetY={node.height / 2}
                    />
                );
            case 'cloud':
                return (
                    <Shape
                        {...props}
                        sceneFunc={(ctx, shape) => {
                            const w = node.width;
                            const h = node.height;
                            // Draw cloud within 0,0 to w,h bounding box
                            ctx.beginPath();
                            ctx.moveTo(w * 0.2, h * 0.75);
                            ctx.bezierCurveTo(w * 0.0, h * 0.75, -w * 0.02, h * 0.5, w * 0.15, h * 0.35);
                            ctx.bezierCurveTo(w * 0.05, h * 0.1, w * 0.25, 0, w * 0.45, h * 0.1);
                            ctx.bezierCurveTo(w * 0.55, -h * 0.02, w * 0.75, h * 0.05, w * 0.8, h * 0.25);
                            ctx.bezierCurveTo(w * 1.02, h * 0.3, w * 1.02, h * 0.7, w * 0.8, h * 0.75);
                            ctx.closePath();
                            ctx.fillStrokeShape(shape);
                        }}
                        x={node.x}
                        y={node.y}
                        width={node.width}
                        height={node.height}
                        fill={node.fill}
                        stroke={node.stroke}
                        strokeWidth={node.strokeWidth}
                    />
                );
            case 'cross': {
                const cs = node.size / 2;
                const cw = cs * 0.35;
                return (
                    <Line
                        {...props}
                        x={node.x}
                        y={node.y}
                        points={[-cw, -cs, cw, -cs, cw, -cw, cs, -cw, cs, cw, cw, cw, cw, cs, -cw, cs, -cw, cw, -cs, cw, -cs, -cw, -cw, -cw]}
                        closed
                        fill={node.fill}
                        stroke={node.stroke}
                        strokeWidth={node.strokeWidth}
                    />
                );
            }
            case 'text': {
                const textOpacity = node.opacity ?? 1;
                const textListening = props.listening;
                // Multi-colour text renders as a group of per-run Text elements
                if (node.colorSegments && node.colorSegments.length > 1 && !node.textHighlight) {
                    return <RichTextNode key={node.id} node={node} commonProps={props} isDark={isDarkTheme} />;
                }
                if (node.textHighlight) {
                    return (
                        <Group {...props} listening={textListening}>
                            <Rect
                                x={node.x - 2}
                                y={node.y - 1}
                                width={(node.text || 'Text').length * (node.fontSize || 24) * 0.6 + 8}
                                height={(node.fontSize || 24) * 1.4 + 4}
                                fill="#ffeb3b"
                                cornerRadius={2}
                                opacity={textOpacity}
                                listening={false}
                            />
                            <Text
                                x={node.x}
                                y={node.y}
                                text={node.text}
                                fontSize={node.fontSize}
                                fill={adaptTextFill(node.fill, false)}
                                fontFamily={node.fontFamily || 'Arial'}
                                fontStyle={node.fontStyle || 'normal'}
                                textDecoration={node.textDecoration || ''}
                                align={node.align || 'left'}
                                opacity={textOpacity}
                            />
                        </Group>
                    );
                }
                return (
                    <Text
                        {...props}
                        x={node.x}
                        y={node.y}
                        text={node.text}
                        fontSize={node.fontSize}
                        fill={adaptTextFill(node.fill, false)}
                        fontFamily={node.fontFamily || 'Arial'}
                        fontStyle={node.fontStyle || 'normal'}
                        textDecoration={node.textDecoration || ''}
                        align={node.align || 'left'}
                        opacity={textOpacity}
                        listening={textListening}
                    />
                );
            }
            case 'line':
                return <Line {...props} x={node.x || 0} y={node.y || 0} points={node.points} stroke={node.stroke} strokeWidth={node.strokeWidth} hitStrokeWidth={Math.max(20, node.strokeWidth * 2)} lineCap="round" lineJoin="round" tension={0.5} />;
            case 'highlight':
                return <Line {...props} x={node.x || 0} y={node.y || 0} points={node.points} stroke={node.stroke} strokeWidth={node.strokeWidth} hitStrokeWidth={Math.max(30, node.strokeWidth * 2)} lineCap="round" lineJoin="round" tension={0.5} opacity={node.opacity || 0.4} />;
            case 'image':
                return <ImageNode key={node.id} node={node} commonProps={props} />;
            case 'youtube':
                return <YoutubeNode key={node.id} node={node} commonProps={props} />;
            case 'audio':
                return <AudioNode key={node.id} node={node} commonProps={props} />;
            case 'video':
                return <VideoNode key={node.id} node={node} commonProps={props} />;
            case 'pdf':
                return <PdfDocumentNode key={node.id} node={node} commonProps={props} />;
            case 'sticky': {
                const stickyText = node.text || '';
                const pad = 14;
                const maxW = node.width - pad * 2;
                const maxH = node.height - pad * 2;
                // Shrink the font (same calc as the edit overlay) so long /
                // list-heavy notes stay inside the card.
                const stickyFontSize = fitStickyFontSize(stickyText, node.width, node.height, node.fontSize || 18);
                return (
                    <Group {...props} x={node.x} y={node.y}>
                        <Rect
                            width={node.width}
                            height={node.height}
                            fill={node.fill || '#fef08a'}
                            cornerRadius={4}
                            shadowColor="rgba(0,0,0,0.15)"
                            shadowBlur={8}
                            shadowOffset={{ x: 2, y: 2 }}
                        />
                        {/* Fold corner */}
                        <Shape
                            sceneFunc={(ctx, shape) => {
                                const s = 16;
                                ctx.beginPath();
                                ctx.moveTo(node.width - s, 0);
                                ctx.lineTo(node.width, 0);
                                ctx.lineTo(node.width, s);
                                ctx.closePath();
                                ctx.fillStrokeShape(shape);
                            }}
                            fill="rgba(0,0,0,0.06)"
                        />
                        {stickyText && node.colorSegments && node.colorSegments.length > 1 ? (
                            <Group x={pad} y={pad}>
                                {wrappedRichRuns(
                                    stickyText,
                                    charAttrsFromSegments(node.colorSegments, stickyText.length, adaptedBase(node)),
                                    adaptedBase(node).fontSize,
                                    maxW
                                )}
                            </Group>
                        ) : (
                            <Text
                                text={stickyText || (node.id === editingNodeId ? '' : 'Double-click to edit')}
                                width={maxW}
                                height={maxH}
                                x={pad}
                                y={pad}
                                fontSize={stickyFontSize}
                                fill={stickyText ? adaptTextFill(node.textColor, true) : '#aaa'}
                                fontFamily={node.fontFamily || 'Arial'}
                                fontStyle={node.fontStyle || 'normal'}
                                textDecoration={node.textDecoration || 'none'}
                                wrap="word"
                                align={node.align || 'left'}
                                verticalAlign="top"
                            />
                        )}
                        {node.locked && (
                            <Text text="🔒" x={node.width - 22} y={4} fontSize={14} />
                        )}
                    </Group>
                );
            }
            case 'frame':
                return (
                    <Group {...props} x={node.x} y={node.y}>
                        <Rect
                            width={node.width}
                            height={node.height}
                            stroke={node.stroke || '#6366f1'}
                            strokeWidth={node.strokeWidth || 2}
                            dash={[10, 5]}
                            cornerRadius={8}
                        />
                        <Text
                            text={node.label || 'Frame'}
                            x={8}
                            y={-20}
                            fontSize={13}
                            fill={node.stroke || '#6366f1'}
                            fontFamily="Arial"
                            fontStyle="bold"
                        />
                    </Group>
                );
            default:
                return null;
        }
    };

    const renderDrawingPreview = () => {
        if (!drawingShape) return null;
        const { type, startX, startY, currentX, currentY } = drawingShape;
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const size = Math.max(width, height);
        const previewProps = { fill: fillColor, stroke: strokeColor, strokeWidth: objectStrokeWidth, opacity: 0.6 };

        switch (type) {
            case 'rectangle':
                return <Rect x={x} y={y} width={width} height={height} {...previewProps} cornerRadius={storeCornerRadius || 4} />;
            case 'roundedRect':
                return <Rect x={x} y={y} width={width} height={height} {...previewProps} cornerRadius={storeCornerRadius || 15} />;
            case 'circle':
                return <Circle x={centerX} y={centerY} radius={size / 2} {...previewProps} />;
            case 'ellipse':
                return <Ellipse x={centerX} y={centerY} radiusX={width / 2} radiusY={height / 2} {...previewProps} />;
            case 'triangle':
                return <RegularPolygon x={centerX} y={centerY} sides={3} radius={size / 2} {...previewProps} />;
            case 'star':
                return <KonvaStar x={centerX} y={centerY} numPoints={5} innerRadius={size / 4} outerRadius={size / 2} {...previewProps} />;
            case 'arrow':
                return <Arrow points={[startX, startY, currentX, currentY]} {...previewProps} pointerLength={15} pointerWidth={15} />;
            case 'line':
                return <Line points={[startX, startY, currentX, currentY]} {...previewProps} lineCap="round" />;
            case 'diamond':
                return <Line x={centerX} y={centerY} points={[0, -height / 2, width / 2, 0, 0, height / 2, -width / 2, 0]} closed {...previewProps} />;
            case 'pentagon':
                return <RegularPolygon x={centerX} y={centerY} sides={5} radius={size / 2} {...previewProps} />;
            case 'hexagon':
                return <RegularPolygon x={centerX} y={centerY} sides={6} radius={size / 2} {...previewProps} />;
            case 'octagon':
                return <RegularPolygon x={centerX} y={centerY} sides={8} radius={size / 2} {...previewProps} />;
            case 'heart':
                return (
                    <Shape
                        sceneFunc={(ctx, shape) => {
                            const s = size * 0.5;
                            ctx.beginPath();
                            ctx.moveTo(0, -s * 0.35);
                            ctx.bezierCurveTo(0, -s * 0.65, -s * 0.55, -s * 0.85, -s * 0.55, -s * 0.35);
                            ctx.bezierCurveTo(-s * 0.55, s * 0.05, 0, s * 0.35, 0, s * 0.65);
                            ctx.bezierCurveTo(0, s * 0.35, s * 0.55, s * 0.05, s * 0.55, -s * 0.35);
                            ctx.bezierCurveTo(s * 0.55, -s * 0.85, 0, -s * 0.65, 0, -s * 0.35);
                            ctx.closePath();
                            ctx.fillStrokeShape(shape);
                        }}
                        x={centerX}
                        y={centerY}
                        {...previewProps}
                    />
                );
            case 'rhombus':
                return <Rect x={centerX} y={centerY} width={width} height={height} {...previewProps} cornerRadius={storeCornerRadius || 4} rotation={45} offsetX={width / 2} offsetY={height / 2} />;
            case 'cloud':
                return (
                    <Shape
                        sceneFunc={(ctx, shape) => {
                            const w = width / 2;
                            const h = height / 2;
                            ctx.beginPath();
                            ctx.moveTo(-w * 0.3, h * 0.5);
                            ctx.bezierCurveTo(-w * 0.8, h * 0.5, -w, 0, -w * 0.6, -h * 0.3);
                            ctx.bezierCurveTo(-w * 0.8, -h * 0.8, -w * 0.2, -h, 0, -h * 0.6);
                            ctx.bezierCurveTo(w * 0.3, -h, w * 0.8, -h * 0.6, w * 0.7, -h * 0.2);
                            ctx.bezierCurveTo(w, 0, w * 0.9, h * 0.5, w * 0.4, h * 0.5);
                            ctx.closePath();
                            ctx.fillStrokeShape(shape);
                        }}
                        x={centerX}
                        y={centerY}
                        {...previewProps}
                    />
                );
            case 'cross': {
                const cs = size / 2;
                const cw = cs * 0.35;
                return <Line x={centerX} y={centerY} points={[-cw, -cs, cw, -cs, cw, -cw, cs, -cw, cs, cw, cw, cw, cw, cs, -cw, cs, -cw, cw, -cs, cw, -cs, -cw, -cw, -cw]} closed {...previewProps} />;
            }
            case 'doubleArrow':
                return <Arrow points={[startX, startY, currentX, currentY]} {...previewProps} pointerLength={15} pointerWidth={15} pointerAtBeginning />;
            case 'dashedLine':
                return <Line points={[startX, startY, currentX, currentY]} {...previewProps} lineCap="round" dash={[12, 8]} />;
            case 'dottedLine':
                return <Line points={[startX, startY, currentX, currentY]} {...previewProps} lineCap="round" dash={[2, 10]} />;
            case 'parallelogram': {
                const s = width * 0.25;
                return <Line x={centerX} y={centerY} points={[-width / 2 + s, -height / 2, width / 2, -height / 2, width / 2 - s, height / 2, -width / 2, height / 2]} closed {...previewProps} />;
            }
            case 'trapezoid': {
                const s = width * 0.2;
                return <Line x={centerX} y={centerY} points={[-width / 2 + s, -height / 2, width / 2 - s, -height / 2, width / 2, height / 2, -width / 2, height / 2]} closed {...previewProps} />;
            }
            case 'rightTriangle':
                return <Line x={centerX} y={centerY} points={[-width / 2, -height / 2, -width / 2, height / 2, width / 2, height / 2]} closed {...previewProps} />;
            default:
                return null;
        }
    };

    const getCursor = () => {
        if (tool === 'eraser') {
            // A bare eraser glyph — the eraser block and its crease only, without
            // the surface line beneath it.
            return `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="m5 11 9 9"/></svg>') 5 19, auto`;
        }
        if (tool === 'pen') {
            const colorHex = encodeURIComponent(strokeColor);
            const size = Math.max(4, Math.min(penStrokeWidth * 2, 24));
            const r = size / 2;
            return `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${size + 2}" height="${size + 2}" viewBox="0 0 ${size + 2} ${size + 2}"><circle cx="${r + 1}" cy="${r + 1}" r="${r}" fill="${colorHex}" stroke="%23333" stroke-width="0.5"/></svg>') ${r + 1} ${r + 1}, crosshair`;
        }
        if (tool === 'highlighter') {
            const colorHex = encodeURIComponent(highlighterColor);
            const size = Math.max(8, Math.min(highlighterStrokeWidth, 30));
            const r = size / 2;
            return `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${size + 2}" height="${size + 2}" viewBox="0 0 ${size + 2} ${size + 2}"><circle cx="${r + 1}" cy="${r + 1}" r="${r}" fill="${colorHex}" fill-opacity="0.5" stroke="%23333" stroke-width="0.5"/></svg>') ${r + 1} ${r + 1}, crosshair`;
        }
        if (tool === 'laser') {
            // A solid red dot the size of the user-set laser width (same idea as
            // the highlighter cursor) instead of a crosshair.
            const size = Math.max(6, Math.min(laserStrokeWidth, 48));
            const r = size / 2;
            return `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${size + 2}" height="${size + 2}" viewBox="0 0 ${size + 2} ${size + 2}"><circle cx="${r + 1}" cy="${r + 1}" r="${r}" fill="%23ff3333"/></svg>') ${r + 1} ${r + 1}, crosshair`;
        }
        if (tool === 'comment') return 'crosshair';
        if (tool === 'shape' || tool === 'frame') return 'crosshair';
        if (tool === 'text' || tool === 'sticky') return 'text';
        return 'default';
    };

    return (
        <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: 'transparent', cursor: getCursor() }}>
            <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                scaleX={stageScale}
                scaleY={stageScale}
                x={stagePosition.x}
                y={stagePosition.y}
                draggable={false}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
            >
                <Layer ref={layerRef}>
                    {nodes.map(node => {
                        const el = renderNode(node);
                        return el ? cloneElement(el, { key: node.id }) : null;
                    })}
                    {renderDrawingPreview()}
                    {/* Rubber-band selection rectangle */}
                    {selectionRect && (
                        <Rect
                            x={Math.min(selectionRect.startX, selectionRect.currentX)}
                            y={Math.min(selectionRect.startY, selectionRect.currentY)}
                            width={Math.abs(selectionRect.currentX - selectionRect.startX)}
                            height={Math.abs(selectionRect.currentY - selectionRect.startY)}
                            fill="rgba(59, 130, 246, 0.08)"
                            stroke="#3b82f6"
                            strokeWidth={1}
                            dash={[6, 3]}
                            listening={false}
                        />
                    )}
                    <Transformer
                        ref={transformerRef}
                        rotateEnabled={false}
                        boundBoxFunc={(o, n) => (n.width < 20 || n.height < 20 ? o : n)}
                        anchorFill="#0ea5e9"
                        anchorStroke="#0ea5e9"
                        anchorSize={10}
                        anchorCornerRadius={5}
                        borderStroke="#0ea5e9"
                        borderStrokeWidth={1.5}
                    />
                </Layer>
                {/* Laser pointer layer — ephemeral, never saved */}
                {laserLines.length > 0 && (
                    <Layer listening={false}>
                        {laserLines.map(line => (
                            <Line
                                key={line.id}
                                points={line.points}
                                stroke="#ff3333"
                                strokeWidth={laserStrokeWidth}
                                opacity={line.opacity}
                                shadowColor="#ff3333"
                                shadowBlur={15}
                                shadowOpacity={0.8}
                                lineCap="round"
                                lineJoin="round"
                                tension={0.5}
                            />
                        ))}
                    </Layer>
                )}
            </Stage>
            {/* PDF overlay toolbars — HTML positioned over the canvas */}
            <PdfOverlays />
            {/* Audio overlays — inline playback positioned over the canvas */}
            <AudioOverlays />
            {/* Video overlays — inline playback positioned over the canvas */}
            <VideoOverlays />
            {/* YouTube overlays — inline playback positioned over the canvas */}
            <YoutubeOverlays />
            {/* Floating shape toolbar */}
            {/* Reading layerRef during render is intentional: the Konva node's
                screen rect is only available via refs, and selection state always
                re-renders after the canvas has committed. */}
            {/* eslint-disable-next-line react-hooks/refs */}
            {selectedNodeIds.length === 1 && (() => {
                const selNode = nodes.find(n => n.id === selectedNodeIds[0]);
                if (!selNode) return null;
                const shapeTypes = ['rectangle', 'roundedRect', 'circle', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'octagon', 'star', 'heart', 'cloud', 'cross', 'rhombus', 'parallelogram', 'trapezoid', 'rightTriangle', 'arrow', 'simpleLine'];
                if (!shapeTypes.includes(selNode.type)) return null;
                const konvaNode = layerRef.current?.findOne(`#${selNode.id}`);
                if (!konvaNode || !stageRef.current) return null;
                const box = konvaNode.getClientRect({ relativeTo: stageRef.current });
                const absX = box.x * stageScale + stagePosition.x + box.width * stageScale / 2;
                const absY = box.y * stageScale + stagePosition.y;
                return <ShapeToolbar nodeId={selNode.id} position={{ x: absX, y: absY }} />;
            })()}

            {/* Floating text toolbar — when a text node is selected */}
            {/* eslint-disable-next-line react-hooks/refs */}
            {selectedNodeIds.length === 1 && (() => {
                const selNode = nodes.find(n => n.id === selectedNodeIds[0]);
                if (!selNode || (selNode.type !== 'text' && selNode.type !== 'sticky')) return null;
                const konvaNode = layerRef.current?.findOne(`#${selNode.id}`);
                if (!konvaNode || !stageRef.current) return null;
                const box = konvaNode.getClientRect({ relativeTo: stageRef.current });
                const absX = box.x * stageScale + stagePosition.x + box.width * stageScale / 2;
                const absY = box.y * stageScale + stagePosition.y;
                return <FloatingTextToolbar nodeId={selNode.id} position={{ x: absX, y: absY }} />;
            })()}

            {/* Inline comment input card */}
            {pendingComment && (() => {
                const screenX = pendingComment.x * stageScale + stagePosition.x;
                const screenY = pendingComment.y * stageScale + stagePosition.y;
                return (
                    <div
                        className="fixed z-[150] bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-64"
                        style={{ left: screenX + 12, top: screenY - 12 }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                            </div>
                            <span className="text-xs font-semibold text-gray-700">Add Comment</span>
                        </div>
                        <textarea
                            autoFocus
                            placeholder="Type your comment..."
                            className="w-full text-sm text-black border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 h-16"
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    const text = e.target.value.trim();
                                    if (text) { addComment(pendingComment.x, pendingComment.y, text); }
                                    setPendingComment(null);
                                }
                                if (e.key === 'Escape') { setPendingComment(null); }
                            }}
                        />
                        <div className="flex justify-end gap-1 mt-1.5">
                            <button
                                onClick={() => setPendingComment(null)}
                                className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                            >Cancel</button>
                            <button
                                onClick={(e) => {
                                    const textarea = e.target.closest('.fixed')?.querySelector('textarea');
                                    const text = textarea?.value?.trim();
                                    if (text) { addComment(pendingComment.x, pendingComment.y, text); }
                                    setPendingComment(null);
                                }}
                                className="px-3 py-1 text-xs bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                            >Post</button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

/**
 * Renders a bottom-center AudioPlayer bar for the first playing audio node.
 * Uses the rich AudioPlayer component so users get full controls.
 */
function AudioOverlays() {
    const { nodes, updateNode } = useStore();
    // Show the first playing audio in the bottom bar
    const playingAudio = nodes.find(n => n.type === 'audio' && n.playing);

    if (!playingAudio) return null;

    return (
        <AudioPlayer
            src={playingAudio.src}
            fileName={playingAudio.fileName}
            onClose={() => updateNode(playingAudio.id, { playing: false })}
        />
    );
}

/**
 * Wrapper that renders PdfOverlay components for each pdf node.
 * Rendered as a sibling to the Konva Stage div.
 */
function PdfOverlays() {
    const { nodes, selectedNodeIds, stagePosition, stageScale } = useStore();
    const pdfNodes = nodes.filter(n => n.type === 'pdf');

    if (pdfNodes.length === 0) return null;

    return (
        <>
            {pdfNodes.map(node => (
                <PdfOverlay
                    key={node.id}
                    node={node}
                    stagePosition={stagePosition}
                    stageScale={stageScale}
                    isSelected={selectedNodeIds.includes(node.id)}
                />
            ))}
        </>
    );
}

/**
 * Wrapper that renders inline video players for video nodes with playing=true.
 * Positioned as HTML overlays on top of the Konva Stage.
 */
function VideoOverlayPlayer({ node, stageScale, stagePosition, updateNode }) {
    const [videoSrc, setVideoSrc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const videoRef = useRef(null);

    const w = (node.width || 400) * stageScale;
    const h = (node.height || 225) * stageScale;
    const x = node.x * stageScale + stagePosition.x;
    const y = node.y * stageScale + stagePosition.y;

    // Load video src upfront — handles direct URLs and IDB-stored data.
    // The src (a data: URL, or a blob: URL for very large files) is used
    // directly. We must NOT fetch() a data: URL to convert it: the app's CSP
    // blocks `connect-src data:`, so that fetch throws and the video never loads.
    useEffect(() => {
        let cancelled = false;
        const loadSrc = async () => {
            setLoading(true);
            setLoadError(false);
            try {
                // Resolve the source, recovering from IndexedDB if needed
                let raw = node.src;
                if (!raw || raw.length <= 10 || raw.startsWith('__idb__')) {
                    const { loadMediaFromDB } = await import('../../store/useStore');
                    const key = raw && raw.startsWith('__idb__') ? raw.replace('__idb__', '') : node.id;
                    raw = await loadMediaFromDB(key)
                        || await loadMediaFromDB(node.id)
                        || await loadMediaFromDB(`${node.id}_video`)
                        || (raw && (raw.startsWith('data:') || raw.startsWith('blob:')) ? raw : null);
                }
                if (!raw) { if (!cancelled) { setLoadError(true); setLoading(false); } return; }
                if (!cancelled) { setVideoSrc(raw); setLoading(false); }
            } catch (e) {
                console.error('Video load error:', e);
                if (!cancelled) { setLoadError(true); setLoading(false); }
            }
        };
        loadSrc();
        return () => { cancelled = true; };
    }, [node.id, node.src]);

    // Kick off playback explicitly once the source is ready — the autoPlay
    // attribute alone is unreliable when the element mounts after a state update.
    useEffect(() => {
        if (loading || loadError || !videoSrc) return;
        const v = videoRef.current;
        if (!v) return;
        const tryPlay = () => { const p = v.play(); if (p && p.catch) p.catch(() => { }); };
        if (v.readyState >= 2) tryPlay();
        else {
            v.addEventListener('canplay', tryPlay, { once: true });
            return () => v.removeEventListener('canplay', tryPlay);
        }
    }, [loading, loadError, videoSrc]);

    return (
        <div
            className="absolute z-[100] overflow-hidden rounded-xl shadow-2xl"
            style={{ left: x, top: y, width: w, height: h }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {loading ? (
                <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-white gap-2">
                    <LogoSpinner className="w-12 h-12" />
                    <span className="text-xs text-gray-400">Loading video...</span>
                </div>
            ) : loadError ? (
                <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-white gap-2">
                    <span className="text-2xl">⚠️</span>
                    <span className="text-sm text-gray-400">Video failed to load</span>
                </div>
            ) : (
                <video
                    key={videoSrc}
                    ref={videoRef}
                    src={videoSrc}
                    autoPlay
                    controls
                    playsInline
                    onError={() => setLoadError(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                />
            )}
            <button
                onClick={() => updateNode(node.id, { playing: false })}
                className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-xs z-[101] transition-colors"
                title="Stop video"
            >
                ✕
            </button>
        </div>
    );
}

function VideoOverlays() {
    const { nodes, updateNode, stagePosition, stageScale } = useStore();
    const playingVideos = nodes.filter(n => n.type === 'video' && n.playing);

    if (playingVideos.length === 0) return null;

    return (
        <>
            {playingVideos.map(node => (
                <VideoOverlayPlayer
                    key={node.id}
                    node={node}
                    stageScale={stageScale}
                    stagePosition={stagePosition}
                    updateNode={updateNode}
                />
            ))}
        </>
    );
}

/**
 * Renders inline YouTube iframe players for youtube nodes with playing=true.
 * Positioned as HTML overlays on top of the Konva Stage.
 */
function YoutubeOverlays() {
    const { nodes, updateNode, stagePosition, stageScale } = useStore();
    const playingYoutubes = nodes.filter(n => n.type === 'youtube' && n.playing);

    if (playingYoutubes.length === 0) return null;

    return (
        <>
            {playingYoutubes.map(node => {
                const w = (node.width || 480) * stageScale;
                const h = (node.height || 270) * stageScale;
                const x = node.x * stageScale + stagePosition.x;
                const y = node.y * stageScale + stagePosition.y;

                return (
                    <div
                        key={node.id}
                        className="absolute z-[100] overflow-hidden rounded-xl shadow-2xl"
                        style={{
                            left: x,
                            top: y,
                            width: w,
                            height: h,
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <iframe
                            src={`https://www.youtube.com/embed/${node.videoId}?autoplay=1&rel=0`}
                            title="YouTube video"
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                        <button
                            onClick={() => updateNode(node.id, { playing: false })}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-xs z-[101] transition-colors"
                            title="Stop video"
                        >
                            ✕
                        </button>
                    </div>
                );
            })}
        </>
    );
}
