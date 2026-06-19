import { useRef, useState } from 'react';
import { X, FileText } from 'lucide-react';
import LogoSpinner from '../UI/LogoSpinner';
import { validateFileSize } from '../../utils/fileHelpers';
import { loadPdfJs, bytesToBase64 } from '../../utils/pdfHelpers';
import useStore from '../../store/useStore';
import { saveMediaToDB } from '../../store/useStore';
import { cn } from '../../lib/utils';

export default function PdfUploader({ onClose }) {
    const fileInputRef = useRef(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const { addNode, stagePosition, stageScale } = useStore();

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
            // Make a copy for PDF.js (it detaches the original)
            const pdfBytesCopy = new Uint8Array(arrayBuffer).slice();
            const pdf = await pdfjsLib.getDocument({ data: pdfBytesCopy }).promise;

            // Render page 1 as cover
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: context, viewport }).promise;
            const coverDataUrl = canvas.toDataURL('image/png');

            const scaledWidth = viewport.width / 2;
            const scaledHeight = viewport.height / 2;

            const baseX = (window.innerWidth / 2 - stagePosition.x) / stageScale - scaledWidth / 2;
            const baseY = (window.innerHeight / 2 - stagePosition.y) / stageScale - scaledHeight / 2;

            // Convert the ORIGINAL arrayBuffer to base64 BEFORE addNode (which may trigger sync save)
            const base64Pdf = bytesToBase64(new Uint8Array(arrayBuffer));

            // Generate a node ID and save PDF data first
            const { v4: uuidv4 } = await import('uuid');
            const nodeId = uuidv4();

            // Save PDF bytes to IndexedDB FIRST
            await saveMediaToDB(`${nodeId}_pdf`, base64Pdf);

            // Now add the node to the canvas
            addNode({
                id: nodeId,
                type: 'pdf',
                x: baseX,
                y: baseY,
                width: scaledWidth,
                height: scaledHeight,
                fileName: file.name,
                coverSrc: coverDataUrl,
                totalPages: pdf.numPages,
                currentPage: 1,
            });

            setLoading(false);
            onClose?.();
        } catch (err) {
            setError('Failed to load PDF: ' + err.message);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-[400px] max-w-[95vw] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-red-500" />
                        <h2 className="font-semibold text-gray-800">Upload PDF</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all",
                            "hover:border-blue-400 hover:bg-blue-50"
                        )}
                    >
                        {loading ? (
                            <LogoSpinner className="w-12 h-12 mx-auto mb-3" />
                        ) : (
                            <FileText className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                        )}
                        <p className="font-medium text-gray-700">
                            {loading ? 'Processing PDF...' : 'Click to select a PDF file'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">Up to 250MB</p>
                    </div>

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                            {error}
                        </div>
                    )}
                </div>

                <input ref={fileInputRef} type="file" accept=".pdf" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
            </div>
        </div>
    );
}
