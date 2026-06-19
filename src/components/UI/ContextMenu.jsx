import { useEffect, useRef, useState } from 'react';
import { ArrowUpToLine, ArrowDownToLine, Copy, Lock, Unlock, Trash2, Crop, Eraser, FileDown, Scissors } from 'lucide-react';
import useStore from '../../store/useStore';
import { loadMediaFromDB } from '../../store/useStore';
import { renderPdfPage, base64ToBytes } from '../../utils/pdfHelpers';

// --- Crop Overlay with 6 handles ---
function openCropOverlay(node, updateNode) {
    const overlay = document.createElement('div');
    overlay.id = 'crop-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;flex-direction:column;';

    const container = document.createElement('div');
    container.style.cssText = 'position:relative;display:inline-block;';

    const img = document.createElement('img');
    img.src = node.src;
    img.style.cssText = 'max-width:75vw;max-height:65vh;display:block;user-select:none;';
    container.appendChild(img);

    // Crop region state
    let cx = 0, cy = 0, cw = 0, ch = 0;

    // Darken overlay divs (top, bottom, left, right)
    const darkTop = document.createElement('div');
    const darkBot = document.createElement('div');
    const darkLeft = document.createElement('div');
    const darkRight = document.createElement('div');
    [darkTop, darkBot, darkLeft, darkRight].forEach(d => {
        d.style.cssText = 'position:absolute;background:rgba(0,0,0,0.5);pointer-events:none;';
        container.appendChild(d);
    });

    // Crop border
    const cropBorder = document.createElement('div');
    cropBorder.style.cssText = 'position:absolute;border:2px solid #fff;pointer-events:none;box-shadow:0 0 0 9999px rgba(0,0,0,0.0);';
    container.appendChild(cropBorder);

    // 6 handles: TL, TC, TR, ML, MR, BL, BC, BR -> actually 8 but user asked for 6: TL, TR, BL, BR, MC-top, MC-bot
    // Let's use: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right = 6 handles
    const handles = [];
    const handlePositions = ['tl', 'tc', 'tr', 'bl', 'bc', 'br'];
    handlePositions.forEach(pos => {
        const h = document.createElement('div');
        h.dataset.handle = pos;
        h.style.cssText = 'position:absolute;width:12px;height:12px;background:#fff;border:2px solid #7c3aed;border-radius:50%;cursor:pointer;z-index:10;transform:translate(-50%,-50%);';
        container.appendChild(h);
        handles.push(h);
    });

    function updateCropUI() {
        cropBorder.style.left = cx + 'px';
        cropBorder.style.top = cy + 'px';
        cropBorder.style.width = cw + 'px';
        cropBorder.style.height = ch + 'px';
        // Dark overlays
        darkTop.style.left = '0'; darkTop.style.top = '0'; darkTop.style.width = '100%'; darkTop.style.height = cy + 'px';
        darkBot.style.left = '0'; darkBot.style.top = (cy + ch) + 'px'; darkBot.style.width = '100%'; darkBot.style.bottom = '0';
        darkLeft.style.left = '0'; darkLeft.style.top = cy + 'px'; darkLeft.style.width = cx + 'px'; darkLeft.style.height = ch + 'px';
        darkRight.style.left = (cx + cw) + 'px'; darkRight.style.top = cy + 'px'; darkRight.style.right = '0'; darkRight.style.height = ch + 'px';
        // Handles
        handles.forEach(h => {
            const p = h.dataset.handle;
            const hx = p.includes('l') ? cx : p.includes('r') ? cx + cw : cx + cw / 2;
            const hy = p.includes('t') ? cy : p.includes('b') ? cy + ch : cy + ch / 2;
            h.style.left = hx + 'px';
            h.style.top = hy + 'px';
            h.style.cursor = p === 'tl' || p === 'br' ? 'nwse-resize' : p === 'tr' || p === 'bl' ? 'nesw-resize' : p === 'tc' || p === 'bc' ? 'ns-resize' : 'ew-resize';
        });
    }

    img.onload = () => {
        const margin = 20;
        cx = margin; cy = margin;
        cw = img.offsetWidth - margin * 2;
        ch = img.offsetHeight - margin * 2;
        updateCropUI();
    };

    // Handle dragging
    let activeHandle = null, startMx = 0, startMy = 0, startCx = 0, startCy = 0, startCw = 0, startCh = 0;
    handles.forEach(h => {
        h.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            activeHandle = h.dataset.handle;
            startMx = e.clientX; startMy = e.clientY;
            startCx = cx; startCy = cy; startCw = cw; startCh = ch;
        });
    });

    function onMove(e) {
        if (!activeHandle) return;
        const dx = e.clientX - startMx;
        const dy = e.clientY - startMy;
        const imgW = img.offsetWidth, imgH = img.offsetHeight;

        if (activeHandle.includes('l')) { cx = Math.max(0, Math.min(startCx + dx, startCx + startCw - 20)); cw = startCw - (cx - startCx); }
        if (activeHandle.includes('r')) { cw = Math.max(20, Math.min(startCw + dx, imgW - startCx)); }
        if (activeHandle.includes('t')) { cy = Math.max(0, Math.min(startCy + dy, startCy + startCh - 20)); ch = startCh - (cy - startCy); }
        if (activeHandle.includes('b')) { ch = Math.max(20, Math.min(startCh + dy, imgH - startCy)); }
        // tc/bc only move vertically
        if (activeHandle === 'tc') { cy = Math.max(0, Math.min(startCy + dy, startCy + startCh - 20)); ch = startCh - (cy - startCy); }
        if (activeHandle === 'bc') { ch = Math.max(20, Math.min(startCh + dy, imgH - startCy)); }

        updateCropUI();
    }
    function onUp() { activeHandle = null; }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    // Buttons
    const btnBar = document.createElement('div');
    btnBar.style.cssText = 'display:flex;gap:12px;margin-top:16px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:10px 24px;background:#4b5563;color:#fff;border:none;border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;';
    const applyBtn = document.createElement('button');
    applyBtn.textContent = '✂ Apply Crop';
    applyBtn.style.cssText = 'padding:10px 24px;background:#7c3aed;color:#fff;border:none;border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;';

    cancelBtn.onclick = () => { cleanup(); };
    applyBtn.onclick = () => {
        if (cw < 5 || ch < 5) { cleanup(); return; }
        const scaleX = img.naturalWidth / img.offsetWidth;
        const scaleY = img.naturalHeight / img.offsetHeight;
        const cropX = cx * scaleX, cropY = cy * scaleY;
        const cropW = cw * scaleX, cropH = ch * scaleY;

        const canvas = document.createElement('canvas');
        canvas.width = cropW; canvas.height = cropH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const croppedSrc = canvas.toDataURL('image/png');
        const maxW = 500;
        const newW = cropW > maxW ? maxW : cropW;
        const newH = cropW > maxW ? (cropH * maxW / cropW) : cropH;
        updateNode(node.id, { src: croppedSrc, width: newW, height: newH });
        cleanup();
    };

    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cleanup(); }
    }

    function cleanup() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('keydown', onKey, true);
        if (overlay.parentNode) document.body.removeChild(overlay);
    }

    btnBar.appendChild(cancelBtn); btnBar.appendChild(applyBtn);
    overlay.appendChild(container); overlay.appendChild(btnBar);
    // Intentionally NOT closing on backdrop click — clicking outside the crop
    // box used to dismiss the editor mid-crop. Use Cancel / Apply / Esc instead.
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    // Wait for image to load if cached
    if (img.complete) img.onload();
}

export default function ContextMenu() {
    const { contextMenu, hideContextMenu, nodes, bringToFront, sendToBack, duplicateNode, toggleLock, deleteSelectedNodes, selectNode, updateNode, addNode, theme } = useStore();
    const isDark = theme === 'dark';
    const menuRef = useRef(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const handleClose = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) hideContextMenu();
        };
        const handleEsc = (e) => { if (e.key === 'Escape') hideContextMenu(); };
        document.addEventListener('mousedown', handleClose);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleClose);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [hideContextMenu]);

    if (!contextMenu) return null;

    const node = nodes.find(n => n.id === contextMenu.nodeId);
    if (!node) return null;

    const isLocked = !!node.locked;
    const isAnyImage = node.type === 'image'; // all images (including extracted PDF pages)
    const isImage = node.type === 'image' && !node.extractedFromPdfId; // non-extracted images only
    const isPdf = node.type === 'pdf';
    const canCrop = isAnyImage;
    const canSave = (node.type === 'image' || node.type === 'audio' || node.type === 'video') && !!node.src;

    // Download the underlying file (extracted page, image, audio or video) to disk
    const handleSaveFile = async () => {
        hideContextMenu();
        let src = node.src;
        if (!src) return;
        // Recover from IndexedDB if the in-memory src is just a placeholder
        if (typeof src === 'string' && src.startsWith('__idb__')) {
            src = await loadMediaFromDB(src.replace('__idb__', '')) || await loadMediaFromDB(node.id);
        }
        if (!src) return;

        let name = node.fileName;
        if (!name) {
            if (node.type === 'image') name = node.extractedFromPdfId ? 'extracted-page.png' : 'image.png';
            else if (node.type === 'audio') name = 'audio';
            else if (node.type === 'video') name = 'video';
            else name = 'file';
        }
        const a = document.createElement('a');
        a.href = src;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleCrop = () => {
        if (!node.src) return;
        hideContextMenu();
        openCropOverlay(node, updateNode);
    };

    // PDF: Crop the current page — renders page as image, opens crop overlay, saves result as new image node
    const handleCropPdfPage = async () => {
        hideContextMenu();
        setIsProcessing(true);
        try {
            const pdfBase64 = await loadMediaFromDB(`${node.id}_pdf`);
            if (!pdfBase64) { setIsProcessing(false); return; }
            const bytes = base64ToBytes(pdfBase64);
            const pageNum = node.currentPage || 1;
            const { dataUrl } = await renderPdfPage(bytes, pageNum, 2);

            // Create a temporary fake node for the crop overlay
            const tempNode = {
                id: '__pdf_crop_temp__',
                src: dataUrl,
                x: node.x,
                y: node.y + (node.height || 400) + 40,
                width: node.width || 300,
                height: node.height || 400,
            };

            // Open crop overlay — on apply, create a new image node with the cropped result
            openCropOverlay(tempNode, (_id, updates) => {
                if (updates.src) {
                    addNode({
                        type: 'image',
                        x: node.x + (node.width || 300) + 30,
                        y: node.y,
                        width: updates.width || 300,
                        height: updates.height || 400,
                        src: updates.src,
                        extractedFromPdfId: node.id,
                    });
                }
            });
        } catch (e) {
            console.error('PDF crop error:', e);
        } finally {
            setIsProcessing(false);
        }
    };

    // PDF: Download the current page as PNG
    const handleDownloadPdfPage = async () => {
        hideContextMenu();
        try {
            const pdfBase64 = await loadMediaFromDB(`${node.id}_pdf`);
            if (!pdfBase64) return;
            const bytes = base64ToBytes(pdfBase64);
            const pageNum = node.currentPage || 1;
            const { dataUrl } = await renderPdfPage(bytes, pageNum, 2);
            const a = document.createElement('a');
            a.href = dataUrl;
            const baseName = (node.fileName || 'pdf').replace(/\.pdf$/i, '');
            a.download = `${baseName}_page${pageNum}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            console.error('PDF page download error:', e);
        }
    };

    const handleRemoveBg = async () => {
        if (!node.src) return;
        setIsProcessing(true);
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = node.src; });
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const threshold = 235;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold) {
                    data[i + 3] = 0;
                }
            }
            ctx.putImageData(imageData, 0, 0);
            const resultBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            const reader = new FileReader();
            reader.onload = () => {
                updateNode(node.id, { src: reader.result });
                // Re-select the node to refresh the transformer and prevent frozen handles
                const { clearSelection, selectNode } = useStore.getState();
                clearSelection();
                setTimeout(() => selectNode(node.id), 50);
            };
            reader.readAsDataURL(resultBlob);
        } catch (e) {
            console.error('Failed to remove background:', e);
        } finally {
            setIsProcessing(false);
            hideContextMenu();
        }
    };

    const actions = [
        { label: 'Bring to Front', icon: ArrowUpToLine, action: () => bringToFront(node.id) },
        { label: 'Send to Back', icon: ArrowDownToLine, action: () => sendToBack(node.id) },
        { divider: true },
        { label: 'Duplicate', icon: Copy, action: () => duplicateNode(node.id) },
        { label: isLocked ? 'Unlock' : 'Lock', icon: isLocked ? Unlock : Lock, action: () => toggleLock(node.id) },
        ...(canSave ? [
            { divider: true },
            { label: 'Save', icon: FileDown, action: handleSaveFile },
        ] : []),
        ...(canCrop ? [
            { divider: true },
            { label: 'Crop', icon: Crop, action: handleCrop },
        ] : []),
        ...(isImage ? [
            { label: isProcessing ? 'Removing BG...' : 'Remove Background', icon: Eraser, action: handleRemoveBg, disabled: isProcessing },
        ] : []),
        ...(isPdf ? [
            { divider: true },
            { label: 'Crop Page', icon: Scissors, action: handleCropPdfPage, disabled: isProcessing },
            { label: `Download Page ${node.currentPage || 1} as PNG`, icon: FileDown, action: handleDownloadPdfPage },
        ] : []),
        { divider: true },
        { label: 'Delete', icon: Trash2, action: () => { selectNode(node.id); deleteSelectedNodes(); }, danger: true },
    ];

    const menuWidth = 220;
    const menuHeight = (canCrop || isPdf) ? 420 : (canSave ? 300 : 250);
    const x = Math.min(contextMenu.x, window.innerWidth - menuWidth - 10);
    const y = Math.min(contextMenu.y, window.innerHeight - menuHeight - 10);

    return (
        <div ref={menuRef} className="fixed z-[200]" style={{ left: x, top: y }}>
            <div className={`rounded-xl shadow-xl border py-1 min-w-[180px] ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                {actions.map((item, i) =>
                    item.divider ? (
                        <div key={i} className={`border-t my-1 ${isDark ? 'border-gray-700' : 'border-gray-100'}`} />
                    ) : (
                        <button
                            key={i}
                            onClick={() => { if (!item.disabled) { item.action(); if (item.label !== 'Crop' && item.label !== 'Crop Page') hideContextMenu(); } }}
                            disabled={item.disabled}
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${item.danger
                                ? 'text-red-500 hover:bg-red-900/20'
                                : item.disabled
                                    ? isDark ? 'text-gray-600' : 'text-gray-300'
                                    : isDark
                                        ? 'text-gray-300 hover:bg-gray-700'
                                        : 'text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </button>
                    )
                )}
            </div>
        </div>
    );
}
