import { useState } from 'react';
import { X, Youtube, AlertCircle, ExternalLink } from 'lucide-react';
import { parseYoutubeUrl, getYoutubeEmbedUrl } from '../../utils/fileHelpers';
import useStore from '../../store/useStore';

export default function YoutubeEmbed({ onClose }) {
    const [url, setUrl] = useState('');
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState(null);
    const { addNode, stagePosition, stageScale } = useStore();

    const handleUrlChange = (e) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        setError(null);

        const videoId = parseYoutubeUrl(newUrl);
        if (videoId) {
            setPreview({
                videoId,
                thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                embedUrl: getYoutubeEmbedUrl(videoId),
            });
        } else if (newUrl.length > 0) {
            setPreview(null);
        }
    };

    const handleEmbed = () => {
        if (!preview) {
            setError('Please enter a valid YouTube URL');
            return;
        }

        // Calculate position (center of viewport)
        const x = (window.innerWidth / 2 - stagePosition.x) / stageScale;
        const y = (window.innerHeight / 2 - stagePosition.y) / stageScale;

        const width = 480;
        const height = 270;

        addNode({
            type: 'youtube',
            x: x - width / 2,
            y: y - height / 2,
            width,
            height,
            videoId: preview.videoId,
            embedUrl: preview.embedUrl,
        });

        onClose?.();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card border border-border rounded-xl shadow-2xl p-6 w-[450px] max-w-[90vw]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Youtube className="w-5 h-5 text-red-500" />
                        <h2 className="text-lg font-semibold text-foreground">Embed YouTube Video</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* URL Input */}
                <div className="mb-4">
                    <label className="block text-sm text-muted-foreground mb-2">
                        YouTube URL
                    </label>
                    <input
                        type="text"
                        value={url}
                        onChange={handleUrlChange}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                {/* Preview */}
                {preview && (
                    <div className="mb-4">
                        <label className="block text-sm text-muted-foreground mb-2">
                            Preview
                        </label>
                        <div className="relative rounded-lg overflow-hidden border border-border">
                            <img
                                src={preview.thumbnail}
                                alt="Video thumbnail"
                                className="w-full aspect-video object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                                    <div className="w-0 h-0 border-l-[24px] border-l-white border-y-[14px] border-y-transparent ml-1" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-destructive">{error}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleEmbed}
                        disabled={!preview}
                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Embed Video
                    </button>
                </div>

                {/* Supported formats hint */}
                <p className="text-xs text-muted-foreground mt-4 text-center">
                    Supports youtube.com, youtu.be, and youtube.com/shorts links
                </p>
            </div>
        </div>
    );
}
