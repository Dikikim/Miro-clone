import { useRef, useState, useEffect } from 'react';
import { X, FileText, ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { validateFileSize } from '../../utils/fileHelpers';
import useStore from '../../store/useStore';
import { cn } from '../../lib/utils';

// Load PDF.js from CDN
const loadPdfJs = () => {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) {
            resolve(window.pdfjsLib);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(window.pdfjsLib);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

export default function PdfUploader({ onClose }) {
    const fileInputRef = useRef(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [pdfDoc, setPdfDoc] = useState(null);
    const [pages, setPages] = useState([]);
    const [selectedPages, setSelectedPages] = useState(new Set());
    const [previewPage, setPreviewPage] = useState(1);
    const [previewImage, setPreviewImage] = useState(null);

    const { addNode, stagePosition, stageScale } = useStore();

    // Render a page to canvas and return data URL
    const renderPage = async (pdf, pageNum, scale = 1.5) => {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;
        return { dataUrl: canvas.toDataURL('image/png'), width: viewport.width, height: viewport.height };
    };

    // Load preview when page changes
    useEffect(() => {
        if (!pdfDoc || previewPage < 1 || previewPage > pages.length) return;

        const loadPreview = async () => {
            const { dataUrl } = await renderPage(pdfDoc, previewPage, 1);
            setPreviewImage(dataUrl);
        };
        loadPreview();
    }, [pdfDoc, previewPage, pages.length]);

    const handleFile = async (file) => {
        setError(null);
        setLoading(true);

        if (file.type !== 'application/pdf') {
            setError('Please select a PDF file');
            setLoading(false);
            return;
        }

        const validation = validateFileSize(file);
        if (!validation.valid) {
            setError(validation.message);
            setLoading(false);
            return;
        }

        try {
            const pdfjsLib = await loadPdfJs();
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            setPdfDoc(pdf);
            setPages(Array.from({ length: pdf.numPages }, (_, i) => i + 1));
            setSelectedPages(new Set([1])); // Select first page by default
            setPreviewPage(1);
        } catch (err) {
            setError('Failed to load PDF: ' + err.message);
        }
        setLoading(false);
    };

    const togglePage = (pageNum) => {
        const newSelected = new Set(selectedPages);
        if (newSelected.has(pageNum)) {
            newSelected.delete(pageNum);
        } else {
            newSelected.add(pageNum);
        }
        setSelectedPages(newSelected);
    };

    const selectAll = () => setSelectedPages(new Set(pages));
    const selectNone = () => setSelectedPages(new Set());

    const addSelectedPages = async () => {
        if (selectedPages.size === 0 || !pdfDoc) return;
        setLoading(true);

        const sortedPages = [...selectedPages].sort((a, b) => a - b);
        let offsetX = 0;
        const baseX = (window.innerWidth / 2 - stagePosition.x) / stageScale - 200;
        const baseY = (window.innerHeight / 2 - stagePosition.y) / stageScale - 300;

        for (const pageNum of sortedPages) {
            const { dataUrl, width, height } = await renderPage(pdfDoc, pageNum, 2);
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

        setLoading(false);
        onClose?.();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-[500px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-red-500" />
                        <h2 className="font-semibold text-gray-800">Add PDF Pages</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {!pdfDoc ? (
                        // File selection
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all",
                                "hover:border-blue-400 hover:bg-blue-50"
                            )}
                        >
                            {loading ? (
                                <Loader2 className="w-10 h-10 mx-auto mb-3 text-blue-500 animate-spin" />
                            ) : (
                                <FileText className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                            )}
                            <p className="font-medium text-gray-700">
                                {loading ? 'Loading PDF...' : 'Click to select a PDF file'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">Up to 250MB</p>
                        </div>
                    ) : (
                        // Page selection
                        <div>
                            {/* Preview */}
                            <div className="bg-gray-100 rounded-lg p-4 mb-4 flex items-center justify-center min-h-[200px]">
                                {previewImage ? (
                                    <img src={previewImage} alt={`Page ${previewPage}`} className="max-h-[200px] shadow-md" />
                                ) : (
                                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                                )}
                            </div>

                            {/* Page navigation */}
                            <div className="flex items-center justify-center gap-4 mb-4">
                                <button
                                    onClick={() => setPreviewPage(Math.max(1, previewPage - 1))}
                                    disabled={previewPage <= 1}
                                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="text-sm text-gray-600">
                                    Page {previewPage} of {pages.length}
                                </span>
                                <button
                                    onClick={() => setPreviewPage(Math.min(pages.length, previewPage + 1))}
                                    disabled={previewPage >= pages.length}
                                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Page selector */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">Select pages to add:</span>
                                    <div className="flex gap-2">
                                        <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">All</button>
                                        <button onClick={selectNone} className="text-xs text-blue-600 hover:underline">None</button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1 max-h-[100px] overflow-auto">
                                    {pages.map((pageNum) => (
                                        <button
                                            key={pageNum}
                                            onClick={() => { togglePage(pageNum); setPreviewPage(pageNum); }}
                                            className={cn(
                                                "w-8 h-8 text-xs rounded border transition-all flex items-center justify-center",
                                                selectedPages.has(pageNum)
                                                    ? "bg-blue-500 text-white border-blue-600"
                                                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                                            )}
                                        >
                                            {selectedPages.has(pageNum) ? <Check className="w-3 h-3" /> : pageNum}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                            {error}
                        </div>
                    )}
                </div>

                <input ref={fileInputRef} type="file" accept=".pdf" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />

                {/* Footer */}
                {pdfDoc && (
                    <div className="px-4 py-3 border-t flex justify-between items-center">
                        <button
                            onClick={() => { setPdfDoc(null); setPages([]); setSelectedPages(new Set()); }}
                            className="text-sm text-gray-600 hover:text-gray-800"
                        >
                            ← Choose different file
                        </button>
                        <button
                            onClick={addSelectedPages}
                            disabled={selectedPages.size === 0 || loading}
                            className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Add {selectedPages.size} page{selectedPages.size !== 1 ? 's' : ''}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
