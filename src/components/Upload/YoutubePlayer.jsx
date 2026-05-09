import { X, Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';

export default function YoutubePlayer({ videoId, onClose }) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    if (!videoId) return null;

    return (
        <div
            className={`fixed z-[200] flex items-center justify-center ${isFullscreen ? 'inset-0 bg-black/80 backdrop-blur-sm' : 'bottom-4 right-4'}`}
            onClick={isFullscreen ? onClose : undefined}
        >
            <div
                className={`relative bg-black rounded-lg overflow-hidden shadow-2xl ${isFullscreen ? 'w-[90vw] max-w-[960px] aspect-video' : 'w-[480px] aspect-video'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent px-3 py-1.5 flex items-center justify-end z-10">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="text-white/70 hover:text-white transition-colors p-1"
                            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={onClose}
                            className="text-white/70 hover:text-white transition-colors p-1"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <iframe
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                    title="YouTube video player"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
        </div>
    );
}
