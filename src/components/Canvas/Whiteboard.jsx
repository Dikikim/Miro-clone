import { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer, Rect, Circle, Ellipse, Text, Transformer, Image as KonvaImage, Group, Line, RegularPolygon, Arrow, Star as KonvaStar, Shape } from 'react-konva';
import useStore from '../../store/useStore';

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
    const playBtnW = 68, playBtnH = 48;
    const cx = node.width / 2, cy = node.height / 2;

    return (
        <Group {...commonProps} x={node.x} y={node.y}>
            {/* Background */}
            <Rect width={node.width} height={node.height} fill="#0f0f0f" cornerRadius={12} />

            {/* Thumbnail image */}
            {image && <KonvaImage image={image} width={node.width} height={node.height} cornerRadius={12} />}

            {/* YouTube play button - red rounded rectangle */}
            <Rect
                x={cx - playBtnW / 2}
                y={cy - playBtnH / 2}
                width={playBtnW}
                height={playBtnH}
                fill="#ff0000"
                cornerRadius={12}
                shadowColor="black"
                shadowBlur={10}
                shadowOpacity={0.5}
            />

            {/* Play triangle */}
            <Line
                points={[cx - 10, cy - 12, cx - 10, cy + 12, cx + 14, cy]}
                fill="white"
                closed
            />

            {/* "Double-click to play" hint */}
            <Rect x={10} y={node.height - 32} width={node.width - 20} height={22} fill="rgba(0,0,0,0.7)" cornerRadius={4} />
            <Text x={10} y={node.height - 28} width={node.width - 20} text="🎬 Double-click to play" fontSize={12} fill="#fff" align="center" />
        </Group>
    );
}

function AudioNode({ node, commonProps }) {
    const w = node.width || 300;
    const h = node.height || 80;
    const iconSize = 32;
    const fileName = node.fileName || 'Audio file';

    return (
        <Group {...commonProps} x={node.x} y={node.y}>
            {/* Background card */}
            <Rect width={w} height={h} fill="#ffffff" stroke="#e5e7eb" strokeWidth={1} cornerRadius={12} shadowColor="black" shadowBlur={8} shadowOpacity={0.1} />

            {/* Music icon circle */}
            <Circle x={40} y={h / 2} radius={iconSize / 2 + 8} fill="#8b5cf6" />

            {/* Music note icon (simplified) */}
            <Text x={28} y={h / 2 - 10} text="♪" fontSize={24} fill="white" />

            {/* File name */}
            <Text x={75} y={h / 2 - 16} text={fileName.length > 30 ? fileName.substring(0, 30) + '...' : fileName} fontSize={14} fill="#1f2937" fontStyle="bold" />

            {/* Double-click hint */}
            <Text x={75} y={h / 2 + 6} text="🎧 Double-click to play" fontSize={11} fill="#6b7280" />
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
            <Rect width={w} height={h} fill="#374151" cornerRadius={12} />

            {/* Play button circle */}
            <Circle x={w / 2} y={h / 2} radius={playBtnSize / 2} fill="rgba(255,255,255,0.9)" shadowColor="black" shadowBlur={10} shadowOpacity={0.3} />

            {/* Play triangle */}
            <Line
                points={[w / 2 - 8, h / 2 - 12, w / 2 - 8, h / 2 + 12, w / 2 + 14, h / 2]}
                fill="#1f2937"
                closed
            />

            {/* Video icon badge */}
            <Rect x={10} y={10} width={28} height={28} fill="#ef4444" cornerRadius={6} />
            <Text x={15} y={14} text="▶" fontSize={16} fill="white" />

            {/* File name and hint at bottom */}
            <Rect x={0} y={h - 36} width={w} height={36} fill="rgba(0,0,0,0.7)" cornerRadius={[0, 0, 12, 12]} />
            <Text x={12} y={h - 30} text={fileName.length > 35 ? fileName.substring(0, 35) + '...' : fileName} fontSize={11} fill="#ffffff" width={w - 24} />
            <Text x={12} y={h - 14} text="🎬 Double-click to play" fontSize={10} fill="#9ca3af" />
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
    const [editingTextId, setEditingTextId] = useState(null);
    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [drawingShape, setDrawingShape] = useState(null);

    const {
        nodes, selectedNodeIds, tool, shapeType, stagePosition, stageScale,
        fillColor, strokeColor, strokeWidth, textColor,
        addNode, updateNode, deleteNode, selectNode, clearSelection, setStagePosition, setStageScale,
    } = useStore();

    useEffect(() => {
        const handleResize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (transformerRef.current && layerRef.current) {
            const selected = selectedNodeIds.map((id) => layerRef.current.findOne(`#${id}`)).filter(Boolean);
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
        mouseButtonRef.current = e.evt ? e.evt.button : 0;

        // Only respond to left mouse button (button 0) for our custom handling
        if (e.evt && e.evt.button !== 0) return;

        const onEmpty = e.target === e.target.getStage();

        // When using drawing tools, prevent stage from dragging so we can draw
        if (tool !== 'select' && onEmpty) {
            const stage = stageRef.current;
            if (stage) stage.stopDrag();
        }

        const pos = getPos();
        if (!pos) return;

        if (tool === 'pen') {
            isDrawing.current = true;
            currentLineId.current = addNode({ type: 'line', points: [pos.x, pos.y], stroke: strokeColor, strokeWidth, lineCap: 'round', lineJoin: 'round' });
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
        if (tool === 'select') { clearSelection(); return; }

        // Start drawing shape by dragging
        if (tool === 'shape') {
            setDrawingShape({ type: shapeType, startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y });
            return;
        }

        // Only create new text on empty canvas
        if (tool === 'text') {
            const newNodeId = addNode({ type: 'text', x: pos.x, y: pos.y, text: '', fontSize: 24, fill: textColor });
            // Auto-focus for editing after a small delay to let the node render
            setTimeout(() => {
                const textNode = layerRef.current?.findOne(`#${newNodeId}`);
                if (textNode && stageRef.current) {
                    setEditingTextId(newNodeId);
                    const stage = stageRef.current;
                    const textPosition = textNode.absolutePosition();
                    const areaPosition = { x: stage.container().offsetLeft + textPosition.x, y: stage.container().offsetTop + textPosition.y };
                    const toolbarWidth = 420;
                    const toolbarX = Math.max(10, Math.min(areaPosition.x - 50, window.innerWidth - toolbarWidth - 20));

                    // Current styles
                    let currentFontSize = 24;
                    let isBold = false;
                    let isItalic = false;
                    let isStrike = false;
                    let isUnderline = false;
                    let currentColor = '#000000';

                    // Create Miro-style toolbar
                    const toolbar = document.createElement('div');
                    toolbar.id = 'text-format-toolbar';
                    toolbar.style.cssText = `
                        position: absolute;
                        top: ${areaPosition.y - 50}px;
                        left: ${toolbarX}px;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 2px 16px rgba(0,0,0,0.12);
                        padding: 4px 6px;
                        display: flex;
                        align-items: center;
                        gap: 2px;
                        z-index: 1001;
                        border: 1px solid #e0e0e0;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    `;

                    // Helper to create toolbar button
                    const createBtn = (html, title, isActive = false, onClick = null) => {
                        const btn = document.createElement('button');
                        btn.innerHTML = html;
                        btn.title = title;
                        btn.style.cssText = `
                            min-width: 28px;
                            height: 28px;
                            border: none;
                            background: ${isActive ? '#e8e0ff' : 'transparent'};
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            color: ${isActive ? '#6b4fbb' : '#1a1a1a'};
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            padding: 0 4px;
                        `;
                        btn.onmouseenter = () => { if (!isActive) btn.style.background = '#f5f5f5'; };
                        btn.onmouseleave = () => { btn.style.background = isActive ? '#e8e0ff' : 'transparent'; };
                        if (onClick) btn.onclick = onClick;
                        return btn;
                    };

                    // Helper to create separator
                    const createSep = () => {
                        const sep = document.createElement('div');
                        sep.style.cssText = 'width: 1px; height: 20px; background: #e0e0e0; margin: 0 4px;';
                        return sep;
                    };

                    // T icon
                    toolbar.appendChild(createBtn('<span style="color:#6b4fbb;font-weight:600;font-size:16px;">T</span>', 'Text'));

                    // Font size with - and + buttons
                    const sizeWrapper = document.createElement('div');
                    sizeWrapper.style.cssText = 'display:flex;align-items:center;gap:2px;';

                    // Minus button
                    const minusBtn = createBtn('−', 'Decrease font size');
                    minusBtn.style.minWidth = '24px';
                    minusBtn.style.fontSize = '14px';
                    minusBtn.onmousedown = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        currentFontSize = Math.max(4, currentFontSize - 2);
                        textarea.style.fontSize = `${currentFontSize * stageScale}px`;
                        textarea.style.minHeight = `${(currentFontSize * stageScale) + 20}px`;
                        sizeBtn.innerHTML = `${currentFontSize} <span style="font-size:10px;margin-left:2px;">▼</span>`;
                        updateNode(newNodeId, { fontSize: currentFontSize });
                        textarea.focus();
                    };
                    sizeWrapper.appendChild(minusBtn);

                    // Font size dropdown
                    const sizeDropdown = document.createElement('div');
                    sizeDropdown.style.cssText = 'position:relative;';
                    const sizeBtn = createBtn(`${currentFontSize} <span style="font-size:10px;margin-left:2px;">▼</span>`, 'Font size');
                    sizeBtn.style.minWidth = '40px';
                    sizeBtn.style.fontSize = '12px';
                    sizeBtn.style.color = '#1a1a1a';
                    sizeBtn.style.fontWeight = '500';

                    const sizeMenu = document.createElement('div');
                    sizeMenu.style.cssText = 'position:absolute;top:100%;left:0;background:white;border:1px solid #e0e0e0;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:4px;display:none;z-index:1002;max-height:200px;overflow-y:auto;min-width:60px;';
                    [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96, 128].forEach(size => {
                        const sizeOption = document.createElement('div');
                        sizeOption.textContent = size;
                        sizeOption.style.cssText = 'padding:6px 12px;cursor:pointer;font-size:13px;border-radius:4px;color:#1a1a1a;';
                        sizeOption.onmouseenter = () => sizeOption.style.background = '#f5f5f5';
                        sizeOption.onmouseleave = () => sizeOption.style.background = 'transparent';
                        sizeOption.onmousedown = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            currentFontSize = size;
                            textarea.style.fontSize = `${size * stageScale}px`;
                            textarea.style.minHeight = `${(size * stageScale) + 20}px`;
                            sizeBtn.innerHTML = `${size} <span style="font-size:10px;margin-left:2px;">▼</span>`;
                            updateNode(newNodeId, { fontSize: size });
                            sizeMenu.style.display = 'none';
                            textarea.focus();
                        };
                        sizeMenu.appendChild(sizeOption);
                    });
                    sizeBtn.onmousedown = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        sizeMenu.style.display = sizeMenu.style.display === 'none' ? 'block' : 'none';
                    };
                    sizeDropdown.appendChild(sizeBtn);
                    sizeDropdown.appendChild(sizeMenu);
                    sizeWrapper.appendChild(sizeDropdown);

                    // Plus button
                    const plusBtn = createBtn('+', 'Increase font size');
                    plusBtn.style.minWidth = '24px';
                    plusBtn.style.fontSize = '14px';
                    plusBtn.onmousedown = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        currentFontSize = Math.min(200, currentFontSize + 2);
                        textarea.style.fontSize = `${currentFontSize * stageScale}px`;
                        textarea.style.minHeight = `${(currentFontSize * stageScale) + 20}px`;
                        sizeBtn.innerHTML = `${currentFontSize} <span style="font-size:10px;margin-left:2px;">▼</span>`;
                        updateNode(newNodeId, { fontSize: currentFontSize });
                        textarea.focus();
                    };
                    sizeWrapper.appendChild(plusBtn);

                    toolbar.appendChild(sizeWrapper);

                    toolbar.appendChild(createSep());

                    // Bold
                    const boldBtn = createBtn('<b>B</b>', 'Bold', isBold, () => {
                        isBold = !isBold;
                        boldBtn.style.background = isBold ? '#e8e0ff' : 'transparent';
                        boldBtn.style.color = isBold ? '#6b4fbb' : '#1a1a1a';
                        textarea.style.fontWeight = isBold ? 'bold' : 'normal';
                        updateNode(newNodeId, { fontStyle: isBold ? (isItalic ? 'bold italic' : 'bold') : (isItalic ? 'italic' : 'normal') });
                    });
                    toolbar.appendChild(boldBtn);

                    // Italic
                    const italicBtn = createBtn('<i>I</i>', 'Italic', isItalic, () => {
                        isItalic = !isItalic;
                        italicBtn.style.background = isItalic ? '#e8e0ff' : 'transparent';
                        italicBtn.style.color = isItalic ? '#6b4fbb' : '#1a1a1a';
                        textarea.style.fontStyle = isItalic ? 'italic' : 'normal';
                        updateNode(newNodeId, { fontStyle: isBold ? (isItalic ? 'bold italic' : 'bold') : (isItalic ? 'italic' : 'normal') });
                    });
                    toolbar.appendChild(italicBtn);

                    // Strikethrough
                    const strikeBtn = createBtn('<s>S</s>', 'Strikethrough', isStrike, () => {
                        isStrike = !isStrike;
                        isUnderline = false;
                        strikeBtn.style.background = isStrike ? '#e8e0ff' : 'transparent';
                        underlineBtn.style.background = 'transparent';
                        textarea.style.textDecoration = isStrike ? 'line-through' : 'none';
                        updateNode(newNodeId, { textDecoration: isStrike ? 'line-through' : 'none' });
                    });
                    toolbar.appendChild(strikeBtn);

                    // Underline
                    const underlineBtn = createBtn('<u>U</u>', 'Underline', isUnderline, () => {
                        isUnderline = !isUnderline;
                        isStrike = false;
                        underlineBtn.style.background = isUnderline ? '#e8e0ff' : 'transparent';
                        strikeBtn.style.background = 'transparent';
                        textarea.style.textDecoration = isUnderline ? 'underline' : 'none';
                        updateNode(newNodeId, { textDecoration: isUnderline ? 'underline' : 'none' });
                    });
                    toolbar.appendChild(underlineBtn);

                    toolbar.appendChild(createSep());

                    // Highlight (yellow background)
                    let isHighlight = false;
                    const highlightBtn = createBtn('<span style="background:#ffeb3b;padding:0 3px;border-radius:2px;">A</span>', 'Highlight', false, () => {
                        isHighlight = !isHighlight;
                        highlightBtn.style.background = isHighlight ? '#e8e0ff' : 'transparent';
                        textarea.style.backgroundColor = isHighlight ? '#ffeb3b' : 'white';
                    });
                    toolbar.appendChild(highlightBtn);

                    // Color palette dropdown
                    const colorWrapper = document.createElement('div');
                    colorWrapper.style.cssText = 'position:relative;display:flex;';
                    const colorBtn = createBtn('<span style="border-bottom:2px solid ' + currentColor + ';">A</span>', 'Text color');

                    // Create color palette dropdown
                    const colorPalette = document.createElement('div');
                    colorPalette.style.cssText = `
                        position: absolute;
                        top: 36px;
                        left: 0;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                        padding: 8px;
                        display: none;
                        grid-template-columns: repeat(6, 1fr);
                        gap: 4px;
                        z-index: 1002;
                        border: 1px solid #e0e0e0;
                    `;

                    const paletteColors = [
                        '#000000', '#374151', '#6b7280', '#ef4444', '#f97316',
                        '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'
                    ];

                    paletteColors.forEach(color => {
                        const colorOption = document.createElement('button');
                        colorOption.style.cssText = `
                            width: 24px;
                            height: 24px;
                            border-radius: 4px;
                            border: ${color === '#ffffff' ? '1px solid #e0e0e0' : 'none'};
                            background: ${color};
                            cursor: pointer;
                            transition: transform 0.1s;
                        `;
                        colorOption.onmouseenter = () => colorOption.style.transform = 'scale(1.1)';
                        colorOption.onmouseleave = () => colorOption.style.transform = 'scale(1)';
                        colorOption.onclick = (e) => {
                            e.stopPropagation();
                            currentColor = color;
                            textarea.style.color = currentColor;
                            colorBtn.innerHTML = '<span style="border-bottom:2px solid ' + currentColor + ';">A</span>';
                            updateNode(newNodeId, { fill: currentColor });
                            colorPalette.style.display = 'none';
                        };
                        colorPalette.appendChild(colorOption);
                    });

                    colorBtn.onclick = (e) => {
                        e.stopPropagation();
                        colorPalette.style.display = colorPalette.style.display === 'none' ? 'grid' : 'none';
                    };

                    colorWrapper.appendChild(colorBtn);
                    colorWrapper.appendChild(colorPalette);
                    toolbar.appendChild(colorWrapper);

                    document.body.appendChild(toolbar);

                    // Close dropdown when clicking outside
                    const closeDropdownOnClickOutside = (e) => {
                        if (!sizeDropdown.contains(e.target)) {
                            sizeMenu.style.display = 'none';
                        }
                    };
                    document.addEventListener('mousedown', closeDropdownOnClickOutside);

                    // Create textarea with Miro style - expands horizontally
                    const textarea = document.createElement('textarea');
                    document.body.appendChild(textarea);
                    textarea.value = '';
                    textarea.placeholder = 'Type something';
                    textarea.rows = 1;
                    textarea.style.cssText = `
                        position: absolute;
                        top: ${areaPosition.y}px;
                        left: ${areaPosition.x}px;
                        min-width: 100px;
                        width: auto;
                        font-size: ${24 * stageScale}px;
                        border: 1px dashed #6b4fbb;
                        padding: 8px 12px;
                        background: transparent;
                        color: #000000;
                        outline: none;
                        resize: none;
                        line-height: 1.3;
                        font-family: Arial, sans-serif;
                        z-index: 1000;
                        border-radius: 4px;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                    `;
                    textarea.style.setProperty('-webkit-scrollbar', 'none');

                    // Auto-expand width and height as user types
                    const autoExpand = () => {
                        // Measure width based on longest line
                        const lines = textarea.value.split('\n');
                        let maxWidth = 100;
                        lines.forEach(line => {
                            const tempSpan = document.createElement('span');
                            tempSpan.style.cssText = `
                                position: absolute;
                                visibility: hidden;
                                white-space: nowrap;
                                font-size: ${24 * stageScale}px;
                                font-family: Arial, sans-serif;
                                padding: 0;
                            `;
                            tempSpan.textContent = line || textarea.placeholder;
                            document.body.appendChild(tempSpan);
                            maxWidth = Math.max(maxWidth, tempSpan.offsetWidth + 30);
                            tempSpan.remove();
                        });
                        textarea.style.width = `${maxWidth}px`;

                        // Expand height using scrollHeight
                        textarea.style.height = 'auto';
                        textarea.style.height = `${textarea.scrollHeight}px`;
                    };
                    textarea.addEventListener('input', autoExpand);
                    autoExpand();
                    textarea.focus();

                    const removeTextarea = (save = true) => {
                        if (save && textarea.value.trim()) {
                            updateNode(newNodeId, { text: textarea.value });
                        } else {
                            // Cancel - delete the node
                            deleteNode(newNodeId);
                        }
                        textarea.remove();
                        toolbar.remove();
                        document.removeEventListener('mousedown', closeDropdownOnClickOutside);
                        setEditingTextId(null);
                    };

                    textarea.addEventListener('blur', (e) => {
                        if (e.relatedTarget && toolbar.contains(e.relatedTarget)) {
                            textarea.focus();
                            return;
                        }
                        removeTextarea(true);
                    });
                    textarea.addEventListener('keydown', (e) => {
                        if ((e.key === 'Enter' && (e.ctrlKey || e.shiftKey))) { e.preventDefault(); removeTextarea(true); }
                        if (e.key === 'Escape') { e.preventDefault(); removeTextarea(false); }
                    });
                }
            }, 50);
        }
    }, [tool, shapeType, fillColor, strokeColor, strokeWidth, addNode, updateNode, deleteNode, clearSelection, getPos, nodes, stageScale]);

    const handleMouseMove = useCallback((e) => {
        const pos = getPos();
        if (!pos) return;

        if (drawingShape && tool === 'shape') {
            setDrawingShape({ ...drawingShape, currentX: pos.x, currentY: pos.y });
            return;
        }

        if (isDrawing.current && tool === 'pen' && currentLineId.current) {
            const node = nodes.find(n => n.id === currentLineId.current);
            if (node) updateNode(currentLineId.current, { points: [...node.points, pos.x, pos.y] });
            return;
        }

        if (tool === 'eraser' && e.evt.buttons === 1) {
            const target = e.target;
            if (target !== target.getStage()) {
                const clickedId = target.id();
                const nodeData = nodes.find(n => n.id === clickedId);
                if (clickedId && nodeData && nodeData.type === 'line') {
                    deleteNode(clickedId);
                }
            }
        }
    }, [tool, nodes, updateNode, deleteNode, getPos, drawingShape]);

    const handleMouseUp = useCallback(() => {
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
                const baseProps = { fill: fillColor, stroke: strokeColor, strokeWidth };

                switch (type) {
                    case 'rectangle':
                        addNode({ type: 'rectangle', x, y, width: Math.max(20, width), height: Math.max(20, height), ...baseProps });
                        break;
                    case 'roundedRect':
                        addNode({ type: 'roundedRect', x, y, width: Math.max(20, width), height: Math.max(20, height), cornerRadius: 15, ...baseProps });
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
                        addNode({ type: 'heart', x: centerX, y: centerY, size: size, ...baseProps });
                        break;
                    case 'cloud':
                        addNode({ type: 'cloud', x, y, width: Math.max(40, width), height: Math.max(30, height), ...baseProps });
                        break;
                    case 'cross':
                        addNode({ type: 'cross', x: centerX, y: centerY, size: size, ...baseProps });
                        break;
                }
            }
            setDrawingShape(null);
        }

        isDrawing.current = false;
        currentLineId.current = null;
    }, [drawingShape, addNode, fillColor, strokeColor, strokeWidth]);

    const handleClick = useCallback((e, id) => {
        // Only respond to left mouse button
        if (e.evt && e.evt.button !== 0) return;
        e.cancelBubble = true;
        if (tool === 'select') {
            selectNode(id, e.evt?.shiftKey || e.evt?.ctrlKey || e.evt?.metaKey || false);
        } else if (tool === 'eraser') {
            const nodeData = nodes.find(n => n.id === id);
            if (nodeData && nodeData.type === 'line') {
                deleteNode(id);
            }
        }
    }, [selectNode, deleteNode, tool, nodes]);

    const handleDblClick = useCallback((e, node) => {
        // Only respond to left mouse button
        if (e.evt && e.evt.button !== 0) return;
        e.cancelBubble = true;

        // YouTube - play video
        if (node.type === 'youtube' && node.videoId) {
            if (window.playYoutubeVideo) {
                window.playYoutubeVideo(node.videoId);
            }
            return;
        }

        // Audio - play audio file
        if (node.type === 'audio' && node.src) {
            if (window.playAudioFile) {
                window.playAudioFile(node.src, node.fileName);
            }
            return;
        }

        // Video - play video file
        if (node.type === 'video' && node.src) {
            if (window.playVideoFile) {
                window.playVideoFile(node.src, node.fileName);
            }
            return;
        }

        // Text - always edit on double-click, regardless of tool
        if (node.type !== 'text') return;
        setEditingTextId(node.id);

        const stage = stageRef.current;
        const textNode = layerRef.current.findOne(`#${node.id}`);
        if (!stage || !textNode) return;

        const textPosition = textNode.absolutePosition();
        const areaPosition = { x: stage.container().offsetLeft + textPosition.x, y: stage.container().offsetTop + textPosition.y };
        const toolbarWidth = 420;
        const toolbarX = Math.max(10, Math.min(areaPosition.x - 50, window.innerWidth - toolbarWidth - 20));

        // Current styles
        let currentFontSize = node.fontSize || 24;
        let currentStyle = node.fontStyle || 'normal';
        let isBold = currentStyle.includes('bold');
        let isItalic = currentStyle.includes('italic');
        let isStrike = node.textDecoration === 'line-through';
        let isUnderline = node.textDecoration === 'underline';
        let currentAlign = node.align || 'left';
        let currentColor = node.fill || '#000000';

        // Create floating toolbar - exact Miro style
        const toolbar = document.createElement('div');
        toolbar.id = 'text-format-toolbar';
        toolbar.style.cssText = `
            position: absolute;
            top: ${areaPosition.y - 50}px;
            left: ${toolbarX}px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 16px rgba(0,0,0,0.12);
            padding: 4px 6px;
            display: flex;
            align-items: center;
            gap: 2px;
            z-index: 1001;
            border: 1px solid #e0e0e0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;

        // Helper to create toolbar button
        const createBtn = (html, title, isActive = false, onClick = null) => {
            const btn = document.createElement('button');
            btn.innerHTML = html;
            btn.title = title;
            btn.style.cssText = `
                min-width: 28px;
                height: 28px;
                border: none;
                background: ${isActive ? '#e8e0ff' : 'transparent'};
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                color: ${isActive ? '#6b4fbb' : '#1a1a1a'};
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 4px;
            `;
            btn.onmouseenter = () => { if (!isActive) btn.style.background = '#f5f5f5'; };
            btn.onmouseleave = () => { btn.style.background = isActive ? '#e8e0ff' : 'transparent'; };
            if (onClick) btn.onclick = onClick;
            return btn;
        };

        // Helper to create separator
        const createSep = () => {
            const sep = document.createElement('div');
            sep.style.cssText = 'width: 1px; height: 20px; background: #e0e0e0; margin: 0 4px;';
            return sep;
        };

        // T icon (text type indicator)
        const tIcon = createBtn('<span style="color:#6b4fbb;font-weight:600;font-size:16px;">T</span>', 'Text');
        toolbar.appendChild(tIcon);

        // Font size with - and + buttons
        const sizeWrapper = document.createElement('div');
        sizeWrapper.style.cssText = 'display:flex;align-items:center;gap:2px;';

        // Minus button
        const minusBtn = createBtn('−', 'Decrease font size');
        minusBtn.style.minWidth = '24px';
        minusBtn.style.fontSize = '14px';
        minusBtn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentFontSize = Math.max(4, currentFontSize - 2);
            textarea.style.fontSize = `${currentFontSize * stageScale}px`;
            textarea.style.minHeight = `${(currentFontSize * stageScale) + 20}px`;
            sizeBtn.innerHTML = `${currentFontSize} <span style="font-size:10px;margin-left:2px;">▼</span>`;
            updateNode(node.id, { fontSize: currentFontSize });
            textarea.focus();
        };
        sizeWrapper.appendChild(minusBtn);

        // Font size dropdown
        const sizeDropdown = document.createElement('div');
        sizeDropdown.style.cssText = 'position:relative;';
        const sizeBtn = createBtn(`${currentFontSize} <span style="font-size:10px;margin-left:2px;">▼</span>`, 'Font size');
        sizeBtn.style.minWidth = '40px';
        sizeBtn.style.fontSize = '12px';
        sizeBtn.style.color = '#1a1a1a';
        sizeBtn.style.fontWeight = '500';

        const sizeMenu = document.createElement('div');
        sizeMenu.style.cssText = 'position:absolute;top:100%;left:0;background:white;border:1px solid #e0e0e0;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:4px;display:none;z-index:1002;max-height:200px;overflow-y:auto;min-width:60px;';
        [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96, 128].forEach(size => {
            const sizeOption = document.createElement('div');
            sizeOption.textContent = size;
            sizeOption.style.cssText = 'padding:6px 12px;cursor:pointer;font-size:13px;border-radius:4px;color:#1a1a1a;';
            sizeOption.onmouseenter = () => sizeOption.style.background = '#f5f5f5';
            sizeOption.onmouseleave = () => sizeOption.style.background = 'transparent';
            sizeOption.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                currentFontSize = size;
                textarea.style.fontSize = `${size * stageScale}px`;
                textarea.style.minHeight = `${(size * stageScale) + 20}px`;
                sizeBtn.innerHTML = `${size} <span style="font-size:10px;margin-left:2px;">▼</span>`;
                updateNode(node.id, { fontSize: size });
                sizeMenu.style.display = 'none';
                textarea.focus();
            };
            sizeMenu.appendChild(sizeOption);
        });
        sizeBtn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            sizeMenu.style.display = sizeMenu.style.display === 'none' ? 'block' : 'none';
        };
        sizeDropdown.appendChild(sizeBtn);
        sizeDropdown.appendChild(sizeMenu);
        sizeWrapper.appendChild(sizeDropdown);

        // Plus button
        const plusBtn = createBtn('+', 'Increase font size');
        plusBtn.style.minWidth = '24px';
        plusBtn.style.fontSize = '14px';
        plusBtn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentFontSize = Math.min(200, currentFontSize + 2);
            textarea.style.fontSize = `${currentFontSize * stageScale}px`;
            textarea.style.minHeight = `${(currentFontSize * stageScale) + 20}px`;
            sizeBtn.innerHTML = `${currentFontSize} <span style="font-size:10px;margin-left:2px;">▼</span>`;
            updateNode(node.id, { fontSize: currentFontSize });
            textarea.focus();
        };
        sizeWrapper.appendChild(plusBtn);

        toolbar.appendChild(sizeWrapper);

        toolbar.appendChild(createSep());

        // Bold
        const boldBtn = createBtn('<b>B</b>', 'Bold (Ctrl+B)', isBold, () => {
            isBold = !isBold;
            currentStyle = isBold ? (isItalic ? 'bold italic' : 'bold') : (isItalic ? 'italic' : 'normal');
            boldBtn.style.background = isBold ? '#e8e0ff' : 'transparent';
            boldBtn.style.color = isBold ? '#6b4fbb' : '#1a1a1a';
            textarea.style.fontWeight = isBold ? 'bold' : 'normal';
            updateNode(node.id, { fontStyle: currentStyle });
        });
        toolbar.appendChild(boldBtn);

        // Italic
        const italicBtn = createBtn('<i>I</i>', 'Italic (Ctrl+I)', isItalic, () => {
            isItalic = !isItalic;
            currentStyle = isBold ? (isItalic ? 'bold italic' : 'bold') : (isItalic ? 'italic' : 'normal');
            italicBtn.style.background = isItalic ? '#e8e0ff' : 'transparent';
            italicBtn.style.color = isItalic ? '#6b4fbb' : '#1a1a1a';
            textarea.style.fontStyle = isItalic ? 'italic' : 'normal';
            updateNode(node.id, { fontStyle: currentStyle });
        });
        toolbar.appendChild(italicBtn);

        // Strikethrough
        const strikeBtn = createBtn('<s>S</s>', 'Strikethrough', isStrike, () => {
            isStrike = !isStrike;
            isUnderline = false;
            strikeBtn.style.background = isStrike ? '#e8e0ff' : 'transparent';
            strikeBtn.style.color = isStrike ? '#6b4fbb' : '#1a1a1a';
            underlineBtn.style.background = 'transparent';
            underlineBtn.style.color = '#1a1a1a';
            textarea.style.textDecoration = isStrike ? 'line-through' : 'none';
            updateNode(node.id, { textDecoration: isStrike ? 'line-through' : 'none' });
        });
        toolbar.appendChild(strikeBtn);

        // Underline
        const underlineBtn = createBtn('<u>U</u>', 'Underline', isUnderline, () => {
            isUnderline = !isUnderline;
            isStrike = false;
            underlineBtn.style.background = isUnderline ? '#e8e0ff' : 'transparent';
            underlineBtn.style.color = isUnderline ? '#6b4fbb' : '#1a1a1a';
            strikeBtn.style.background = 'transparent';
            strikeBtn.style.color = '#1a1a1a';
            textarea.style.textDecoration = isUnderline ? 'underline' : 'none';
            updateNode(node.id, { textDecoration: isUnderline ? 'underline' : 'none' });
        });
        toolbar.appendChild(underlineBtn);

        toolbar.appendChild(createSep());

        // Highlight (yellow background)
        let isHighlight = false;
        const highlightBtn = createBtn('<span style="background:#ffeb3b;padding:0 3px;border-radius:2px;">A</span>', 'Highlight', false, () => {
            isHighlight = !isHighlight;
            highlightBtn.style.background = isHighlight ? '#e8e0ff' : 'transparent';
            textarea.style.backgroundColor = isHighlight ? '#ffeb3b' : 'white';
        });
        toolbar.appendChild(highlightBtn);

        // Text color
        const colorWrapper = document.createElement('div');
        colorWrapper.style.cssText = 'position:relative;display:flex;';
        const colorBtn = createBtn('<span style="border-bottom:2px solid ' + currentColor + ';">A</span>', 'Text color');
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = currentColor;
        colorInput.style.cssText = 'position:absolute;opacity:0;width:28px;height:28px;cursor:pointer;';
        colorInput.oninput = () => {
            currentColor = colorInput.value;
            textarea.style.color = currentColor;
            colorBtn.innerHTML = '<span style="border-bottom:2px solid ' + currentColor + ';">A</span>';
            updateNode(node.id, { fill: currentColor });
        };
        colorWrapper.appendChild(colorInput);
        colorWrapper.appendChild(colorBtn);
        toolbar.appendChild(colorWrapper);

        document.body.appendChild(toolbar);

        // Close dropdown when clicking outside
        const closeDropdownOnClickOutside = (e) => {
            if (!sizeDropdown.contains(e.target)) {
                sizeMenu.style.display = 'none';
            }
        };
        document.addEventListener('mousedown', closeDropdownOnClickOutside);

        // Create textarea - expands horizontally
        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textarea.value = node.text;
        textarea.placeholder = 'Type something';
        textarea.rows = 1;
        textarea.style.cssText = `
            position: absolute;
            top: ${areaPosition.y}px;
            left: ${areaPosition.x}px;
            min-width: 100px;
            width: auto;
            font-size: ${node.fontSize * stageScale}px;
            border: 1px dashed #6b4fbb;
            padding: 8px 12px;
            background: transparent;
            color: ${currentColor};
            outline: none;
            resize: none;
            line-height: 1.3;
            font-family: Arial, sans-serif;
            z-index: 1000;
            border-radius: 4px;
            font-weight: ${isBold ? 'bold' : 'normal'};
            font-style: ${isItalic ? 'italic' : 'normal'};
            text-decoration: ${isStrike ? 'line-through' : isUnderline ? 'underline' : 'none'};
            white-space: pre-wrap;
            word-wrap: break-word;
            scrollbar-width: none;
            -ms-overflow-style: none;
        `;
        textarea.style.setProperty('-webkit-scrollbar', 'none');

        // Auto-expand width and height as user types
        const autoExpand = () => {
            // Measure width based on longest line
            const lines = textarea.value.split('\n');
            let maxWidth = 100;
            lines.forEach(line => {
                const tempSpan = document.createElement('span');
                tempSpan.style.cssText = `
                    position: absolute;
                    visibility: hidden;
                    white-space: nowrap;
                    font-size: ${node.fontSize * stageScale}px;
                    font-family: Arial, sans-serif;
                    font-weight: ${isBold ? 'bold' : 'normal'};
                    padding: 0;
                `;
                tempSpan.textContent = line || textarea.placeholder;
                document.body.appendChild(tempSpan);
                maxWidth = Math.max(maxWidth, tempSpan.offsetWidth + 30);
                tempSpan.remove();
            });
            textarea.style.width = `${maxWidth}px`;

            // Expand height using scrollHeight
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        };
        textarea.addEventListener('input', autoExpand);
        autoExpand();
        textarea.focus();
        textarea.select();

        const removeTextarea = (save = true) => {
            if (save) {
                updateNode(node.id, { text: textarea.value || 'Text' });
            }
            // If not saving, just close without updating
            textarea.remove();
            toolbar.remove();
            document.removeEventListener('mousedown', closeDropdownOnClickOutside);
            setEditingTextId(null);
        };

        textarea.addEventListener('blur', (e) => {
            // Don't remove if clicking on toolbar
            if (e.relatedTarget && toolbar.contains(e.relatedTarget)) {
                textarea.focus();
                return;
            }
            removeTextarea(true);
        });
        textarea.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' && (e.ctrlKey || e.shiftKey))) { e.preventDefault(); removeTextarea(true); }
            if (e.key === 'Escape') { e.preventDefault(); removeTextarea(false); }
        });
    }, [updateNode, stageScale]);

    const handleDragEnd = useCallback((e, id) => updateNode(id, { x: e.target.x(), y: e.target.y() }), [updateNode]);

    const handleTransformEnd = useCallback((e, id, type) => {
        const n = e.target;
        const sx = n.scaleX(), sy = n.scaleY();
        n.scaleX(1); n.scaleY(1);

        if (type === 'rectangle' || type === 'image' || type === 'youtube' || type === 'diamond' || type === 'audio' || type === 'video') {
            updateNode(id, { x: n.x(), y: n.y(), width: Math.max(20, n.width() * sx), height: Math.max(20, n.height() * sy) });
        } else if (type === 'circle' || type === 'triangle' || type === 'hexagon') {
            updateNode(id, { x: n.x(), y: n.y(), radius: Math.max(10, n.radius() * Math.max(sx, sy)) });
        } else if (type === 'star') {
            updateNode(id, { x: n.x(), y: n.y(), innerRadius: Math.max(5, n.innerRadius() * sx), outerRadius: Math.max(10, n.outerRadius() * sx) });
        } else if (type === 'text') {
            updateNode(id, { x: n.x(), y: n.y(), fontSize: Math.max(8, Math.round(n.fontSize() * sy)) });
        }
    }, [updateNode]);

    const renderNode = (node) => {
        // When using drawing tools, make nodes non-interactive so clicks pass through
        const isDrawingTool = tool === 'shape' || tool === 'text' || tool === 'pen';

        const props = {
            key: node.id, id: node.id,
            draggable: tool === 'select', // Objects draggable in select mode; Konva prioritizes inner element over stage
            listening: !isDrawingTool, // Disable listening when drawing to allow clicks to pass through
            onClick: (e) => handleClick(e, node.id),
            onTap: (e) => handleClick(e, node.id),
            onDblClick: (e) => handleDblClick(e, node),
            onDblTap: (e) => handleDblClick(e, node),
            onMouseDown: (e) => {
                // Track button and prevent drag for non-left buttons
                const button = e.evt ? e.evt.button : 0;
                mouseButtonRef.current = button;
                if (button !== 0) {
                    e.cancelBubble = true;
                    if (e.target && e.target.stopDrag) {
                        e.target.stopDrag();
                    }
                } else if (tool === 'select') {
                    // Stop stage drag so only the object drags, not the canvas
                    const stage = stageRef.current;
                    if (stage) stage.stopDrag();
                }
            },
            onDragStart: (e) => {
                // Check both event button and tracked button
                const eventButton = e.evt ? e.evt.button : 0;
                if (eventButton !== 0 || mouseButtonRef.current !== 0) {
                    e.target.stopDrag();
                    return;
                }
            },
            onDragEnd: (e) => handleDragEnd(e, node.id),
            onTransformEnd: (e) => handleTransformEnd(e, node.id, node.type),
        };

        switch (node.type) {
            case 'rectangle':
                return <Rect {...props} x={node.x} y={node.y} width={node.width} height={node.height} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} cornerRadius={4} />;
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
                return <Arrow {...props} points={node.points} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} pointerLength={node.pointerLength} pointerWidth={node.pointerWidth} />;
            case 'simpleLine':
                return <Line {...props} points={node.points} stroke={node.stroke} strokeWidth={node.strokeWidth} lineCap="round" />;
            case 'diamond':
                const hw = node.width / 2, hh = node.height / 2;
                return <Line {...props} x={node.x} y={node.y} points={[0, -hh, hw, 0, 0, hh, -hw, 0]} closed fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            case 'pentagon':
                return <RegularPolygon {...props} x={node.x} y={node.y} sides={5} radius={node.radius} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            case 'hexagon':
                return <RegularPolygon {...props} x={node.x} y={node.y} sides={6} radius={node.radius} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            case 'octagon':
                return <RegularPolygon {...props} x={node.x} y={node.y} sides={8} radius={node.radius} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
            case 'heart':
                return (
                    <Shape
                        {...props}
                        sceneFunc={(ctx, shape) => {
                            const s = node.size / 2;
                            ctx.beginPath();
                            ctx.moveTo(0, s * 0.4);
                            ctx.bezierCurveTo(-s, -s * 0.3, -s, -s * 0.8, 0, -s * 0.4);
                            ctx.bezierCurveTo(s, -s * 0.8, s, -s * 0.3, 0, s * 0.4);
                            ctx.closePath();
                            ctx.fillStrokeShape(shape);
                        }}
                        x={node.x}
                        y={node.y}
                        fill={node.fill}
                        stroke={node.stroke}
                        strokeWidth={node.strokeWidth}
                    />
                );
            case 'cloud':
                return (
                    <Shape
                        {...props}
                        sceneFunc={(ctx, shape) => {
                            const w = node.width / 2;
                            const h = node.height / 2;
                            ctx.beginPath();
                            ctx.moveTo(-w * 0.3, h * 0.5);
                            ctx.bezierCurveTo(-w * 0.8, h * 0.5, -w, 0, -w * 0.6, -h * 0.3);
                            ctx.bezierCurveTo(-w * 0.8, -h * 0.8, -w * 0.2, -h, 0, -h * 0.6);
                            ctx.bezierCurveTo(w * 0.3, -h, w * 0.8, -h * 0.6, w * 0.7, -h * 0.2);
                            ctx.bezierCurveTo(w, 0, w * 0.9, h * 0.5, w * 0.4, h * 0.5);
                            ctx.closePath();
                            ctx.fillStrokeShape(shape);
                        }}
                        x={node.x + node.width / 2}
                        y={node.y + node.height / 2}
                        fill={node.fill}
                        stroke={node.stroke}
                        strokeWidth={node.strokeWidth}
                    />
                );
            case 'cross':
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
            case 'text':
                return editingTextId === node.id ? null : (
                    <Text
                        {...props}
                        x={node.x}
                        y={node.y}
                        text={node.text}
                        fontSize={node.fontSize}
                        fill={node.fill}
                        fontFamily="Arial"
                        fontStyle={node.fontStyle || 'normal'}
                        align={node.align || 'left'}
                    />
                );
            case 'line':
                return <Line {...props} points={node.points} stroke={node.stroke} strokeWidth={node.strokeWidth} hitStrokeWidth={Math.max(20, node.strokeWidth * 2)} lineCap="round" lineJoin="round" tension={0.5} />;
            case 'image':
                return <ImageNode key={node.id} node={node} commonProps={props} />;
            case 'youtube':
                return <YoutubeNode key={node.id} node={node} commonProps={props} />;
            case 'audio':
                return <AudioNode key={node.id} node={node} commonProps={props} />;
            case 'video':
                return <VideoNode key={node.id} node={node} commonProps={props} />;
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
        const previewProps = { fill: fillColor, stroke: strokeColor, strokeWidth, opacity: 0.6 };

        switch (type) {
            case 'rectangle':
                return <Rect x={x} y={y} width={width} height={height} {...previewProps} cornerRadius={4} />;
            case 'roundedRect':
                return <Rect x={x} y={y} width={width} height={height} {...previewProps} cornerRadius={15} />;
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
                            const s = size / 2;
                            ctx.beginPath();
                            ctx.moveTo(0, s * 0.4);
                            ctx.bezierCurveTo(-s, -s * 0.3, -s, -s * 0.8, 0, -s * 0.4);
                            ctx.bezierCurveTo(s, -s * 0.8, s, -s * 0.3, 0, s * 0.4);
                            ctx.closePath();
                            ctx.fillStrokeShape(shape);
                        }}
                        x={centerX}
                        y={centerY}
                        {...previewProps}
                    />
                );
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
            case 'cross':
                const cs = size / 2;
                const cw = cs * 0.35;
                return <Line x={centerX} y={centerY} points={[-cw, -cs, cw, -cs, cw, -cw, cs, -cw, cs, cw, cw, cw, cw, cs, -cw, cs, -cw, cw, -cs, cw, -cs, -cw, -cw, -cw]} closed {...previewProps} />;
            default:
                return null;
        }
    };

    const getCursor = () => {
        if (tool === 'eraser') {
            // Custom eraser cursor - a small square
            return `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23666" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="4" y1="20" x2="20" y2="4"/></svg>') 12 12, auto`;
        }
        if (tool === 'shape' || tool === 'pen') return 'crosshair';
        if (tool === 'text') return 'text';
        return 'default';
    };

    return (
        <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: '#f5f6f8', cursor: getCursor() }}>
            <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                scaleX={stageScale}
                scaleY={stageScale}
                x={stagePosition.x}
                y={stagePosition.y}
                draggable={true}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
                onDragEnd={(e) => { if (e.target === e.target.getStage()) setStagePosition({ x: e.target.x(), y: e.target.y() }); }}
            >
                <Layer ref={layerRef}>
                    {nodes.map(renderNode)}
                    {renderDrawingPreview()}
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
            </Stage>
        </div>
    );
}
