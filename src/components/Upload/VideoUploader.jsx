import { useRef, useState } from 'react';
import { Upload, X, AlertCircle, Video } from 'lucide-react';
import { validateFileSize, handleFileUpload } from '../../utils/fileHelpers';
import useStore from '../../store/useStore';
import { cn } from '../../lib/utils';

export default function VideoUploader({ onClose }) {
    const fileInputRef = useRef(null);
    const [error, setError] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const { addNode, stagePosition, stageScale } = useStore();

    const processFile = async (file) => {
        setError(null);

        // Check if it's a video file
        if (!file.type.startsWith('video/')) {
            setError('Please upload a video file (MP4, WebM, MOV, etc.)');
            return;
        }

        // Validate file size (250MB limit)
        const validation = validateFileSize(file);
        if (!validation.valid) {
            setError(validation.message);
            return;
        }

        try {
            const url = await handleFileUpload(file);

            // Calculate position (center of viewport)
            const x = (window.innerWidth / 2 - stagePosition.x) / stageScale;
            const y = (window.innerHeight / 2 - stagePosition.y) / stageScale;

            // Create video element to get dimensions
            const video = document.createElement('video');
            video.onloadedmetadata = () => {
                let width = video.videoWidth;
                let height = video.videoHeight;
                const maxSize = 400;

                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width *= ratio;
                    height *= ratio;
                }

                addNode({
                    type: 'video',
                    x: x - width / 2,
                    y: y - height / 2,
                    width,
                    height,
                    src: url,
                    fileName: file.name,
                    duration: video.duration,
                });

                onClose?.();
            };
            video.onerror = () => {
                // Still add the node with default dimensions
                addNode({
                    type: 'video',
                    x: x - 200,
                    y: y - 112,
                    width: 400,
                    height: 225,
                    src: url,
                    fileName: file.name,
                    duration: 0,
                });
                onClose?.();
            };
            video.src = url;
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleFileSelect = (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card border border-border rounded-xl shadow-2xl p-6 w-[400px] max-w-[90vw]">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-foreground">Upload Video</h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Drop Zone */}
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all",
                        isDragging
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50 hover:bg-accent/50"
                    )}
                >
                    <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-foreground font-medium mb-2">
                        Drop a video file here or click to browse
                    </p>
                    <p className="text-sm text-muted-foreground">
                        MP4, WebM, MOV, AVI up to 250MB
                    </p>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {/* Error Message */}
                {error && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-destructive">{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
