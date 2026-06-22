import { useState, useRef, useCallback } from 'react';
import { X, Youtube, Upload, Image, FileText, Music, Video, AlertCircle } from 'lucide-react';
import { parseYoutubeUrl, getYoutubeEmbedUrl, handleFileUpload } from '../../utils/fileHelpers';
import { loadPdfJs, bytesToBase64 } from '../../utils/pdfHelpers';
import { v4 as uuidv4 } from 'uuid';
import useStore, { saveMediaToDB } from '../../store/useStore';

const ACCEPTED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/heic', 'image/heif'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/flac', 'audio/aac'],
    video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska'],
    document: ['application/pdf'],
};

function getFileCategory(file) {
    const type = file.type.toLowerCase();
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'heic' || ext === 'heif') return 'image';
    if (ACCEPTED_TYPES.image.some(t => type.startsWith(t.split('/')[0]) && type.includes(t.split('/')[1])) || type.startsWith('image/')) return 'image';
    if (type.startsWith('audio/')) return 'audio';
    if (type.startsWith('video/')) return 'video';
    if (type === 'application/pdf' || ext === 'pdf') return 'document';
    return 'image'; // Default to image
}

export default function UnifiedMediaModal({ onClose }) {
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [ytPreview, setYtPreview] = useState(null);
    const [error, setError] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const { addNode, stagePosition, stageScale, theme } = useStore();
    const isDark = theme === 'dark';

    const getCenterPos = useCallback(() => ({
        x: (window.innerWidth / 2 - stagePosition.x) / stageScale,
        y: (window.innerHeight / 2 - stagePosition.y) / stageScale,
    }), [stagePosition, stageScale]);

    const handleYoutubeChange = (e) => {
        const url = e.target.value;
        setYoutubeUrl(url);
        setError(null);
        const videoId = parseYoutubeUrl(url);
        if (videoId) {
            setYtPreview({ videoId, thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` });
        } else {
            setYtPreview(null);
        }
    };

    const handleEmbedYoutube = () => {
        const videoId = parseYoutubeUrl(youtubeUrl);
        if (!videoId) { setError('Please enter a valid YouTube URL'); return; }
        const pos = getCenterPos();
        addNode({ type: 'youtube', x: pos.x - 240, y: pos.y - 135, width: 480, height: 270, videoId, embedUrl: getYoutubeEmbedUrl(videoId) });
        onClose?.();
    };

    const processFile = useCallback(async (file) => {
        try {
            setUploading(true);
            setError(null);
            const category = getFileCategory(file);
            let src = file;

            // HEIC files: browsers with HEIC support will display directly
            // For full HEIC conversion, install heic2any: npm install heic2any

            // PDFs are read as raw bytes below (not as a data URL) — reading a big
            // PDF as a data URL just to throw it away wastes time/memory.
            const dataUrl = category === 'document' ? null : await handleFileUpload(src);
            const pos = getCenterPos();

            switch (category) {
                case 'image': {
                    const img = new window.Image();
                    img.onload = () => {
                        const maxDim = 500;
                        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
                        addNode({ type: 'image', x: pos.x - (img.width * scale) / 2, y: pos.y - (img.height * scale) / 2, width: img.width * scale, height: img.height * scale, src: dataUrl, fileName: file.name });
                    };
                    img.src = dataUrl;
                    break;
                }
                case 'audio':
                    addNode({ type: 'audio', x: pos.x - 150, y: pos.y - 40, width: 300, height: 80, src: dataUrl, fileName: file.name });
                    break;
                case 'video':
                    addNode({ type: 'video', x: pos.x - 240, y: pos.y - 135, width: 480, height: 270, src: dataUrl, fileName: file.name });
                    break;
                case 'document': {
                    // Mirror PdfUploader: render a cover, save the raw bytes to
                    // IndexedDB under `${id}_pdf`, and set page metadata — so the
                    // node renders, navigates, and extracts. (The old code dumped
                    // the whole PDF into `src`, which no render path reads.)
                    const pdfjsLib = await loadPdfJs();
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer).slice() }).promise;
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    const coverSrc = canvas.toDataURL('image/png');
                    const w = viewport.width / 2, h = viewport.height / 2;
                    const nodeId = uuidv4();
                    await saveMediaToDB(`${nodeId}_pdf`, bytesToBase64(new Uint8Array(arrayBuffer)));
                    addNode({
                        id: nodeId, type: 'pdf',
                        x: pos.x - w / 2, y: pos.y - h / 2, width: w, height: h,
                        fileName: file.name, coverSrc, totalPages: pdf.numPages, currentPage: 1,
                    });
                    break;
                }
            }
            onClose?.();
        } catch (e) {
            setError(e.message || 'Failed to upload file');
        } finally {
            setUploading(false);
        }
    }, [addNode, getCenterPos, onClose]);

    const handleFiles = useCallback((files) => {
        if (files.length > 0) processFile(files[0]);
    }, [processFile]);

    const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
    const handleDrop = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); handleFiles(e.dataTransfer.files); }, [handleFiles]);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center" onClick={onClose}>
            <div
                className={`relative rounded-xl shadow-2xl border border-transparent p-5 w-[440px] max-w-[90vw] menu-accent-edge ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Upload className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                        <h2 className={`text-base font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>Add Media</h2>
                    </div>
                    <button onClick={onClose} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* YouTube URL Input */}
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                        <Youtube className="w-4 h-4 text-red-500" />
                        <label className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Add YouTube Link</label>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={youtubeUrl}
                            onChange={handleYoutubeChange}
                            placeholder="https://youtube.com/watch?v=..."
                            className={`flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'}`}
                        />
                        <button
                            onClick={handleEmbedYoutube}
                            disabled={!ytPreview}
                            className="px-3 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Embed
                        </button>
                    </div>
                    {ytPreview && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                            <img src={ytPreview.thumbnail} alt="Preview" className="w-full h-24 object-cover" />
                        </div>
                    )}
                </div>

                <div className={`h-px my-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                {/* Drag & Drop Zone */}
                <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging
                        ? 'border-purple-500 bg-purple-50/30 scale-[1.01]'
                        : isDark ? 'border-gray-600 hover:border-purple-500/50 hover:bg-gray-700/50' : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/30'
                        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                    <div className="flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-purple-50'}`}>
                            <Upload className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                        </div>
                        <div>
                            <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                {uploading ? 'Uploading...' : 'Drag and drop files here'}
                            </p>
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>or click to browse</p>
                        </div>
                    </div>
                </div>

                {/* Supported formats */}
                <div className={`flex flex-wrap gap-2 mt-3 justify-center`}>
                    {[
                        { icon: Image, label: 'Images', color: 'text-blue-500' },
                        { icon: Video, label: 'Video', color: 'text-green-500' },
                        { icon: Music, label: 'Audio', color: 'text-orange-500' },
                        { icon: FileText, label: 'PDF', color: 'text-red-500' },
                    ].map(f => (
                        <div key={f.label} className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            <f.icon className={`w-3 h-3 ${f.color}`} />
                            {f.label}
                        </div>
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-600">{error}</p>
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,audio/*,video/*,.pdf,.heic,.heif"
                    onChange={(e) => handleFiles(e.target.files)}
                />
            </div>
        </div>
    );
}
