// Shared PDF.js helpers — kept outside component files so Vite fast refresh works.

// Load PDF.js from CDN
export const loadPdfJs = () => {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) {
            resolve(window.pdfjsLib);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(window.pdfjsLib);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

// Parsing a PDF is expensive, so cache the loaded document per byte buffer.
// Without this, rendering N pages (grid thumbnails, multi-page extraction)
// re-parsed the whole file N times — slow, and the pile-up of worker tasks
// produced blank renders. Keyed by the original Uint8Array identity; callers
// reuse a stable ref (pdfBytesRef.current), so they hit the cache.
const docCache = new WeakMap(); // pdfBytes (Uint8Array) -> Promise<PDFDocumentProxy>

const getDocument = async (pdfBytes) => {
    let docPromise = docCache.get(pdfBytes);
    if (!docPromise) {
        const pdfjsLib = await loadPdfJs();
        // Copy the bytes so PDF.js doesn't detach the caller's buffer
        const bytesCopy = new Uint8Array(pdfBytes);
        docPromise = pdfjsLib.getDocument({ data: bytesCopy }).promise;
        docCache.set(pdfBytes, docPromise);
    }
    return docPromise;
};

/**
 * Render a single page of a PDF to a data URL.
 * @param {Uint8Array} pdfBytes - Raw PDF file bytes
 * @param {number} pageNum - 1-indexed page number
 * @param {number} scale - Render scale
 */
export const renderPdfPage = async (pdfBytes, pageNum, scale = 1.5) => {
    const pdf = await getDocument(pdfBytes);
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    return { dataUrl: canvas.toDataURL('image/png'), width: viewport.width, height: viewport.height };
};

/**
 * Resolve PDF bytes from a source string — either an http(s) URL (fetched) or a
 * `data:` URL (decoded by hand; the app's CSP blocks `fetch()` on data: URLs).
 * Returns Uint8Array or null. Throws on a failed HTTP fetch so callers can fall
 * through to the next candidate source.
 */
export const fetchPdfBytes = async (url) => {
    if (typeof url !== 'string' || !url) return null;
    if (url.startsWith('data:')) {
        return base64ToBytes(url.slice(url.indexOf(',') + 1));
    }
    if (/^https?:\/\//.test(url)) {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return new Uint8Array(await r.arrayBuffer());
    }
    return null;
};

/**
 * Read a PDF's page count from its bytes (uses the cached document).
 */
export const getPdfPageCount = async (pdfBytes) => {
    const pdf = await getDocument(pdfBytes);
    return pdf.numPages;
};

/**
 * Convert base64 string back to Uint8Array
 */
export const base64ToBytes = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};

/**
 * Convert ArrayBuffer/Uint8Array to base64 string
 */
export const bytesToBase64 = (buffer) => {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize));
    }
    return btoa(binary);
};
