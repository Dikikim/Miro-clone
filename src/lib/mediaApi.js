import { supabase } from './supabase';

// Phase 4 media layer: pushes binary media (image/video/audio src, PDF cover +
// bytes) into the public `board-media` Storage bucket and hands back a public
// URL. Every call is best-effort — on any error it logs and returns null so the
// caller falls back to the existing IndexedDB / `__idb__` path and the app keeps
// working even before the 0003 migration / bucket exists.

const BUCKET = 'board-media';

// data: URL → Blob, WITHOUT fetch(): the app's CSP blocks `connect-src data:`,
// so fetching a data: URL throws. Decode it by hand instead.
export function dataUrlToBlob(dataUrl) {
    const comma = dataUrl.indexOf(',');
    const head = dataUrl.slice(0, comma);
    const body = dataUrl.slice(comma + 1);
    const mime = (head.match(/^data:([^;,]+)/) || [])[1] || 'application/octet-stream';
    if (/;base64/i.test(head)) {
        return new Blob([base64ToBytes(body)], { type: mime });
    }
    return new Blob([new TextEncoder().encode(decodeURIComponent(body))], { type: mime });
}

// Raw base64 (no data: prefix) → Uint8Array. Chunked to avoid building a giant
// argument list for String operations on large (tens-of-MB) media.
export function base64ToBytes(base64) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

export function publicUrl(path) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
}

// Upload a Blob/File at `path` (overwriting). Returns its public URL or null.
export async function uploadBlob(path, blob, contentType) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: contentType || blob.type || 'application/octet-stream',
        upsert: true,
        cacheControl: '31536000',
    });
    if (error) { console.error('[media] upload', path, error.message); return null; }
    return publicUrl(path);
}

export async function uploadDataUrl(path, dataUrl) {
    try {
        const blob = dataUrlToBlob(dataUrl);
        return await uploadBlob(path, blob, blob.type);
    } catch (e) { console.error('[media] uploadDataUrl', path, e); return null; }
}

export async function uploadBase64(path, base64, contentType) {
    try {
        const blob = new Blob([base64ToBytes(base64)], { type: contentType });
        return await uploadBlob(path, blob, contentType);
    } catch (e) { console.error('[media] uploadBase64', path, e); return null; }
}
