import { useState, useEffect, useCallback } from 'react';
import { Copy, Download, ChevronLeft, ChevronRight, X, Check, Loader2 } from 'lucide-react';
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
    const [navigating, setNavigating] = useState(false);

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
                    width: isSelected ? `${Math.max(barWidth, 320)}px` : 'auto',
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
                            <span style={{ fontSize: '12px', minWidth: '60px', textAlign: 'center' }}>
                                {node.currentPage} of {node.totalPages}
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
                                title="Extract pages"
                            >
                                <Copy size={16} />
                            </OverlayButton>

                            {/* Download */}
                            <OverlayButton onClick={handleDownload} title="Download PDF">
                                <Download size={16} />
                            </OverlayButton>
                        </>
                    )}
                </div>
            </div>

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
    const [selectedPages, setSelectedPages] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [thumbnails, setThumbnails] = useState({});
    const [loadingThumbnails, setLoadingThumbnails] = useState(true);
    const totalPages = node.totalPages;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    // Load thumbnail previews on mount
    useEffect(() => {
        let cancelled = false;
        const loadThumbnails = async () => {
            try {
                const bytes = await getPdfBytes(node.id);
                if (!bytes || cancelled) { setLoadingThumbnails(false); return; }

                const thumbs = {};
                // Load thumbnails in batches of 5 for performance
                const pagesToLoad = pages.slice(0, Math.min(totalPages, 50)); // cap at 50 thumbnails
                for (let i = 0; i < pagesToLoad.length; i += 5) {
                    const batch = pagesToLoad.slice(i, i + 5);
                    const results = await Promise.all(
                        batch.map(async (p) => {
                            try {
                                const { dataUrl } = await renderPdfPage(bytes, p, 0.3);
                                return { page: p, dataUrl };
                            } catch {
                                return { page: p, dataUrl: null };
                            }
                        })
                    );
                    if (cancelled) return;
                    results.forEach(r => { thumbs[r.page] = r.dataUrl; });
                    setThumbnails({ ...thumbs });
                }
            } catch (e) {
                console.error('Thumbnail load error:', e);
            }
            if (!cancelled) setLoadingThumbnails(false);
        };
        loadThumbnails();
        return () => { cancelled = true; };
    }, [node.id, totalPages]);

    const togglePage = (p) => {
        const s = new Set(selectedPages);
        s.has(p) ? s.delete(p) : s.add(p);
        setSelectedPages(s);
    };
    const selectAll = () => setSelectedPages(new Set(pages));
    const selectNone = () => setSelectedPages(new Set());

    const extractPages = async () => {
        if (selectedPages.size === 0) return;
        setLoading(true);

        try {
            const bytes = await getPdfBytes(node.id);
            if (!bytes) { setLoading(false); return; }

            const sortedPages = [...selectedPages].sort((a, b) => a - b);
            let offsetX = 0;
            const baseX = (window.innerWidth / 2 - stagePosition.x) / stageScale - 200;
            const baseY = (window.innerHeight / 2 - stagePosition.y) / stageScale - 300;

            for (const pageNum of sortedPages) {
                const { dataUrl, width, height } = await renderPdfPage(bytes, pageNum, 2);
                const scaledWidth = width / 2;
                const scaledHeight = height / 2;

                addNode({
                    type: 'image',
                    x: baseX + offsetX,
                    y: baseY,
                    width: scaledWidth,
                    height: scaledHeight,
                    src: dataUrl,
                });

                offsetX += scaledWidth + 20;
            }
        } catch (e) {
            console.error('Extract pages error:', e);
        }

        setLoading(false);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="bg-white rounded-lg shadow-xl w-[600px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div>
                        <h2 className="font-semibold text-gray-800">Extract Pages</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{node.fileName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-4">
                    {/* Selection controls */}
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">
                            Select pages to extract ({selectedPages.size} selected)
                        </span>
                        <div className="flex gap-2">
                            <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">All</button>
                            <button onClick={selectNone} className="text-xs text-blue-600 hover:underline">None</button>
                        </div>
                    </div>

                    {/* Page grid with thumbnails */}
                    {loadingThumbnails && Object.keys(thumbnails).length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
                            <span className="text-sm text-gray-500">Loading page previews...</span>
                        </div>
                    ) : (
                        <div className="grid gap-3" style={{
                            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        }}>
                            {pages.map((p) => {
                                const isSelected = selectedPages.has(p);
                                const thumb = thumbnails[p];
                                return (
                                    <div
                                        key={p}
                                        onClick={() => togglePage(p)}
                                        className="cursor-pointer group"
                                        style={{
                                            border: isSelected ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            transition: 'border-color 0.15s, box-shadow 0.15s',
                                            boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.3)' : 'none',
                                            position: 'relative',
                                        }}
                                    >
                                        {/* Thumbnail */}
                                        <div style={{
                                            aspectRatio: '3/4',
                                            background: '#f9fafb',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                        }}>
                                            {thumb ? (
                                                <img
                                                    src={thumb}
                                                    alt={`Page ${p}`}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <span style={{ color: '#9ca3af', fontSize: '11px' }}>
                                                    {loadingThumbnails ? '...' : `Page ${p}`}
                                                </span>
                                            )}
                                        </div>

                                        {/* Page number */}
                                        <div style={{
                                            padding: '4px 0',
                                            textAlign: 'center',
                                            fontSize: '11px',
                                            fontWeight: isSelected ? '600' : '400',
                                            color: isSelected ? '#3b82f6' : '#6b7280',
                                            background: '#fff',
                                            borderTop: '1px solid #f3f4f6',
                                        }}>
                                            {p}
                                        </div>

                                        {/* Selection checkmark */}
                                        {isSelected && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '4px',
                                                right: '4px',
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                background: '#3b82f6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <Check size={12} color="white" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {totalPages > 50 && (
                        <p className="text-xs text-gray-400 mt-3 text-center">
                            Showing previews for first 50 pages. All {totalPages} pages can be selected.
                        </p>
                    )}
                </div>

                <div className="px-4 py-3 border-t flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={extractPages}
                        disabled={selectedPages.size === 0 || loading}
                        className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Extract {selectedPages.size} page{selectedPages.size !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}
