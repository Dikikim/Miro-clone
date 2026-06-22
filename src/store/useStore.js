import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import * as boardsApi from '../lib/boardsApi';
import * as mediaApi from '../lib/mediaApi';

const LOCAL_STORAGE_KEY_PREFIX = 'kot_state_board_';
const BOARD_NAMES_KEY = 'kot_board_names';        // legacy (pre-cloud) board names
const CURRENT_BOARD_KEY = 'kot_current_board';
const BOARDS_CACHE_KEY = 'kot_boards';            // cached [{id,name}] for first paint
const IMPORT_DONE_KEY = 'kot_cloud_import_done';  // one-time local→cloud import flag
const MAX_BOARDS = 100;
const DEFAULT_BOARD_NAMES = Array.from({ length: 6 }, (_, i) => `Board ${i + 1}`);

const getBoardStorageKey = (boardId) => `${LOCAL_STORAGE_KEY_PREFIX}${boardId}`;
const MAX_HISTORY = 50;

// Shallow clone of nodes (deep-copies points arrays, avoids copying base64 strings)
const cloneNodes = (nodes) => nodes.map(node => (node.points ? { ...node, points: [...node.points] } : { ...node }));

// Debounce helper
let saveTimeout = null;
// Guards loadData against concurrent invocation (React StrictMode fires the mount
// effect twice in dev) — without it, two runs both see an empty cloud and import
// the local boards twice, producing duplicate boards.
let loadDataPromise = null;
const debounceSave = (fn, delay = 500) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(fn, delay);
};

// --- IndexedDB helpers for large media data ---
const MEDIA_DB_NAME = 'kot_media';
const MEDIA_STORE_NAME = 'media_sources';

const openMediaDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(MEDIA_DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(MEDIA_STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveMediaToDB = async (nodeId, src) => {
    try {
        const db = await openMediaDB();
        const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
        tx.objectStore(MEDIA_STORE_NAME).put(src, nodeId);
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    } catch (e) {
        console.error('IndexedDB media save error:', e);
    }
};

const loadMediaFromDB = async (nodeId) => {
    try {
        const db = await openMediaDB();
        const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
        const request = tx.objectStore(MEDIA_STORE_NAME).get(nodeId);
        return new Promise((res) => {
            request.onsuccess = () => res(request.result || null);
            request.onerror = () => res(null);
        });
    } catch {
        return null;
    }
};

// --- localStorage helpers ---
// Strips large data URLs from nodes to stay within localStorage quota
const LARGE_SRC_THRESHOLD = 100_000; // 100KB

// Synchronous save — used on beforeunload and after every mutation
// Skips IndexedDB (async) but still saves node metadata
const saveToLocalStorageSync = (state, boardId) => {
    const id = boardId !== undefined ? boardId : (state.currentBoardId || 0);
    try {
        const nodesForStorage = state.nodes.map((node) => {
            let result = node;
            if (result.src && result.src.length > LARGE_SRC_THRESHOLD) {
                if (!result.src.startsWith('__idb__')) {
                    saveMediaToDB(result.id, result.src).catch(e => console.error('IDB sync error:', e));
                }
                result = { ...result, src: `__idb__${result.id}` };
            }
            if (result.coverSrc && result.coverSrc.length > LARGE_SRC_THRESHOLD) {
                if (!result.coverSrc.startsWith('__idb__')) {
                    saveMediaToDB(`${result.id}_cover`, result.coverSrc).catch(e => console.error('IDB sync error:', e));
                }
                result = { ...result, coverSrc: `__idb__${result.id}_cover` };
            }
            return result;
        });
        const data = {
            nodes: nodesForStorage,
            comments: state.comments || [],
            stagePosition: state.stagePosition,
            stageScale: state.stageScale,
        };
        localStorage.setItem(getBoardStorageKey(id), JSON.stringify(data));
    } catch (e) {
        console.error('✗ localStorage sync save error:', e);
    }
};

// Async save — also persists large media to IndexedDB
const saveToLocalStorage = async (state, boardId) => {
    const id = boardId !== undefined ? boardId : (state.currentBoardId || 0);
    try {
        const nodesForStorage = await Promise.all(state.nodes.map(async (node) => {
            let result = node;
            if (result.src && result.src.length > LARGE_SRC_THRESHOLD) {
                await saveMediaToDB(result.id, result.src);
                result = { ...result, src: `__idb__${result.id}` };
            }
            if (result.coverSrc && result.coverSrc.length > LARGE_SRC_THRESHOLD) {
                await saveMediaToDB(`${result.id}_cover`, result.coverSrc);
                result = { ...result, coverSrc: `__idb__${result.id}_cover` };
            }
            return result;
        }));

        const data = {
            nodes: nodesForStorage,
            comments: state.comments || [],
            stagePosition: state.stagePosition,
            stageScale: state.stageScale,
        };
        localStorage.setItem(getBoardStorageKey(id), JSON.stringify(data));
    } catch (e) {
        console.error('✗ localStorage save error:', e);
    }
};

const loadFromLocalStorage = async (boardId = 0) => {
    try {
        const raw = localStorage.getItem(getBoardStorageKey(boardId));
        if (raw) {
            const data = JSON.parse(raw);
            if (data.nodes) {
                data.nodes = await Promise.all(data.nodes.map(async (node) => {
                    let result = node;
                    if (result.src && typeof result.src === 'string' && result.src.startsWith('__idb__')) {
                        const key = result.src.replace('__idb__', '');
                        const src = await loadMediaFromDB(key);
                        result = { ...result, src: src || '' };
                    }
                    if (result.coverSrc && typeof result.coverSrc === 'string' && result.coverSrc.startsWith('__idb__')) {
                        const key = result.coverSrc.replace('__idb__', '');
                        const coverSrc = await loadMediaFromDB(key);
                        result = { ...result, coverSrc: coverSrc || '' };
                    }
                    return result;
                }));
            }
            return data;
        }
    } catch (e) {
        console.error('✗ localStorage load error:', e);
    }
    return null;
};

// Load/save board names
const loadBoardNames = () => {
    try {
        const raw = localStorage.getItem(BOARD_NAMES_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [...DEFAULT_BOARD_NAMES];
};

const saveBoardNames = (names) => {
    try {
        localStorage.setItem(BOARD_NAMES_KEY, JSON.stringify(names));
    } catch { /* ignore */ }
};

// Load/save current board ID (now a board UUID string)
const loadCurrentBoardId = () => {
    try {
        return localStorage.getItem(CURRENT_BOARD_KEY) || null;
    } catch { return null; }
};

const saveCurrentBoardId = (id) => {
    try {
        if (id) localStorage.setItem(CURRENT_BOARD_KEY, String(id));
    } catch { /* ignore */ }
};

// Cached board list [{id,name}] so the switcher paints instantly before the
// cloud fetch resolves (offline-first).
const loadBoardsCache = () => {
    try { return JSON.parse(localStorage.getItem(BOARDS_CACHE_KEY) || '[]'); } catch { return []; }
};
const saveBoardsCache = (boards) => {
    try { localStorage.setItem(BOARDS_CACHE_KEY, JSON.stringify(boards.map(b => ({ id: b.id, name: b.name })))); } catch { /* ignore */ }
};

// ── Cloud sync helpers ───────────────────────────────────────────────────
// Strip large media to IndexedDB the same way saveToLocalStorageSync does, so
// the cloud row stores a lightweight `__idb__<id>` ref (real media moves to
// Supabase Storage in Phase 4). Keeps Postgres rows small.
const stripNodeForStorage = (node) => {
    let result = node;
    if (result.src && result.src.length > LARGE_SRC_THRESHOLD) {
        if (!result.src.startsWith('__idb__')) saveMediaToDB(result.id, result.src).catch(() => {});
        result = { ...result, src: `__idb__${result.id}` };
    }
    if (result.coverSrc && result.coverSrc.length > LARGE_SRC_THRESHOLD) {
        if (!result.coverSrc.startsWith('__idb__')) saveMediaToDB(`${result.id}_cover`, result.coverSrc).catch(() => {});
        result = { ...result, coverSrc: `__idb__${result.id}_cover` };
    }
    return result;
};
const stripNodes = (nodes) => nodes.map(stripNodeForStorage);

// Resolve `__idb__` media refs back to data URLs from IndexedDB after a cloud
// fetch (media not present in this browser resolves to '' until Phase 4).
const resolveMediaNodes = async (nodes) => Promise.all(nodes.map(async (node) => {
    let result = node;
    if (typeof result.src === 'string' && result.src.startsWith('__idb__')) {
        result = { ...result, src: (await loadMediaFromDB(result.src.replace('__idb__', ''))) || '' };
    }
    if (typeof result.coverSrc === 'string' && result.coverSrc.startsWith('__idb__')) {
        result = { ...result, coverSrc: (await loadMediaFromDB(result.coverSrc.replace('__idb__', ''))) || '' };
    }
    return result;
}));

// ── Cloud media (Phase 4) ──────────────────────────────────────────────────
// Move a node's binary media into Supabase Storage and rewrite the node to hold
// public URLs, so other board members (and the same user on another device) can
// load it. Best-effort: if Storage isn't reachable/configured, the node comes
// back unchanged and the IndexedDB/`__idb__` path keeps working locally.
const isHttpUrl = (s) => typeof s === 'string' && /^https?:\/\//.test(s);
const nodeNeedsUpload = (n) =>
    (n.src && !isHttpUrl(n.src)) ||
    (n.coverSrc && !isHttpUrl(n.coverSrc)) ||
    (n.type === 'pdf' && !isHttpUrl(n.pdfUrl));

// Resolve a node field (data:/blob:/__idb__) to something uploadable, or null.
const resolveUploadable = async (value) => {
    if (typeof value !== 'string' || !value) return null;
    if (value.startsWith('data:')) return { kind: 'dataUrl', value };
    if (value.startsWith('__idb__')) {
        const stored = await loadMediaFromDB(value.replace('__idb__', ''));
        return stored ? { kind: 'dataUrl', value: stored } : null;  // IDB src/cover are full data URLs
    }
    if (value.startsWith('blob:')) {
        try { return { kind: 'blob', value: await fetch(value).then(r => r.blob()) }; }
        catch { return null; }
    }
    return null;  // already http(s) or unrecognized
};

const uploadField = async (path, resolved) => {
    if (!resolved) return null;
    return resolved.kind === 'dataUrl'
        ? mediaApi.uploadDataUrl(path, resolved.value)
        : mediaApi.uploadBlob(path, resolved.value);
};

// Upload one node's media; returns a new node with URL fields if anything moved,
// otherwise the same reference (so callers can cheaply detect "no change").
const uploadNodeMedia = async (boardId, node) => {
    if (!boardId || !nodeNeedsUpload(node)) return node;
    const base = `${boardId}/${node.id}`;
    let out = node;

    if (out.src && !isHttpUrl(out.src)) {
        const url = await uploadField(`${base}/src`, await resolveUploadable(out.src));
        if (url) out = { ...out, src: url };
    }
    if (out.coverSrc && !isHttpUrl(out.coverSrc)) {
        const url = await uploadField(`${base}/cover`, await resolveUploadable(out.coverSrc));
        if (url) out = { ...out, coverSrc: url };
    }
    if (out.type === 'pdf' && !isHttpUrl(out.pdfUrl)) {
        const b64 = await loadMediaFromDB(`${node.id}_pdf`);   // stored as raw base64
        if (b64) {
            const url = await mediaApi.uploadBase64(`${base}/doc.pdf`, b64, 'application/pdf');
            if (url) out = { ...out, pdfUrl: url };
        }
    }
    return out;
};

// Per-board record of what we last pushed, so each save only sends the diff.
const lastSyncedNodes = new Map();    // boardId -> Map(id -> jsonHash)
const lastSyncedComments = new Map();
const hashItem = (item) => JSON.stringify(item);

const diffItems = (boardId, items, store) => {
    const prev = store.get(boardId) || new Map();
    const next = new Map();
    const upserts = [];
    for (const it of items) {
        const h = hashItem(it);
        next.set(it.id, h);
        if (prev.get(it.id) !== h) upserts.push(it);
    }
    const deleteIds = [];
    for (const id of prev.keys()) if (!next.has(id)) deleteIds.push(id);
    store.set(boardId, next);
    return { upserts, deleteIds };
};
const seedSynced = (boardId, items, store) => {
    const m = new Map();
    for (const it of items) m.set(it.id, hashItem(it));
    store.set(boardId, m);
};

// One-time import of legacy localStorage boards into the cloud (runs on first
// cloud login when the account has no boards yet).
async function importLocalBoards() {
    try {
        if (localStorage.getItem(IMPORT_DONE_KEY)) return [];
        const names = JSON.parse(localStorage.getItem(BOARD_NAMES_KEY) || 'null');
        const created = [];
        if (Array.isArray(names) && names.length) {
            for (let i = 0; i < names.length; i++) {
                const b = await boardsApi.createBoard(names[i] || `Board ${i + 1}`);
                if (!b) continue;
                created.push(b);
                const raw = localStorage.getItem(getBoardStorageKey(i));
                if (!raw) continue;
                try {
                    const data = JSON.parse(raw);
                    const nodes = data.nodes || [];        // already in stripped __idb__ form
                    const comments = data.comments || [];
                    if (nodes.length) await boardsApi.pushNodes(b.id, nodes, []);
                    if (comments.length) await boardsApi.pushComments(b.id, comments, []);
                } catch (e) { console.error('[import] board', i, e); }
            }
        }
        localStorage.setItem(IMPORT_DONE_KEY, '1');
        return created;
    } catch (e) {
        console.error('[import] failed:', e);
        return [];
    }
}

const useStore = create((set, get) => ({
    // Board management — boards: [{ id (uuid), name }], currentBoardId: uuid
    currentBoardId: loadCurrentBoardId(),
    boards: loadBoardsCache(),

    // Canvas state
    nodes: [],
    selectedNodeIds: [],
    tool: 'select',
    shapeType: 'rectangle',

    // Canvas view state
    stagePosition: { x: 0, y: 0 },
    stageScale: 1,

    // Tool colors
    fillColor: '#3b82f6',
    strokeColor: '#1e40af',
    penStrokeWidth: 2,
    highlighterStrokeWidth: 20,
    laserStrokeWidth: 3,
    objectStrokeWidth: 2,
    textColor: null,   // null = follow the theme (black in light, white in dark); a real colour pins it
    textFontFamily: 'Arial',
    textFontSize: 24,
    highlighterColor: '#ffeb3b',

    // Shape corner radius
    cornerRadius: 4,

    // Clipboard
    clipboard: [],

    // Comments
    comments: [],

    // Sticky settings
    stickyColor: '#fef08a',
    stickyPileMode: false, // true = place 3 stickers as pile
    setStickyColor: (color) => set({ stickyColor: color }),
    setStickyPileMode: (mode) => set({ stickyPileMode: mode }),

    // Board search
    boardSearch: '',

    // Undo/Redo history
    history: [],
    historyIndex: -1,

    // Save state
    isSaving: false,
    isLoading: false,
    lastSaved: null,
    hasUnsavedChanges: false,

    // --- Computed helpers ---
    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    // --- History management ---
    // Snapshots are taken AFTER each mutation, so history[historyIndex]
    // always mirrors the current state and redo can restore the newest state.
    pushToHistory: () => {
        const { nodes, history, historyIndex } = get();
        const snapshot = cloneNodes(nodes);
        // Discard any future states if we branched
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(snapshot);
        // Cap history size
        if (newHistory.length > MAX_HISTORY) {
            newHistory.shift();
        }
        set({ history: newHistory, historyIndex: newHistory.length - 1 });
    },

    undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex <= 0) return;
        const newIndex = historyIndex - 1;
        set({ nodes: cloneNodes(history[newIndex]), historyIndex: newIndex, selectedNodeIds: [], hasUnsavedChanges: true });
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;
        const newIndex = historyIndex + 1;
        set({ nodes: cloneNodes(history[newIndex]), historyIndex: newIndex, selectedNodeIds: [], hasUnsavedChanges: true });
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    // --- Actions ---
    setTool: (tool) => set({ tool }),
    setShapeType: (shapeType) => set({ shapeType }),

    setFillColor: (color) => set({ fillColor: color }),
    setStrokeColor: (color) => set({ strokeColor: color }),
    setPenStrokeWidth: (width) => set({ penStrokeWidth: width }),
    setHighlighterStrokeWidth: (width) => set({ highlighterStrokeWidth: width }),
    setLaserStrokeWidth: (width) => set({ laserStrokeWidth: width }),
    setObjectStrokeWidth: (width) => set({ objectStrokeWidth: width }),
    setTextColor: (color) => set({ textColor: color }),
    setTextFontFamily: (family) => set({ textFontFamily: family }),
    setTextFontSize: (size) => set({ textFontSize: size }),
    setHighlighterColor: (color) => set({ highlighterColor: color }),
    setCornerRadius: (radius) => set({ cornerRadius: radius }),
    setBoardSearch: (search) => set({ boardSearch: search }),

    addNode: (nodeData) => {
        const newNode = { id: uuidv4(), ...nodeData };
        set((state) => ({ nodes: [...state.nodes, newNode], hasUnsavedChanges: true }));
        get().pushToHistory();
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
        return newNode.id;
    },

    updateNode: (id, updates) => {
        set((state) => ({
            nodes: state.nodes.map((node) =>
                node.id === id ? { ...node, ...updates } : node
            ),
            hasUnsavedChanges: true,
        }));
        get().pushToHistory();
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    // --- Transient drawing (pen/highlighter strokes) ---
    // A stroke generates hundreds of mousemove updates; recording history and
    // serializing the board per point would flood undo and hammer localStorage.
    // The stroke is added/extended transiently and committed once on mouseup.
    beginStrokeNode: (nodeData) => {
        const newNode = { id: uuidv4(), ...nodeData };
        set((state) => ({ nodes: [...state.nodes, newNode], hasUnsavedChanges: true }));
        return newNode.id;
    },

    updateNodeTransient: (id, updates) => {
        set((state) => ({
            nodes: state.nodes.map((node) =>
                node.id === id ? { ...node, ...updates } : node
            ),
            hasUnsavedChanges: true,
        }));
    },

    commitTransient: () => {
        get().pushToHistory();
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    deleteNode: (id) => {
        set((state) => ({
            nodes: state.nodes.filter((node) => node.id !== id),
            selectedNodeIds: state.selectedNodeIds.filter((nodeId) => nodeId !== id),
            hasUnsavedChanges: true,
        }));
        get().pushToHistory();
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    selectNode: (id, multiSelect = false) => {
        set((state) => {
            if (multiSelect) {
                const isSelected = state.selectedNodeIds.includes(id);
                return {
                    selectedNodeIds: isSelected
                        ? state.selectedNodeIds.filter((nodeId) => nodeId !== id)
                        : [...state.selectedNodeIds, id],
                };
            }
            return { selectedNodeIds: [id] };
        });
    },

    clearSelection: () => set({ selectedNodeIds: [] }),

    setStagePosition: (position) => {
        set({ stagePosition: position, hasUnsavedChanges: true });
        debounceSave(() => get().syncSave());
    },
    setStageScale: (scale) => {
        set({ stageScale: scale, hasUnsavedChanges: true });
        debounceSave(() => get().syncSave());
    },

    deleteSelectedNodes: () => {
        set((state) => ({
            nodes: state.nodes.filter((node) => !state.selectedNodeIds.includes(node.id)),
            selectedNodeIds: [],
            hasUnsavedChanges: true,
        }));
        get().pushToHistory();
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    deleteAllNodes: () => {
        set({ nodes: [], selectedNodeIds: [], hasUnsavedChanges: true });
        get().pushToHistory();
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    // --- Save (local only) ---
    syncSave: async () => {
        const state = get();
        const boardId = state.currentBoardId;
        // Always refresh the local cache first (offline-first).
        await saveToLocalStorage(state, boardId);
        set({ hasUnsavedChanges: false, lastSaved: new Date().toISOString() });

        // Then push the diff to Supabase (best-effort; RLS rejects writes to
        // objects the user doesn't own, which is intended).
        if (!boardId) return;
        const uid = await boardsApi.getUserId();
        if (!uid) return;

        // Phase 4: push this user's local media to Storage and rewrite the
        // affected nodes to hold public URLs (so the cloud row, and every other
        // viewer, gets a loadable link). Only touch nodes we may write — RLS
        // rejects the rest anyway. Best-effort: failed uploads leave the node as
        // is, so stripNodes still falls back to an `__idb__` ref.
        const own = (n) => !n.createdBy || n.createdBy === uid;
        if (state.nodes.some(n => own(n) && nodeNeedsUpload(n))) {
            const uploaded = await Promise.all(
                state.nodes.map(n => (own(n) ? uploadNodeMedia(boardId, n) : Promise.resolve(n)))
            );
            const byId = new Map(uploaded.map(n => [n.id, n]));
            // Merge URL fields back by id so edits made during the upload await
            // aren't clobbered (only the media links are applied).
            set((s) => ({
                nodes: s.nodes.map((n) => {
                    const u = byId.get(n.id);
                    if (!u || u === n) return n;
                    const patch = {};
                    if (isHttpUrl(u.src) && u.src !== n.src) patch.src = u.src;
                    if (isHttpUrl(u.coverSrc) && u.coverSrc !== n.coverSrc) patch.coverSrc = u.coverSrc;
                    if (isHttpUrl(u.pdfUrl) && u.pdfUrl !== n.pdfUrl) patch.pdfUrl = u.pdfUrl;
                    return Object.keys(patch).length ? { ...n, ...patch } : n;
                }),
            }));
            await saveToLocalStorage(get(), boardId);   // re-cache with URLs
        }

        const nodesForPush = get().nodes;
        const strippedNodes = stripNodes(nodesForPush);
        const nodeDiff = diffItems(boardId, strippedNodes, lastSyncedNodes);
        const commentDiff = diffItems(boardId, state.comments || [], lastSyncedComments);
        await boardsApi.pushNodes(boardId, nodeDiff.upserts, nodeDiff.deleteIds);
        await boardsApi.pushComments(boardId, commentDiff.upserts, commentDiff.deleteIds);
    },

    loadData: async () => {
        if (loadDataPromise) return loadDataPromise;
        loadDataPromise = (async () => {
        set({ isLoading: true });
        const uid = await boardsApi.getUserId();

        // Not signed in (shouldn't happen behind the login gate) — local cache only.
        if (!uid) {
            set({ boards: loadBoardsCache(), history: [[]], historyIndex: 0, isLoading: false });
            return;
        }

        let boards = await boardsApi.fetchBoards();
        if (boards === null) {
            // Network/RLS error — fall back to the cached board list.
            boards = loadBoardsCache();
        } else if (boards.length === 0) {
            // First cloud login: import existing local boards once, else seed one.
            boards = await importLocalBoards();
            if (boards.length === 0) {
                const b = await boardsApi.createBoard('Board 1');
                boards = b ? [b] : [];
            }
        }
        saveBoardsCache(boards);

        const savedId = loadCurrentBoardId();
        const currentBoardId = boards.find(b => b.id === savedId)?.id || boards[0]?.id || null;

        let nodes = [], comments = [];
        let stagePosition = { x: 0, y: 0 }, stageScale = 1;
        if (currentBoardId) {
            const content = await boardsApi.fetchBoardContent(currentBoardId);
            nodes = await resolveMediaNodes(content.nodes);
            comments = content.comments;
            seedSynced(currentBoardId, content.nodes, lastSyncedNodes);
            seedSynced(currentBoardId, content.comments, lastSyncedComments);
            // Viewport is a local preference (not synced to the cloud in Phase 3).
            const localBlob = await loadFromLocalStorage(currentBoardId);
            stagePosition = localBlob?.stagePosition || stagePosition;
            stageScale = localBlob?.stageScale || stageScale;
            saveCurrentBoardId(currentBoardId);
        }

        set({
            boards,
            currentBoardId,
            nodes,
            comments,
            stagePosition,
            stageScale,
            history: [cloneNodes(nodes)],
            historyIndex: 0,
            isLoading: false,
        });
        // Lazily migrate any pre-Phase-4 local media to cloud Storage so shared
        // viewers can see it (syncSave only uploads media this user owns).
        if (nodes.some(nodeNeedsUpload)) debounceSave(() => get().syncSave());
        })();
        try { return await loadDataPromise; } finally { loadDataPromise = null; }
    },

    // --- Multi-board (cloud-backed; boards keyed by UUID) ---
    // Shared loader: pull a board's content from the cloud into the canvas.
    _activateBoard: async (targetBoardId) => {
        const content = await boardsApi.fetchBoardContent(targetBoardId);
        const nodes = await resolveMediaNodes(content.nodes);
        seedSynced(targetBoardId, content.nodes, lastSyncedNodes);
        seedSynced(targetBoardId, content.comments, lastSyncedComments);
        const localBlob = await loadFromLocalStorage(targetBoardId);
        set({
            currentBoardId: targetBoardId,
            nodes,
            comments: content.comments,
            selectedNodeIds: [],
            stagePosition: localBlob?.stagePosition || { x: 0, y: 0 },
            stageScale: localBlob?.stageScale || 1,
            history: [cloneNodes(nodes)],
            historyIndex: 0,
            hasUnsavedChanges: false,
            tool: 'select',
        });
        saveCurrentBoardId(targetBoardId);
        if (nodes.some(nodeNeedsUpload)) debounceSave(() => get().syncSave());
    },

    switchBoard: async (targetBoardId) => {
        if (targetBoardId === get().currentBoardId) return;
        await get().syncSave();            // flush current board first
        await get()._activateBoard(targetBoardId);
    },

    renameBoard: (boardId, name) => {
        const next = get().boards.map(b => (b.id === boardId ? { ...b, name } : b));
        set({ boards: next });
        saveBoardsCache(next);
        boardsApi.renameBoardCloud(boardId, name);
    },

    addBoard: async (name) => {
        const boards = get().boards;
        if (boards.length >= MAX_BOARDS) return null;
        const b = await boardsApi.createBoard(name || `Board ${boards.length + 1}`);
        if (!b) return null;
        const next = [...boards, { id: b.id, name: b.name }];
        set({ boards: next });
        saveBoardsCache(next);
        return b.id;
    },

    deleteBoard: async (boardId) => {
        const { boards, currentBoardId } = get();
        if (boards.length <= 1) return; // Keep at least 1 board
        const next = boards.filter(b => b.id !== boardId);

        await boardsApi.deleteBoardCloud(boardId);  // cascade removes its nodes/comments
        try { localStorage.removeItem(getBoardStorageKey(boardId)); } catch { /* ignore */ }
        lastSyncedNodes.delete(boardId);
        lastSyncedComments.delete(boardId);

        set({ boards: next });
        saveBoardsCache(next);

        // If we deleted the active board, open another one.
        if (boardId === currentBoardId) {
            await get()._activateBoard(next[0].id);
        }
    },

    // --- Clipboard ---
    copySelectedNodes: () => {
        const { nodes, selectedNodeIds } = get();
        const toCopy = nodes.filter(n => selectedNodeIds.includes(n.id));
        if (toCopy.length === 0) return;
        const cloned = toCopy.map(n => {
            const clone = { ...n };
            if (clone.points) clone.points = [...clone.points];
            return clone;
        });
        set({ clipboard: cloned });
    },

    pasteNodes: (offsetX = 30, offsetY = 30) => {
        const { clipboard } = get();
        if (clipboard.length === 0) return;
        // Offset via x/y only — points stay relative to the node origin
        const pasted = clipboard.map(n => ({
            ...n,
            id: uuidv4(),
            x: (n.x || 0) + offsetX,
            y: (n.y || 0) + offsetY,
            ...(n.points ? { points: [...n.points] } : {}),
        }));
        set(state => ({
            nodes: [...state.nodes, ...pasted],
            selectedNodeIds: pasted.map(n => n.id),
            hasUnsavedChanges: true,
        }));
        get().pushToHistory();
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    cutSelectedNodes: () => {
        get().copySelectedNodes();
        get().deleteSelectedNodes();
    },

    // --- Comments ---
    addComment: (x, y, text, parentNodeId = null) => {
        const comment = {
            id: uuidv4(),
            x, y,
            parentNodeId,
            text,
            replies: [],
            resolved: false,
            createdAt: new Date().toISOString(),
        };
        set(state => ({ comments: [...state.comments, comment], hasUnsavedChanges: true }));
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
        return comment.id;
    },

    addReply: (commentId, text) => {
        const reply = { id: uuidv4(), text, createdAt: new Date().toISOString() };
        set(state => ({
            comments: state.comments.map(c =>
                c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c
            ),
            hasUnsavedChanges: true,
        }));
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    resolveComment: (commentId) => {
        set(state => ({
            comments: state.comments.map(c =>
                c.id === commentId ? { ...c, resolved: !c.resolved } : c
            ),
            hasUnsavedChanges: true,
        }));
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    deleteComment: (commentId) => {
        set(state => ({
            comments: state.comments.filter(c => c.id !== commentId),
            hasUnsavedChanges: true,
        }));
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    // --- Context Menu ---
    contextMenu: null,
    showContextMenu: (x, y, nodeId) => set({ contextMenu: { x, y, nodeId } }),
    hideContextMenu: () => set({ contextMenu: null }),

    // --- Z-Order ---
    bringToFront: (nodeId) => {
        set((state) => {
            const idx = state.nodes.findIndex(n => n.id === nodeId);
            if (idx === -1) return state;
            const node = state.nodes[idx];
            const rest = state.nodes.filter((_, i) => i !== idx);
            return { nodes: [...rest, node], hasUnsavedChanges: true };
        });
        get().pushToHistory();
        saveToLocalStorageSync(get());
    },
    sendToBack: (nodeId) => {
        set((state) => {
            const idx = state.nodes.findIndex(n => n.id === nodeId);
            if (idx === -1) return state;
            const node = state.nodes[idx];
            const rest = state.nodes.filter((_, i) => i !== idx);
            return { nodes: [node, ...rest], hasUnsavedChanges: true };
        });
        get().pushToHistory();
        saveToLocalStorageSync(get());
    },
    duplicateNode: (nodeId) => {
        const node = get().nodes.find(n => n.id === nodeId);
        if (!node) return;
        const newNode = { ...node, id: uuidv4(), x: (node.x || 0) + 30, y: (node.y || 0) + 30 };
        if (newNode.points && Array.isArray(newNode.points)) {
            newNode.points = [...newNode.points];
        }
        set((state) => ({ nodes: [...state.nodes, newNode], hasUnsavedChanges: true }));
        get().pushToHistory();
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    // --- Lock ---
    toggleLock: (nodeId) => {
        set((state) => ({
            nodes: state.nodes.map(n => n.id === nodeId ? { ...n, locked: !n.locked } : n),
            hasUnsavedChanges: true,
        }));
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    // --- Theme ---
    theme: (() => { try { return localStorage.getItem('kot_theme') || 'light'; } catch { return 'light'; } })(),
    toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: newTheme });
        try { localStorage.setItem('kot_theme', newTheme); } catch { /* ignore */ }
    },
}));

// Emergency save on page close/refresh — synchronous, guaranteed to run
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        const state = useStore.getState();
        saveToLocalStorageSync(state, state.currentBoardId);
    });

    // Migrate old single-board data to board 0 if it exists
    try {
        const oldData = localStorage.getItem('kot_state');
        if (oldData && !localStorage.getItem(getBoardStorageKey(0))) {
            localStorage.setItem(getBoardStorageKey(0), oldData);
            localStorage.removeItem('kot_state');
        }
    } catch { /* ignore */ }
}

export { loadMediaFromDB, saveMediaToDB };
export default useStore;
