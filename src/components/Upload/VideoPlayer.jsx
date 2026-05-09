import { X, Maximize2, Minimize2 } from 'lucide-react';
import { useRef, useState } from 'react';

export default function VideoPlayer({ src, fileName, onClose }) {
    const videoRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    if (!src) return null;

    return (
        <div
            className={`fixed z-[200] flex items-center justify-center ${isFullscreen ? 'inset-0 bg-black/90 backdrop-blur-sm' : 'bottom-4 right-4'}`}
            onClick={isFullscreen ? onClose : undefined}
        >
            <div
                className={`relative bg-black rounded-lg overflow-hidden shadow-2xl ${isFullscreen ? 'w-[90vw] max-w-[960px]' : 'w-[480px]'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gray-900 px-3 py-1.5 flex items-center justify-between">
                    <span className="text-white text-xs truncate flex-1">🎬 {fileName || 'Video file'}</span>
                    <div className="flex items-center gap-1 ml-2">
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="text-gray-400 hover:text-white transition-colors p-1"
                            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors p-1"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Video element */}
                <video
                    ref={videoRef}
                    src={src}
                    autoPlay
                    controls
                    className="w-full"
                    style={{ maxHeight: isFullscreen ? '80vh' : '320px', aspectRatio: '16/9' }}
                />
            </div>
        </div>
    );
}
