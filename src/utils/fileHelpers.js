const MAX_FILE_SIZE_MB = 250;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Max size for base64 encoding (50MB) — larger files stay as blob URLs
const MAX_BASE64_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Validates that a file is within the allowed size limit.
 * @param {File} file - The file to validate.
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateFileSize(file) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return {
            valid: false,
            message: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`,
        };
    }
    return { valid: true };
}

/**
 * Creates a persistent data URL for a file (base64-encoded).
 * Falls back to blob URL for very large files.
 * @param {File} file - The file to process.
 * @returns {Promise<string>} - Data URL or Object URL for the file.
 */
export function handleFileUpload(file) {
    return new Promise((resolve, reject) => {
        const validation = validateFileSize(file);
        if (!validation.valid) {
            reject(new Error(validation.message));
            return;
        }

        // For files under 50MB, convert to base64 data URL so they persist across sessions
        if (file.size <= MAX_BASE64_SIZE_BYTES) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => {
                // Fallback to blob URL if FileReader fails
                resolve(URL.createObjectURL(file));
            };
            reader.readAsDataURL(file);
        } else {
            // For very large files, use blob URL (won't survive page reload)
            const url = URL.createObjectURL(file);
            resolve(url);
        }
    });
}

/**
 * Extracts YouTube video ID from various YouTube URL formats.
 * @param {string} url - The YouTube URL.
 * @returns {string | null} - The video ID or null if invalid.
 */
export function parseYoutubeUrl(url) {
    if (!url) return null;

    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

/**
 * Gets the embed URL for a YouTube video.
 * @param {string} videoId - The YouTube video ID.
 * @returns {string} - The embed URL.
 */
export function getYoutubeEmbedUrl(videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
}
