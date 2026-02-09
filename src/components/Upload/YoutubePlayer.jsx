import { X } from 'lucide-react';

export default function YoutubePlayer({ videoId, onClose }) {
    if (!videoId) return null;

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center"
            onClick={onClose}
        >
            <div
                className="relative w-[90vw] max-w-[960px] aspect-video bg-black rounded-lg overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors z-10"
                >
                    <X className="w-8 h-8" />
                </button>
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
