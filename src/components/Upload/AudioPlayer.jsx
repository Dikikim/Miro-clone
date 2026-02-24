import { X, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

export default function AudioPlayer({ src, fileName, onClose }) {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

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

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleSeek = (e) => {
        const bar = e.currentTarget;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (audioRef.current && duration) {
            audioRef.current.currentTime = ratio * duration;
        }
    };

    const toggleMute = () => {
        if (audioRef.current) {
            audioRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (audioRef.current) {
            audioRef.current.volume = val;
            if (val > 0 && isMuted) {
                audioRef.current.muted = false;
                setIsMuted(false);
            } else if (val === 0 && !isMuted) {
                audioRef.current.muted = true;
                setIsMuted(true);
            }
        }
    };

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-white rounded-xl shadow-2xl border border-gray-200 px-4 py-2.5"
            style={{ minWidth: 340, maxWidth: '90vw' }}
        >
            {/* Play/Pause */}
            <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 hover:bg-purple-700 transition-colors"
            >
                {isPlaying ? (
                    <Pause className="w-4 h-4 text-white" />
                ) : (
                    <Play className="w-4 h-4 text-white ml-0.5" />
                )}
            </button>

            {/* Info + progress */}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                    {fileName || 'Audio file'}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 w-9 text-right flex-shrink-0">{formatTime(currentTime)}</span>
                    {/* Progress bar */}
                    <div
                        className="flex-1 h-1.5 bg-gray-200 rounded-full cursor-pointer relative"
                        onClick={handleSeek}
                    >
                        <div
                            className="h-full bg-purple-500 rounded-full transition-all"
                            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                        />
                    </div>
                    <span className="text-xs text-gray-500 w-9 flex-shrink-0">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Volume control */}
            <div className="flex items-center gap-1 group">
                <button
                    onClick={toggleMute}
                    className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center flex-shrink-0 transition-colors"
                    title={isMuted || volume === 0 ? "Unmute" : "Mute"}
                >
                    {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4 text-gray-500" />
                    ) : (
                        <Volume2 className="w-4 h-4 text-gray-500" />
                    )}
                </button>
                <div className="w-0 overflow-hidden group-hover:w-[60px] transition-all duration-300 flex items-center origin-left">
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-[50px] h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                </div>
            </div>

            {/* Close */}
            <button
                onClick={onClose}
                className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center flex-shrink-0 transition-colors"
            >
                <X className="w-4 h-4 text-gray-500" />
            </button>

            {/* Hidden audio element */}
            <audio
                ref={audioRef}
                src={src}
                autoPlay
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={() => {
                    if (audioRef.current) setDuration(audioRef.current.duration || 0);
                }}
                onTimeUpdate={() => {
                    if (audioRef.current) setCurrentTime(audioRef.current.currentTime || 0);
                }}
            />
        </div>
    );
}
