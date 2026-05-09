import { useState, useEffect, useCallback, useRef } from 'react';
import { Copy, Download, ChevronLeft, ChevronRight, X, Check, Loader2, Maximize2, Grid2x2, FileDown } from 'lucide-react';
import useStore from '../../store/useStore';
import { loadMediaFromDB } from '../../store/useStore';
import { renderPdfPage, base64ToBytes } from '../Upload/PdfUploader';

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
function SinglePageModal({ node, onClose, onNavigate, navigating, onDownloadPage }) {
    const [pageImage, setPageImage] = useState(null);
    const [loadingPage, setLoadingPage] = useState(true);
    const [currentPage, setCurrentPage] = useState(node.currentPage || 1);
    const totalPages = node.totalPages || 1;
    const pdfBytesRef = useRef(null);

    // Load PDF bytes once
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const bytes = await getPdfBytes(node.id);
                if (!cancelled && bytes) {
                    pdfBytesRef.current = bytes;
                    const { dataUrl } = await renderPdfPage(bytes, currentPage, 2);
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
                        <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
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
                        <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
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
                                        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
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
 * Modal for selecting and extracting individual pages
 * from a PDF document node onto the canvas.
 * Includes page thumbnail previews.
 */
function ExtractPagesModal({ node, onClose, addNode, stagePosition, stageScale }) {
    const { nodes } = useStore();
    const [selectedPages, setSelectedPages] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [currentPreviewPage, setCurrentPreviewPage] = useState(1);
    const [previewImage, setPreviewImage] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(true);
    const [pageInputValue, setPageInputValue] = useState('1');
    const [editingPageInput, setEditingPageInput] = useState(false);
    const [viewMode, setViewMode] = useState('single'); // 'single' or 'grid'
    const [gridThumbnails, setGridThumbnails] = useState({});
    const [gridStartPage, setGridStartPage] = useState(1);
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
                    // Render first page
                    const { dataUrl } = await renderPdfPage(bytes, 1, 1.5);
                    if (!cancelled) {
                        setPreviewImage(dataUrl);
                        setLoadingPreview(false);
                    }
                } else {
                    setLoadingPreview(false);
                }
            } catch (e) {
                console.error('PDF load error:', e);
                if (!cancelled) setLoadingPreview(false);
            }
        };
        loadBytes();
        return () => { cancelled = true; };
    }, [node.id]);

    // Navigate to a specific page preview
    const goToPreviewPage = useCallback(async (pageNum) => {
        const target = Math.max(1, Math.min(parseInt(pageNum, 10), totalPages));
        if (isNaN(target) || !pdfBytesRef.current) return;
        setLoadingPreview(true);
        setCurrentPreviewPage(target);
        setPageInputValue(String(target));
        try {
            const { dataUrl } = await renderPdfPage(pdfBytesRef.current, target, 1.5);
            setPreviewImage(dataUrl);
        } catch (e) {
            console.error('Preview error:', e);
        }
        setLoadingPreview(false);
    }, [totalPages]);

    const toggleCurrentPage = () => {
        const s = new Set(selectedPages);
        s.has(currentPreviewPage) ? s.delete(currentPreviewPage) : s.add(currentPreviewPage);
        setSelectedPages(s);
    };

    const togglePage = (p) => {
        const s = new Set(selectedPages);
        s.has(p) ? s.delete(p) : s.add(p);
        setSelectedPages(s);
    };

    // Load grid thumbnails when in grid mode
    const gridEndPage = Math.min(gridStartPage + GRID_PAGE_COUNT - 1, totalPages);
    useEffect(() => {
        if (viewMode !== 'grid' || !pdfBytesRef.current) return;
        let cancelled = false;
        const load = async () => {
            setLoadingGrid(true);
            const thumbs = {};
            for (let p = gridStartPage; p <= gridEndPage; p++) {
                if (cancelled) break;
                try {
                    const { dataUrl } = await renderPdfPage(pdfBytesRef.current, p, 0.6);
                    thumbs[p] = dataUrl;
                } catch (e) { console.error(e); }
            }
            if (!cancelled) { setGridThumbnails(prev => ({ ...prev, ...thumbs })); setLoadingGrid(false); }
        };
        load();
        return () => { cancelled = true; };
    }, [viewMode, gridStartPage, gridEndPage]);

    const selectAll = () => {
        const all = new Set();
        for (let i = 1; i <= totalPages; i++) all.add(i);
        setSelectedPages(all);
    };
    const selectNone = () => setSelectedPages(new Set());

    const extractPages = async () => {
        if (selectedPages.size === 0) return;
        setLoading(true);

        const PAGE_W = 400;
        const PAGE_H = 566;
        const GAP_X = 20;
        const GAP_Y = 30;
        const COLS = 10;

        const alreadyPlaced = nodes.filter(n => n.extractedFromPdfId === node.id).length;
        const nodeBottom = node.y + (node.height || 400);
        const baseX = node.x;
        const baseY = nodeBottom + 40;

        try {
            const bytes = pdfBytesRef.current || await getPdfBytes(node.id);
            if (!bytes) { setLoading(false); return; }

            const sortedPages = [...selectedPages].sort((a, b) => a - b);

            for (let i = 0; i < sortedPages.length; i++) {
                const pageNum = sortedPages[i];
                const gridIndex = alreadyPlaced + i;
                const col = gridIndex % COLS;
                const row = Math.floor(gridIndex / COLS);

                const { dataUrl } = await renderPdfPage(bytes, pageNum, 2);

                addNode({
                    type: 'image',
                    x: baseX + col * (PAGE_W + GAP_X),
                    y: baseY + row * (PAGE_H + GAP_Y),
                    width: PAGE_W,
                    height: PAGE_H,
                    src: dataUrl,
                    extractedFromPdfId: node.id,
                });
            }
        } catch (e) {
            console.error('Extract pages error:', e);
        }

        setLoading(false);
        onClose();
    };

    const isCurrentSelected = selectedPages.has(currentPreviewPage);

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="bg-white rounded-xl shadow-xl max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col" style={{ width: viewMode === 'grid' ? '720px' : '520px', transition: 'width 0.3s' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                    <div>
                        <h2 className="font-semibold text-gray-800 text-base">Extract Pages</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{node.fileName} · {totalPages} page{totalPages !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View mode toggle */}
                        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                            <button
                                onClick={() => setViewMode('single')}
                                className={`px-2.5 py-1 text-xs font-medium flex items-center gap-1 transition-colors ${viewMode === 'single' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                title="Single page view"
                            >
                                <Maximize2 size={13} /> Single
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`px-2.5 py-1 text-xs font-medium flex items-center gap-1 transition-colors ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                title="Grid view (10 pages)"
                            >
                                <Grid2x2 size={13} /> Grid
                            </button>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content area — switches between single and grid view */}
                <div className="flex-1 overflow-auto px-5 py-4">
                    {viewMode === 'single' ? (
                        <>
                            {/* Page preview */}
                            <div
                                className="relative mx-auto rounded-lg overflow-hidden border-2 transition-colors"
                                style={{
                                    maxWidth: '340px',
                                    aspectRatio: '3/4',
                                    borderColor: isCurrentSelected ? '#3b82f6' : '#e5e7eb',
                                    boxShadow: isCurrentSelected ? '0 0 0 3px rgba(59,130,246,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
                                    cursor: 'pointer',
                                }}
                                onClick={toggleCurrentPage}
                            >
                                {loadingPreview ? (
                                    <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                    </div>
                                ) : previewImage ? (
                                    <img
                                        src={previewImage}
                                        alt={`Page ${currentPreviewPage}`}
                                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f9fafb' }}
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-400">
                                        Page {currentPreviewPage}
                                    </div>
                                )}

                                {/* Selection badge */}
                                <div
                                    className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                                    style={{
                                        background: isCurrentSelected ? '#3b82f6' : 'rgba(255,255,255,0.9)',
                                        border: isCurrentSelected ? 'none' : '2px solid #d1d5db',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                                    }}
                                >
                                    {isCurrentSelected && <Check size={14} color="white" strokeWidth={3} />}
                                </div>

                                {/* Click hint */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent px-3 py-2">
                                    <span className="text-white text-xs font-medium">
                                        {isCurrentSelected ? '✓ Selected — click to deselect' : 'Click to select this page'}
                                    </span>
                                </div>
                            </div>

                            {/* Page navigation */}
                            <div className="flex items-center justify-center gap-3 mt-4">
                                <button
                                    onClick={() => goToPreviewPage(currentPreviewPage - 1)}
                                    disabled={currentPreviewPage <= 1 || loadingPreview}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft size={18} />
                                </button>

                                <div className="flex items-center gap-1.5 text-sm">
                                    <span className="text-gray-500">Page</span>
                                    {editingPageInput ? (
                                        <input
                                            autoFocus
                                            type="number"
                                            min={1}
                                            max={totalPages}
                                            value={pageInputValue}
                                            onChange={(e) => setPageInputValue(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    goToPreviewPage(pageInputValue);
                                                    setEditingPageInput(false);
                                                }
                                                if (e.key === 'Escape') setEditingPageInput(false);
                                                e.stopPropagation();
                                            }}
                                            onBlur={() => {
                                                goToPreviewPage(pageInputValue);
                                                setEditingPageInput(false);
                                            }}
                                            className="w-12 text-center text-sm font-medium border border-blue-400 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                            style={{ MozAppearance: 'textfield', color: '#1a1a1a', backgroundColor: '#ffffff' }}
                                        />
                                    ) : (
                                        <button
                                            onClick={() => { setPageInputValue(String(currentPreviewPage)); setEditingPageInput(true); }}
                                            className="px-2 py-0.5 text-sm font-semibold text-gray-800 border border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-text min-w-[36px]"
                                            title="Click to type page number"
                                        >
                                            {currentPreviewPage}
                                        </button>
                                    )}
                                    <span className="text-gray-500">of {totalPages}</span>
                                </div>

                                <button
                                    onClick={() => goToPreviewPage(currentPreviewPage + 1)}
                                    disabled={currentPreviewPage >= totalPages || loadingPreview}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </>
                    ) : (
                        /* Grid view — 5-column thumbnail grid */
                        <>
                            {loadingGrid && Object.keys(gridThumbnails).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                    <span className="text-sm text-gray-400">Rendering thumbnails...</span>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(5, 1fr)',
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
                                                    border: isPageSelected ? '3px solid #3b82f6' : '2px solid #e5e7eb',
                                                    background: '#f9fafb',
                                                    transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
                                                    position: 'relative',
                                                    aspectRatio: '3/4',
                                                }}
                                                className="hover:border-blue-400 hover:scale-[1.03] hover:shadow-md"
                                            >
                                                {gridThumbnails[p] ? (
                                                    <img
                                                        src={gridThumbnails[p]}
                                                        alt={`Page ${p}`}
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
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
                                                    color: isPageSelected ? '#2563eb' : '#6b7280',
                                                    fontWeight: isPageSelected ? '600' : '400',
                                                    padding: '3px 0',
                                                    background: 'rgba(255,255,255,0.85)',
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
                                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <span className="text-sm text-gray-600">
                                        Pages {gridStartPage}–{Math.min(gridStartPage + GRID_PAGE_COUNT - 1, totalPages)} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setGridStartPage(Math.min(gridStartPage + GRID_PAGE_COUNT, totalPages))}
                                        disabled={gridStartPage + GRID_PAGE_COUNT > totalPages}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Selection summary — always visible */}
                    <div className="flex items-center justify-between mt-4 px-1">
                        <span className="text-sm text-gray-600">
                            {selectedPages.size === 0
                                ? 'No pages selected'
                                : `${selectedPages.size} page${selectedPages.size !== 1 ? 's' : ''} selected`}
                            {selectedPages.size > 0 && selectedPages.size <= 8 && (
                                <span className="text-gray-400 ml-1">
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
                <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={extractPages}
                        disabled={selectedPages.size === 0 || loading}
                        className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Extract {selectedPages.size} page{selectedPages.size !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}
