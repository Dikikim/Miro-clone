import { useState, useEffect, useCallback, useRef } from 'react';
import { Copy, Download, ChevronLeft, ChevronRight, X, Check, FileDown, ZoomIn, ZoomOut } from 'lucide-react';
import useStore from '../../store/useStore';
import LogoSpinner from '../UI/LogoSpinner';
import { loadMediaFromDB } from '../../store/useStore';
import { renderPdfPage, base64ToBytes } from '../../utils/pdfHelpers';

/**
 * Helper to load PDF bytes from IndexedDB for a given node.
 * Returns Uint8Array or null.
 */
async function getPdfBytes(nodeId) {
    const pdfBase64 = await loadMediaFromDB(`${nodeId}_pdf`);
    if (!pdfBase64) {
        console.error('PDF data not found in IndexedDB for node:', nodeId);
        return null;
    }
    return base64ToBytes(pdfBase64);
}

/**
 * PdfOverlay — HTML overlay rendered on top of the Konva canvas,
 * positioned to follow a PDF node. Shows doc name, page nav,
 * extract pages, and download buttons.
 */
export default function PdfOverlay({ node, stagePosition, stageScale, isSelected }) {
    const { updateNode, addNode } = useStore();
    const [showExtractModal, setShowExtractModal] = useState(false);
    const [showSinglePage, setShowSinglePage] = useState(false);
    const [showMultiPage, setShowMultiPage] = useState(false);
    const [navigating, setNavigating] = useState(false);
    const [editingPage, setEditingPage] = useState(false);
    const [pageInputValue, setPageInputValue] = useState('');

    // Calculate screen position of the node
    const screenX = node.x * stageScale + stagePosition.x;
    const screenY = (node.y + node.height) * stageScale + stagePosition.y;
    const barWidth = node.width * stageScale;

    // Truncate file name
    const truncatedName = node.fileName.length > 20
        ? node.fileName.substring(0, 18) + '...'
        : node.fileName;

    // Page navigation
    const goToPrevPage = useCallback(async () => {
        if (node.currentPage <= 1 || navigating) return;
        setNavigating(true);
        try {
            const bytes = await getPdfBytes(node.id);
            if (!bytes) { setNavigating(false); return; }
            const newPage = node.currentPage - 1;
            const { dataUrl } = await renderPdfPage(bytes, newPage, 1.5);
            updateNode(node.id, { currentPage: newPage, coverSrc: dataUrl });
        } catch (e) {
            console.error('Page nav error:', e);
        }
        setNavigating(false);
    }, [node.id, node.currentPage, navigating, updateNode]);

    const goToNextPage = useCallback(async () => {
        if (node.currentPage >= node.totalPages || navigating) return;
        setNavigating(true);
        try {
            const bytes = await getPdfBytes(node.id);
            if (!bytes) { setNavigating(false); return; }
            const newPage = node.currentPage + 1;
            const { dataUrl } = await renderPdfPage(bytes, newPage, 1.5);
            updateNode(node.id, { currentPage: newPage, coverSrc: dataUrl });
        } catch (e) {
            console.error('Page nav error:', e);
        }
        setNavigating(false);
    }, [node.id, node.currentPage, node.totalPages, navigating, updateNode]);

    // Go to specific page
    const goToPage = useCallback(async (pageNum) => {
        const target = Math.max(1, Math.min(parseInt(pageNum, 10), node.totalPages));
        if (isNaN(target) || target === node.currentPage || navigating) return;
        setNavigating(true);
        try {
            const bytes = await getPdfBytes(node.id);
            if (!bytes) { setNavigating(false); return; }
            const { dataUrl } = await renderPdfPage(bytes, target, 1.5);
            updateNode(node.id, { currentPage: target, coverSrc: dataUrl });
        } catch (e) {
            console.error('Page nav error:', e);
        }
        setNavigating(false);
    }, [node.id, node.currentPage, node.totalPages, navigating, updateNode]);

    // Download original PDF
    const handleDownload = useCallback(async () => {
        try {
            const bytes = await getPdfBytes(node.id);
            if (!bytes) return;
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = node.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Download error:', e);
        }
    }, [node.id, node.fileName]);

    // Download the current page as PNG
    const handleDownloadPage = useCallback(async () => {
        try {
            const bytes = await getPdfBytes(node.id);
            if (!bytes) return;
            const { dataUrl } = await renderPdfPage(bytes, node.currentPage, 2);
            const a = document.createElement('a');
            a.href = dataUrl;
            const baseName = node.fileName.replace(/\.pdf$/i, '');
            a.download = `${baseName}_page${node.currentPage}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            console.error('Download page error:', e);
        }
    }, [node.id, node.fileName, node.currentPage]);

    // Don't render if the node would be off-screen
    if (screenX + barWidth < -100 || screenX > window.innerWidth + 100 ||
        screenY < -100 || screenY > window.innerHeight + 100) {
        return null;
    }

    return (
        <>
            {/* Bottom toolbar bar */}
            <div
                style={{
                    position: 'fixed',
                    left: `${screenX}px`,
                    top: `${screenY + 4}px`,
                    width: isSelected ? `${Math.max(barWidth, 360)}px` : 'auto',
                    zIndex: 30,
                    pointerEvents: 'auto',
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#1e1e1e',
                    borderRadius: '8px',
                    padding: isSelected ? '4px 8px' : '4px 10px',
                    gap: '4px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    fontSize: '13px',
                    color: '#e0e0e0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s ease',
                    overflow: 'hidden',
                }}>
                    {/* Document name — always visible */}
                    <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: isSelected ? '140px' : '180px',
                        fontSize: '12px',
                        flex: isSelected ? '1' : 'none',
                    }}>
                        {truncatedName}
                    </span>

                    {/* Expanded controls — only when selected */}
                    {isSelected && (
                        <>
                            {/* Page nav */}
                            <OverlayButton
                                onClick={goToPrevPage}
                                disabled={node.currentPage <= 1 || navigating}
                                title="Previous page"
                            >
                                <ChevronLeft size={16} />
                            </OverlayButton>
                            <span style={{ fontSize: '12px', minWidth: '70px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                {editingPage ? (
                                    <input
                                        autoFocus
                                        type="number"
                                        min={1}
                                        max={node.totalPages}
                                        value={pageInputValue}
                                        onChange={(e) => setPageInputValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                goToPage(pageInputValue);
                                                setEditingPage(false);
                                            }
                                            if (e.key === 'Escape') setEditingPage(false);
                                        }}
                                        onBlur={() => {
                                            goToPage(pageInputValue);
                                            setEditingPage(false);
                                        }}
                                        style={{
                                            width: '38px',
                                            background: '#333',
                                            border: '1px solid #0ea5e9',
                                            borderRadius: '4px',
                                            color: '#fff',
                                            textAlign: 'center',
                                            fontSize: '12px',
                                            padding: '1px 2px',
                                            outline: 'none',
                                            MozAppearance: 'textfield',
                                        }}
                                    />
                                ) : (
                                    <span
                                        onClick={() => { setPageInputValue(String(node.currentPage)); setEditingPage(true); }}
                                        style={{ cursor: 'pointer', borderBottom: '1px dashed #666', padding: '0 2px' }}
                                        title="Click to type a page number"
                                    >
                                        {node.currentPage}
                                    </span>
                                )}
                                {' '}of {node.totalPages}
                            </span>
                            <OverlayButton
                                onClick={goToNextPage}
                                disabled={node.currentPage >= node.totalPages || navigating}
                                title="Next page"
                            >
                                <ChevronRight size={16} />
                            </OverlayButton>

                            {/* Divider */}
                            <div style={{ width: '1px', height: '20px', background: '#444', margin: '0 4px' }} />

                            {/* Extract pages */}
                            <OverlayButton
                                onClick={() => setShowExtractModal(true)}
                                title="Extract pages to canvas"
                            >
                                <Copy size={16} />
                            </OverlayButton>


                            {/* Download current page as PNG */}
                            <OverlayButton onClick={handleDownloadPage} title="Download current page as PNG">
                                <FileDown size={16} />
                            </OverlayButton>

                            {/* Download full PDF */}
                            <OverlayButton onClick={handleDownload} title="Download full PDF">
                                <Download size={16} />
                            </OverlayButton>
                        </>
                    )}
                </div>
            </div>

            {/* Single-page viewer modal */}
            {showSinglePage && (
                <SinglePageModal
                    node={node}
                    onClose={() => setShowSinglePage(false)}
                    onNavigate={goToPage}
                    navigating={navigating}
                    onDownloadPage={handleDownloadPage}
                />
            )}

            {/* Multi-page grid viewer modal */}
            {showMultiPage && (
                <MultiPageModal
                    node={node}
                    onClose={() => setShowMultiPage(false)}
                    onNavigate={goToPage}
                />
            )}

            {/* Extract pages modal */}
            {showExtractModal && (
                <ExtractPagesModal
                    node={node}
                    onClose={() => setShowExtractModal(false)}
                    addNode={addNode}
                    stagePosition={stagePosition}
                    stageScale={stageScale}
                />
            )}
        </>
    );
}

/**
 * Single Page Viewer Modal — full-screen overlay showing one PDF page.
 * Supports prev/next navigation and downloading the current page as PNG.
 */
function SinglePageModal({ node, onClose, onNavigate }) {
    const [pageImage, setPageImage] = useState(null);
    const [loadingPage, setLoadingPage] = useState(true);
    const [currentPage, setCurrentPage] = useState(node.currentPage || 1);
    const totalPages = node.totalPages || 1;
    const pdfBytesRef = useRef(null);
    // Page to show on open; later navigation renders via goToPage, not this effect
    const initialPageRef = useRef(node.currentPage || 1);

    // Load PDF bytes once
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const bytes = await getPdfBytes(node.id);
                if (!cancelled && bytes) {
                    pdfBytesRef.current = bytes;
                    const { dataUrl } = await renderPdfPage(bytes, initialPageRef.current, 2);
                    if (!cancelled) { setPageImage(dataUrl); setLoadingPage(false); }
                } else if (!cancelled) {
                    setLoadingPage(false);
                }
            } catch (e) {
                console.error('SinglePageModal load error:', e);
                if (!cancelled) setLoadingPage(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [node.id]);

    const goToPage = useCallback(async (pageNum) => {
        const target = Math.max(1, Math.min(parseInt(pageNum, 10), totalPages));
        if (isNaN(target) || !pdfBytesRef.current) return;
        setLoadingPage(true);
        setCurrentPage(target);
        try {
            const { dataUrl } = await renderPdfPage(pdfBytesRef.current, target, 2);
            setPageImage(dataUrl);
            // Sync the canvas node page too
            onNavigate(target);
        } catch (e) {
            console.error('SinglePageModal nav error:', e);
        }
        setLoadingPage(false);
    }, [totalPages, onNavigate]);

    // Download this modal's current page
    const downloadThisPage = useCallback(async () => {
        if (!pdfBytesRef.current || !pageImage) return;
        const a = document.createElement('a');
        a.href = pageImage;
        const baseName = node.fileName.replace(/\.pdf$/i, '');
        a.download = `${baseName}_page${currentPage}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }, [node.fileName, currentPage, pageImage]);

    // Close on Escape
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[200] flex flex-col"
            style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(4px)' }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <span className="text-white font-semibold text-sm truncate max-w-[300px]">
                        {node.fileName}
                    </span>
                    <span className="text-gray-400 text-xs">
                        Page {currentPage} of {totalPages}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Download current page */}
                    <button
                        onClick={downloadThisPage}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors"
                        title="Download this page as PNG"
                    >
                        <FileDown size={14} />
                        Download page
                    </button>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title="Close (Esc)"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Page image */}
            <div className="flex-1 flex items-center justify-center overflow-auto p-6">
                {loadingPage ? (
                    <div className="flex flex-col items-center gap-3 text-white">
                        <LogoSpinner className="w-14 h-14" />
                        <span className="text-sm text-gray-400">Rendering page...</span>
                    </div>
                ) : pageImage ? (
                    <img
                        src={pageImage}
                        alt={`Page ${currentPage}`}
                        style={{
                            maxHeight: 'calc(100vh - 140px)',
                            maxWidth: '100%',
                            objectFit: 'contain',
                            borderRadius: '6px',
                            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                        }}
                    />
                ) : (
                    <div className="text-gray-400 text-sm">Could not render page</div>
                )}
            </div>

            {/* Bottom navigation */}
            <div className="flex items-center justify-center gap-4 py-4 border-t border-white/10">
                <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1 || loadingPage}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <span className="text-white text-sm min-w-[80px] text-center">
                    {currentPage} / {totalPages}
                </span>
                <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages || loadingPage}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    );
}

/**
 * Multi-page grid viewer — shows up to 10 page thumbnails at once.
 */
function MultiPageModal({ node, onClose, onNavigate }) {
    const totalPages = node.totalPages || 1;
    const PAGES_PER_VIEW = 10;
    const [startPage, setStartPage] = useState(Math.max(1, Math.floor((node.currentPage - 1) / PAGES_PER_VIEW) * PAGES_PER_VIEW + 1));
    const [thumbnails, setThumbnails] = useState({});
    const [loadingThumbnails, setLoadingThumbnails] = useState(true);
    const pdfBytesRef = useRef(null);

    const endPage = Math.min(startPage + PAGES_PER_VIEW - 1, totalPages);
    const totalGroups = Math.ceil(totalPages / PAGES_PER_VIEW);
    const currentGroup = Math.floor((startPage - 1) / PAGES_PER_VIEW) + 1;

    // Load PDF bytes once and render thumbnails for current group
    useEffect(() => {
        let cancelled = false;
        const loadThumbs = async () => {
            setLoadingThumbnails(true);
            try {
                if (!pdfBytesRef.current) {
                    const bytes = await getPdfBytes(node.id);
                    if (!bytes || cancelled) { setLoadingThumbnails(false); return; }
                    pdfBytesRef.current = bytes;
                }
                const newThumbs = {};
                for (let p = startPage; p <= endPage; p++) {
                    if (cancelled) break;
                    const { dataUrl } = await renderPdfPage(pdfBytesRef.current, p, 0.8);
                    newThumbs[p] = dataUrl;
                }
                if (!cancelled) { setThumbnails(prev => ({ ...prev, ...newThumbs })); setLoadingThumbnails(false); }
            } catch (e) {
                console.error('Multi-page load error:', e);
                if (!cancelled) setLoadingThumbnails(false);
            }
        };
        loadThumbs();
        return () => { cancelled = true; };
    }, [node.id, startPage, endPage]);

    const goToGroup = (dir) => {
        const newStart = dir > 0
            ? Math.min(startPage + PAGES_PER_VIEW, (totalGroups - 1) * PAGES_PER_VIEW + 1)
            : Math.max(1, startPage - PAGES_PER_VIEW);
        setStartPage(newStart);
    };

    const handlePageClick = (pageNum) => {
        onNavigate(pageNum);
        onClose();
    };

    // Close on Escape
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const pages = [];
    for (let p = startPage; p <= endPage; p++) pages.push(p);

    return (
        <div
            className="fixed inset-0 z-[200] flex flex-col"
            style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(4px)' }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <span className="text-white font-semibold text-sm truncate max-w-[300px]">
                        {node.fileName}
                    </span>
                    <span className="text-gray-400 text-xs">
                        Pages {startPage}–{endPage} of {totalPages}
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    title="Close (Esc)"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Thumbnail grid */}
            <div className="flex-1 overflow-auto p-6">
                {loadingThumbnails && Object.keys(thumbnails).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-white">
                        <LogoSpinner className="w-14 h-14" />
                        <span className="text-sm text-gray-400">Rendering pages...</span>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: '16px',
                        maxWidth: '900px',
                        margin: '0 auto',
                    }}>
                        {pages.map(p => (
                            <div
                                key={p}
                                onClick={() => handlePageClick(p)}
                                style={{
                                    cursor: 'pointer',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: p === node.currentPage ? '3px solid #3b82f6' : '2px solid rgba(255,255,255,0.15)',
                                    background: '#1a1a1a',
                                    transition: 'border-color 0.2s, transform 0.15s',
                                    aspectRatio: '3/4',
                                }}
                                className="hover:border-blue-400 hover:scale-[1.03]"
                            >
                                {thumbnails[p] ? (
                                    <img
                                        src={thumbnails[p]}
                                        alt={`Page ${p}`}
                                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f9fafb' }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <LogoSpinner className="w-7 h-7" />
                                    </div>
                                )}
                                <div style={{
                                    textAlign: 'center',
                                    fontSize: '11px',
                                    color: p === node.currentPage ? '#60a5fa' : '#9ca3af',
                                    fontWeight: p === node.currentPage ? '600' : '400',
                                    padding: '4px 0',
                                    background: '#1a1a1a',
                                    marginTop: '-1px',
                                }}>
                                    {p}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom navigation between groups */}
            {totalGroups > 1 && (
                <div className="flex items-center justify-center gap-4 py-4 border-t border-white/10">
                    <button
                        onClick={() => goToGroup(-1)}
                        disabled={startPage <= 1}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-white text-sm min-w-[100px] text-center">
                        Group {currentGroup} / {totalGroups}
                    </span>
                    <button
                        onClick={() => goToGroup(1)}
                        disabled={startPage + PAGES_PER_VIEW > totalPages}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * Simple styled button for the overlay toolbar
 */
function OverlayButton({ children, onClick, disabled, title }) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick?.(); }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={disabled}
            title={title}
            style={{
                background: 'transparent',
                border: 'none',
                color: disabled ? '#555' : '#e0e0e0',
                cursor: disabled ? 'default' : 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { if (!disabled) e.target.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
        >
            {children}
        </button>
    );
}


/**
 * Full-size page viewer — opens a single PDF page large, with zoom in/out,
 * scrolling, and fit-to-screen. Only the X (or Esc) closes it; clicking the
 * backdrop does NOT, so the preview stays put until explicitly dismissed.
 */
function PageZoomViewer({ node, pageNum, totalPages, pdfBytesRef, selectedPages, onToggleSelect, onExtract, onClose }) {
    const [page, setPage] = useState(pageNum);
    const [img, setImg] = useState(null);
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [goVal, setGoVal] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const bytes = pdfBytesRef?.current || await getPdfBytes(node.id);
                if (!bytes) { if (!cancelled) setLoading(false); return; }
                const { dataUrl } = await renderPdfPage(bytes, page, 2.5);
                if (!cancelled) { setImg(dataUrl); setLoading(false); }
            } catch (e) {
                console.error('Zoom render error:', e);
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [node.id, page, pdfBytesRef]);

    const go = useCallback((p) => setPage(Math.max(1, Math.min(p, totalPages))), [totalPages]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft') go(page - 1);
            else if (e.key === 'ArrowRight') go(page + 1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, go, page]);

    const clamp = (z) => Math.min(6, Math.max(0.25, +z.toFixed(2)));
    const goTo = (v) => { const t = parseInt(v, 10); if (!isNaN(t)) { go(t); setGoVal(''); } };
    const isSelected = selectedPages.has(page);
    const btn = 'w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors';
    const navBtn = 'w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors';

    return (
        <div
            className="fixed inset-0 z-[80] flex flex-col"
            style={{ background: 'rgba(8,10,14,0.96)', backdropFilter: 'blur(4px)' }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Toolbar — accent edge; only the X (or Esc) closes the viewer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b"
                style={{ borderImage: 'linear-gradient(135deg,#7b5ea7,#4a90d9,#2ec4b6) 1', borderColor: '#4a90d9' }}>
                <span className="text-gray-200 text-sm font-medium truncate" style={{ maxWidth: '40vw' }}>
                    {node.fileName} — page {page}
                </span>
                <div className="flex items-center gap-2">
                    <button className={btn} title="Zoom out" onClick={() => setZoom(z => clamp(z - 0.25))}><ZoomOut size={16} /></button>
                    <span className="text-gray-300 text-xs w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
                    <button className={btn} title="Zoom in" onClick={() => setZoom(z => clamp(z + 0.25))}><ZoomIn size={16} /></button>
                    <button className="px-2.5 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors" title="Fit to screen" onClick={() => setZoom(1)}>Fit</button>
                    <div className="w-px h-5 bg-white/15 mx-1" />
                    <button className={btn} title="Close" onClick={onClose}><X size={18} /></button>
                </div>
            </div>
            {/* Scrollable / zoomable page (wheel scrolls; Ctrl/⌘+wheel zooms) */}
            <div
                className="flex-1 overflow-auto"
                style={{ display: 'flex' }}
                onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(z => clamp(z - e.deltaY * 0.002)); } }}
            >
                {loading ? (
                    <div className="m-auto flex flex-col items-center gap-3 text-white">
                        <LogoSpinner className="w-16 h-16" />
                        <span className="text-sm text-gray-400">Rendering page…</span>
                    </div>
                ) : img ? (
                    <img
                        src={img}
                        alt={`Page ${page}`}
                        draggable={false}
                        style={{
                            margin: 'auto',
                            height: `${80 * zoom}vh`,
                            width: 'auto',
                            maxWidth: zoom <= 1 ? '94vw' : 'none',
                            objectFit: 'contain',
                            background: '#fff',
                            borderRadius: 4,
                            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                        }}
                    />
                ) : (
                    <div className="m-auto text-gray-400 text-sm">Could not render page</div>
                )}
            </div>
            {/* Bottom bar — page navigation + select / extract */}
            <div className="flex items-center justify-center flex-wrap gap-3 px-4 py-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <button className={navBtn} disabled={page <= 1} onClick={() => go(page - 1)} title="Previous page"><ChevronLeft size={18} /></button>
                <span className="text-gray-200 text-sm tabular-nums">Page {page} of {totalPages}</span>
                <button className={navBtn} disabled={page >= totalPages} onClick={() => go(page + 1)} title="Next page"><ChevronRight size={18} /></button>

                <div className="flex items-center gap-1.5 ml-1 text-sm">
                    <span className="text-gray-400">Go to</span>
                    <input
                        type="number" min={1} max={totalPages} value={goVal} placeholder="#"
                        onChange={(e) => setGoVal(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') goTo(goVal); e.stopPropagation(); }}
                        className="w-16 text-center text-sm rounded px-1 py-0.5 bg-white/10 text-white border border-white/15 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        style={{ MozAppearance: 'textfield' }}
                    />
                    <button onClick={() => goTo(goVal)} className="px-2.5 py-1 text-xs font-medium text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors">Go</button>
                </div>

                <div className="w-px h-6 bg-white/15 mx-1" />

                {/* Select this page */}
                <button
                    onClick={() => onToggleSelect(page)}
                    className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-colors ${isSelected ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
                >
                    {isSelected ? <Check size={15} /> : <span style={{ width: 15 }} />}
                    {isSelected ? 'Selected' : 'Select page'}
                </button>
                {/* Extract the current selection */}
                <button
                    onClick={onExtract}
                    disabled={selectedPages.size === 0}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    Extract {selectedPages.size} page{selectedPages.size !== 1 ? 's' : ''}
                </button>
            </div>
        </div>
    );
}

/**
 * Modal for selecting and extracting individual pages
 * from a PDF document node onto the canvas.
 * Includes page thumbnail previews.
 */
function ExtractPagesModal({ node, onClose, addNode }) {
    const { nodes, updateNode, theme } = useStore();
    const isDark = theme === 'dark';
    const [selectedPages, setSelectedPages] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [bytesReady, setBytesReady] = useState(false);
    const [gridThumbnails, setGridThumbnails] = useState({});
    const [gridStartPage, setGridStartPage] = useState(1);
    const [gridJumpValue, setGridJumpValue] = useState('');
    const [zoomPage, setZoomPage] = useState(null);
    const [loadingGrid, setLoadingGrid] = useState(false);
    const GRID_PAGE_COUNT = 10;
    const totalPages = node.totalPages;
    const pdfBytesRef = useRef(null);

    // Load PDF bytes once
    useEffect(() => {
        let cancelled = false;
        const loadBytes = async () => {
            try {
                const bytes = await getPdfBytes(node.id);
                if (!cancelled && bytes) {
                    pdfBytesRef.current = bytes;
                    if (!cancelled) setBytesReady(true);
                }
            } catch (e) {
                console.error('PDF load error:', e);
            }
        };
        loadBytes();
        return () => { cancelled = true; };
    }, [node.id]);

    const togglePage = (p) => {
        const s = new Set(selectedPages);
        s.has(p) ? s.delete(p) : s.add(p);
        setSelectedPages(s);
    };

    // Load grid thumbnails when in grid mode
    const gridEndPage = Math.min(gridStartPage + GRID_PAGE_COUNT - 1, totalPages);
    useEffect(() => {
        if (!bytesReady || !pdfBytesRef.current) return;
        let cancelled = false;
        // Render the whole page group concurrently and drop each thumbnail into
        // the grid the instant it's ready — so pages appear progressively instead
        // of the user waiting on a spinner until the entire batch finishes.
        const load = async () => {
            setLoadingGrid(true);
            let firstShown = false;
            const tasks = [];
            for (let p = gridStartPage; p <= gridEndPage; p++) {
                tasks.push((async (page) => {
                    try {
                        const { dataUrl } = await renderPdfPage(pdfBytesRef.current, page, 0.5);
                        if (cancelled) return;
                        setGridThumbnails(prev => ({ ...prev, [page]: dataUrl }));
                        if (!firstShown) { firstShown = true; setLoadingGrid(false); }
                    } catch (e) { console.error(e); }
                })(p));
            }
            await Promise.all(tasks);
            if (!cancelled) setLoadingGrid(false);
        };
        load();
        return () => { cancelled = true; };
    }, [bytesReady, gridStartPage, gridEndPage]);

    const selectAll = () => {
        const all = new Set();
        for (let i = 1; i <= totalPages; i++) all.add(i);
        setSelectedPages(all);
    };
    const selectNone = () => setSelectedPages(new Set());

    // Jump the grid so it starts at a manually typed page.
    const jumpGridToPage = (val) => {
        const target = Math.max(1, Math.min(parseInt(val, 10), totalPages));
        if (!isNaN(target)) { setGridStartPage(target); setGridJumpValue(''); }
    };

    // Zoom in on one page: open the full-size, scrollable/zoomable page viewer.
    const previewPage = (p) => setZoomPage(p);

    const extractPages = async () => {
        if (selectedPages.size === 0) return;
        setLoading(true);

        const CELL_W = 400;         // every page occupies an identical cell
        const CELL_H = 566;
        const GAP_X = 20;
        const GAP_Y = 30;
        const COLS = 10;            // exactly 10 pages per row
        const stepX = CELL_W + GAP_X;
        const stepY = CELL_H + GAP_Y;

        const existing = nodes.filter(n => n.extractedFromPdfId === node.id);

        // A STABLE grid origin for this PDF, fixed on the first extraction and
        // stored on the PDF node. Because it never moves, every extraction keeps
        // continuing the SAME 10-per-row grid — even after pages (or the PDF) get
        // dragged around. Legacy grids with no stored origin fall back to their
        // current top-left corner.
        let baseX = node.extractGridX;
        let baseY = node.extractGridY;
        if (baseX == null || baseY == null) {
            if (existing.length > 0) {
                baseX = Math.min(...existing.map(n => n.x));
                baseY = Math.min(...existing.map(n => n.y));
            } else {
                baseX = node.x;
                baseY = node.y + (node.height || 400) + 40;
            }
            updateNode(node.id, { extractGridX: baseX, extractGridY: baseY });
        }

        // Slots already taken across all previous extractions. Each page carries
        // its own slot index, so a moved page still reserves its place and new
        // pages never reuse it (no overlap). Legacy pages without a stored slot
        // have it inferred from position.
        const occupied = new Set();
        existing.forEach(n => {
            let slot = n.pdfSlot;
            if (slot == null) {
                const c = Math.round((n.x - baseX) / stepX);
                const r = Math.round((n.y - baseY) / stepY);
                if (c >= 0 && c < COLS && r >= 0) slot = r * COLS + c;
            }
            if (slot != null && slot >= 0) occupied.add(slot);
        });
        const nextFreeSlot = () => { let i = 0; while (occupied.has(i)) i++; occupied.add(i); return i; };

        try {
            const bytes = pdfBytesRef.current || await getPdfBytes(node.id);
            if (!bytes) { setLoading(false); return; }

            const sortedPages = [...selectedPages].sort((a, b) => a - b);

            // Uniform grid: exactly COLS pages per row, every cell the same size.
            // Each page is scaled to FIT inside its cell (aspect ratio preserved,
            // so no distortion) and centred — because no image ever exceeds its
            // cell, pages can never overlap regardless of page size/orientation.
            for (let i = 0; i < sortedPages.length; i++) {
                const slot = nextFreeSlot();
                const col = slot % COLS;
                const row = Math.floor(slot / COLS);
                const cellX = baseX + col * stepX;
                const cellY = baseY + row * stepY;

                const { dataUrl, width, height } = await renderPdfPage(bytes, sortedPages[i], 2);
                const scale = Math.min(CELL_W / width, CELL_H / height);
                const imgW = Math.round(width * scale);
                const imgH = Math.round(height * scale);

                addNode({
                    type: 'image',
                    x: cellX + (CELL_W - imgW) / 2,
                    y: cellY + (CELL_H - imgH) / 2,
                    width: imgW,
                    height: imgH,
                    src: dataUrl,
                    extractedFromPdfId: node.id,
                    pdfSlot: slot,
                });
            }
        } catch (e) {
            console.error('Extract pages error:', e);
        }

        setLoading(false);
        onClose();
    };

    // Dark-mode tokens. In dark mode every menu edge gets a thin gradient border
    // in the brand "circle" colours (purple→blue→teal); light mode is unchanged.
    const ui = {
        head: isDark ? 'border-white/10' : 'border-gray-200',
        title: isDark ? 'text-gray-100' : 'text-gray-800',
        sub: isDark ? 'text-gray-400' : 'text-gray-500',
        body: isDark ? 'text-gray-300' : 'text-gray-600',
        navBtn: isDark ? 'border-white/15 text-gray-300 hover:bg-white/10' : 'border-gray-300 text-gray-600 hover:bg-gray-100',
        cellBg: isDark ? '#23262f' : '#f9fafb',
        cellBorder: isDark ? '#3a3f4b' : '#e5e7eb',
        labelBg: isDark ? 'rgba(18,20,26,0.85)' : 'rgba(255,255,255,0.85)',
        labelColor: isDark ? '#cbd5e1' : '#6b7280',
        footer: isDark ? 'bg-[#15171e]' : 'bg-gray-50',
        cancel: isDark ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100',
        inputCls: isDark ? 'border-white/15' : 'border-gray-300',
        inputStyle: isDark ? { color: '#e5e7eb', backgroundColor: '#23262f' } : { color: '#1a1a1a', backgroundColor: '#ffffff' },
    };
    const panelStyle = {
        width: '70vw', height: '70vh', border: '1px solid transparent',
        background: `linear-gradient(${isDark ? '#181a21,#181a21' : '#ffffff,#ffffff'}) padding-box, linear-gradient(135deg,#7b5ea7,#4a90d9,#2ec4b6) border-box`,
    };

    return (
        <>
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className={`rounded-xl shadow-xl overflow-hidden flex flex-col ${isDark ? '' : 'bg-white'}`} style={panelStyle}>
                {/* Header */}
                <div className={`flex items-center justify-between px-5 py-3 border-b ${ui.head}`}>
                    <div>
                        <h2 className={`font-semibold text-base ${ui.title}`}>Extract Pages</h2>
                        <p className={`text-xs mt-0.5 ${ui.sub}`}>{node.fileName} · {totalPages} page{totalPages !== 1 ? 's' : ''}</p>
                    </div>
                    <button onClick={onClose} className={`transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content area — switches between single and grid view */}
                <div className="flex-1 overflow-hidden px-5 py-4 relative flex flex-col">
                    {/* Faded logo watermark behind the grid (90% of the area) */}
                    <img src="/logo-spinner.png" alt="" aria-hidden="true"
                        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ width: '90%', height: '90%', objectFit: 'contain', opacity: isDark ? 0.08 : 0.05, zIndex: 0 }} />
                    {/* Grid — 5×2 thumbnails sized to fit the window without scrolling */}
                    <div className="relative flex-1 min-h-0 flex flex-col" style={{ zIndex: 1 }}>
                        {loadingGrid && Object.keys(gridThumbnails).length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3">
                                <LogoSpinner className="w-12 h-12" />
                                <span className={`text-sm ${ui.sub}`}>Rendering thumbnails...</span>
                            </div>
                        ) : (
                            <div style={{
                                flex: 1,
                                minHeight: 0,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(5, 1fr)',
                                gridTemplateRows: 'repeat(2, 1fr)',
                                gap: '12px',
                            }}>
                                    {Array.from({ length: Math.min(GRID_PAGE_COUNT, totalPages - gridStartPage + 1) }, (_, i) => gridStartPage + i).map(p => {
                                        const isPageSelected = selectedPages.has(p);
                                        return (
                                            <div
                                                key={p}
                                                onClick={() => togglePage(p)}
                                                style={{
                                                    cursor: 'pointer',
                                                    borderRadius: '8px',
                                                    overflow: 'hidden',
                                                    border: isPageSelected ? '3px solid #3b82f6' : `2px solid ${ui.cellBorder}`,
                                                    background: ui.cellBg,
                                                    transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
                                                    position: 'relative',
                                                    minHeight: 0,
                                                }}
                                                className="group hover:border-blue-400 hover:shadow-md"
                                            >
                                                {/* Zoom / preview this page (doesn't toggle selection) */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); previewPage(p); }}
                                                    title="Preview page"
                                                    className={`absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center border shadow-sm opacity-0 group-hover:opacity-100 hover:text-blue-500 hover:border-blue-400 transition-opacity ${isDark ? 'bg-gray-800/90 border-white/15 text-gray-200' : 'bg-white/90 border-gray-300 text-gray-600'}`}
                                                >
                                                    <ZoomIn size={11} />
                                                </button>
                                                {gridThumbnails[p] ? (
                                                    <img
                                                        src={gridThumbnails[p]}
                                                        alt={`Page ${p}`}
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: isDark ? '#2b2f3a' : '#fff' }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <LogoSpinner className="w-8 h-8" />
                                                    </div>
                                                )}
                                                {/* Selection badge */}
                                                <div
                                                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all"
                                                    style={{
                                                        background: isPageSelected ? '#3b82f6' : 'rgba(255,255,255,0.9)',
                                                        border: isPageSelected ? 'none' : '1.5px solid #d1d5db',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                                    }}
                                                >
                                                    {isPageSelected && <Check size={10} color="white" strokeWidth={3} />}
                                                </div>
                                                {/* Page number label */}
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    left: 0,
                                                    right: 0,
                                                    textAlign: 'center',
                                                    fontSize: '11px',
                                                    color: isPageSelected ? (isDark ? '#60a5fa' : '#2563eb') : ui.labelColor,
                                                    fontWeight: isPageSelected ? '600' : '400',
                                                    padding: '3px 0',
                                                    background: ui.labelBg,
                                                }}>
                                                    {p}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Grid page group navigation */}
                            {totalPages > GRID_PAGE_COUNT && (
                                <div className="flex items-center justify-center gap-3 mt-4">
                                    <button
                                        onClick={() => setGridStartPage(Math.max(1, gridStartPage - GRID_PAGE_COUNT))}
                                        disabled={gridStartPage <= 1}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${ui.navBtn}`}
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <span className={`text-sm ${ui.body}`}>
                                        Pages {gridStartPage}–{Math.min(gridStartPage + GRID_PAGE_COUNT - 1, totalPages)} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setGridStartPage(Math.min(gridStartPage + GRID_PAGE_COUNT, totalPages))}
                                        disabled={gridStartPage + GRID_PAGE_COUNT > totalPages}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${ui.navBtn}`}
                                    >
                                        <ChevronRight size={18} />
                                    </button>

                                    {/* Jump to a specific page manually */}
                                    <div className="flex items-center gap-1.5 ml-3 text-sm">
                                        <span className={ui.sub}>Go to</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={totalPages}
                                            value={gridJumpValue}
                                            placeholder="#"
                                            onChange={(e) => setGridJumpValue(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') jumpGridToPage(gridJumpValue); e.stopPropagation(); }}
                                            className={`w-16 text-center text-sm border rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-300 ${ui.inputCls}`}
                                            style={{ MozAppearance: 'textfield', ...ui.inputStyle }}
                                        />
                                        <button
                                            onClick={() => jumpGridToPage(gridJumpValue)}
                                            className="px-2.5 py-1 text-xs font-medium text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors"
                                        >
                                            Go
                                        </button>
                                    </div>
                                </div>
                            )}
                    </div>

                    {/* Selection summary — always visible */}
                    <div className="flex items-center justify-between mt-4 px-1 relative" style={{ zIndex: 1 }}>
                        <span className={`text-sm ${ui.body}`}>
                            {selectedPages.size === 0
                                ? 'No pages selected'
                                : `${selectedPages.size} page${selectedPages.size !== 1 ? 's' : ''} selected`}
                            {selectedPages.size > 0 && selectedPages.size <= 8 && (
                                <span className={`ml-1 ${ui.sub}`}>
                                    ({[...selectedPages].sort((a, b) => a - b).join(', ')})
                                </span>
                            )}
                        </span>
                        <div className="flex gap-2">
                            <button onClick={selectAll} className="text-xs text-blue-600 hover:underline font-medium">Select All</button>
                            <button onClick={selectNone} className="text-xs text-blue-600 hover:underline font-medium">Clear</button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className={`px-5 py-3 border-t flex justify-end gap-2 ${ui.head} ${ui.footer}`}>
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 text-sm rounded-lg transition-colors ${ui.cancel}`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={extractPages}
                        disabled={selectedPages.size === 0 || loading}
                        className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors"
                    >
                        {loading && <LogoSpinner className="w-5 h-5" />}
                        Extract {selectedPages.size} page{selectedPages.size !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
        {zoomPage != null && (
            <PageZoomViewer
                node={node}
                pageNum={zoomPage}
                totalPages={totalPages}
                pdfBytesRef={pdfBytesRef}
                selectedPages={selectedPages}
                onToggleSelect={togglePage}
                onExtract={extractPages}
                onClose={() => setZoomPage(null)}
            />
        )}
        </>
    );
}
