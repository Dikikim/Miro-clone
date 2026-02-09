import { X, Pause, Play } from 'lucide-react';
import { useRef, useState } from 'react';

export default function AudioPlayer({ src, fileName, onClose }) {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(true);

    if (!src) return null;

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center"
            onClick={onClose}
        >
            <div
                className="relative bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-8 shadow-2xl max-w-md w-[90vw]"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors z-10"
                >
                    <X className="w-8 h-8" />
                </button>

                {/* Album art placeholder */}
                <div className="w-32 h-32 mx-auto mb-6 bg-white/20 rounded-xl flex items-center justify-center">
                    <span className="text-6xl">🎵</span>
                </div>

                {/* File name */}
                <h3 className="text-white text-center font-semibold text-lg mb-4 truncate px-4">
                    {fileName || 'Audio file'}
                </h3>

                {/* Audio element */}
                <audio
                    ref={audioRef}
                    src={src}
                    autoPlay
                    controls
                    className="w-full rounded-lg"
                    onEnded={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                />

                {/* Play/Pause button */}
                <div className="flex justify-center mt-6">
                    <button
                        onClick={togglePlay}
                        className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                    >
                        {isPlaying ? (
                            <Pause className="w-8 h-8 text-purple-600" />
                        ) : (
                            <Play className="w-8 h-8 text-purple-600 ml-1" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
