import { X } from 'lucide-react';
import { useRef } from 'react';

export default function VideoPlayer({ src, fileName, onClose }) {
    const videoRef = useRef(null);

    if (!src) return null;

    return (
        <div
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex items-center justify-center"
            onClick={onClose}
        >
            <div
                className="relative w-[90vw] max-w-[960px] bg-black rounded-lg overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors z-10"
                >
                    <X className="w-8 h-8" />
                </button>

                {/* File name header */}
                <div className="bg-gray-900 px-4 py-2 text-white text-sm truncate">
                    🎬 {fileName || 'Video file'}
                </div>

                {/* Video element */}
                <video
                    ref={videoRef}
                    src={src}
                    autoPlay
                    controls
                    className="w-full max-h-[80vh]"
                    style={{ aspectRatio: '16/9' }}
                />
            </div>
        </div>
    );
}
