import { useRef, useState } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { validateFileSize, handleFileUpload } from '../../utils/fileHelpers';
import useStore from '../../store/useStore';
import { cn } from '../../lib/utils';

export default function ImageUploader({ onClose }) {
    const fileInputRef = useRef(null);
    const [error, setError] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const { addNode, stagePosition, stageScale } = useStore();

    const processFile = async (file) => {
        setError(null);

        // Check if it's an image
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file (PNG, JPG, GIF, etc.)');
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

            // Get image dimensions
            const img = new Image();
            img.onload = () => {
                // Calculate position (center of viewport)
                const x = (window.innerWidth / 2 - stagePosition.x) / stageScale;
                const y = (window.innerHeight / 2 - stagePosition.y) / stageScale;

                // Scale down large images
                let width = img.width;
                let height = img.height;
                const maxSize = 400;

                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width *= ratio;
                    height *= ratio;
                }

                addNode({
                    type: 'image',
                    x: x - width / 2,
                    y: y - height / 2,
                    width,
                    height,
                    src: url,
                });

                onClose?.();
            };
            img.src = url;
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
                    <h2 className="text-lg font-semibold text-foreground">Upload Image</h2>
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
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-foreground font-medium mb-2">
                        Drop an image here or click to browse
                    </p>
                    <p className="text-sm text-muted-foreground">
                        PNG, JPG, GIF, SVG up to 250MB
                    </p>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
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
