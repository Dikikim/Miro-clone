import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const LOCAL_STORAGE_KEY_PREFIX = 'kot_state_board_';
const BOARD_NAMES_KEY = 'kot_board_names';
const CURRENT_BOARD_KEY = 'kot_current_board';
const MAX_BOARDS = 100;
const DEFAULT_BOARD_NAMES = Array.from({ length: 6 }, (_, i) => `Board ${i + 1}`);

const getBoardStorageKey = (boardId) => `${LOCAL_STORAGE_KEY_PREFIX}${boardId}`;
const MAX_HISTORY = 50;

// Shallow clone of nodes (deep-copies points arrays, avoids copying base64 strings)
const cloneNodes = (nodes) => nodes.map(node => (node.points ? { ...node, points: [...node.points] } : { ...node }));

// Debounce helper
let saveTimeout = null;
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

// Load/save current board ID
const loadCurrentBoardId = () => {
    try {
        const raw = localStorage.getItem(CURRENT_BOARD_KEY);
        if (raw !== null) {
            const id = parseInt(raw, 10);
            const names = loadBoardNames();
            if (id >= 0 && id < names.length) return id;
        }
    } catch { /* ignore */ }
    return 0;
};

const saveCurrentBoardId = (id) => {
    try {
        localStorage.setItem(CURRENT_BOARD_KEY, String(id));
    } catch { /* ignore */ }
};

const useStore = create((set, get) => ({
    // Board management
    currentBoardId: loadCurrentBoardId(),
    boardNames: loadBoardNames(),

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
    textColor: '#000000',
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
        await saveToLocalStorage(state);
        set({ hasUnsavedChanges: false, lastSaved: new Date().toISOString() });
    },

    loadData: async () => {
        set({ isLoading: true });

        // Load board names
        const boardNames = loadBoardNames();
        const currentBoardId = get().currentBoardId;

        const localData = await loadFromLocalStorage(currentBoardId);
        if (localData) {
            const nodes = localData.nodes || [];
            set({
                nodes,
                comments: localData.comments || [],
                boardNames,
                stagePosition: localData.stagePosition || { x: 0, y: 0 },
                stageScale: localData.stageScale || 1,
                history: [cloneNodes(nodes)],
                historyIndex: 0,
            });
        } else {
            set({ boardNames, history: [[]], historyIndex: 0 });
        }
        set({ isLoading: false });
    },

    // --- Multi-board ---
    switchBoard: async (targetBoardId) => {
        if (targetBoardId === get().currentBoardId) return;
        const state = get();

        // Save current board
        await saveToLocalStorage(state, state.currentBoardId);

        // Load target board (comments included — otherwise they leak across boards)
        const localData = await loadFromLocalStorage(targetBoardId);
        const nodes = localData?.nodes || [];

        set({
            currentBoardId: targetBoardId,
            nodes,
            comments: localData?.comments || [],
            selectedNodeIds: [],
            stagePosition: localData?.stagePosition || { x: 0, y: 0 },
            stageScale: localData?.stageScale || 1,
            history: [cloneNodes(nodes)],
            historyIndex: 0,
            hasUnsavedChanges: false,
            tool: 'select',
        });
        saveCurrentBoardId(targetBoardId);
    },

    renameBoard: (boardId, name) => {
        const names = [...get().boardNames];
        names[boardId] = name;
        set({ boardNames: names });
        saveBoardNames(names);
    },

    addBoard: (name) => {
        const names = [...get().boardNames];
        if (names.length >= MAX_BOARDS) return null;
        const newName = name || `Board ${names.length + 1}`;
        names.push(newName);
        set({ boardNames: names });
        saveBoardNames(names);
        return names.length - 1;
    },

    deleteBoard: async (boardId) => {
        const { boardNames, currentBoardId } = get();
        if (boardNames.length <= 1) return; // Keep at least 1 board
        const names = boardNames.filter((_, i) => i !== boardId);

        // Boards are keyed by index, so all boards after the deleted one
        // must shift their stored data down by one slot
        try {
            for (let i = boardId + 1; i < boardNames.length; i++) {
                const data = localStorage.getItem(getBoardStorageKey(i));
                if (data !== null) {
                    localStorage.setItem(getBoardStorageKey(i - 1), data);
                } else {
                    localStorage.removeItem(getBoardStorageKey(i - 1));
                }
            }
            localStorage.removeItem(getBoardStorageKey(boardNames.length - 1));
        } catch { /* ignore */ }
        saveBoardNames(names);

        if (boardId === currentBoardId) {
            // Load the board that now occupies this slot (or the new last board)
            const targetId = Math.min(boardId, names.length - 1);
            const localData = await loadFromLocalStorage(targetId);
            const nodes = localData?.nodes || [];
            set({
                boardNames: names,
                currentBoardId: targetId,
                nodes,
                comments: localData?.comments || [],
                selectedNodeIds: [],
                stagePosition: localData?.stagePosition || { x: 0, y: 0 },
                stageScale: localData?.stageScale || 1,
                history: [cloneNodes(nodes)],
                historyIndex: 0,
                hasUnsavedChanges: false,
                tool: 'select',
            });
            saveCurrentBoardId(targetId);
        } else {
            // Same board stays active; only its index may have shifted
            const newCurrentId = currentBoardId > boardId ? currentBoardId - 1 : currentBoardId;
            set({ boardNames: names, currentBoardId: newCurrentId });
            saveCurrentBoardId(newCurrentId);
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
    },

    resolveComment: (commentId) => {
        set(state => ({
            comments: state.comments.map(c =>
                c.id === commentId ? { ...c, resolved: !c.resolved } : c
            ),
            hasUnsavedChanges: true,
        }));
        saveToLocalStorageSync(get());
    },

    deleteComment: (commentId) => {
        set(state => ({
            comments: state.comments.filter(c => c.id !== commentId),
            hasUnsavedChanges: true,
        }));
        saveToLocalStorageSync(get());
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
    },

    // --- Lock ---
    toggleLock: (nodeId) => {
        set((state) => ({
            nodes: state.nodes.map(n => n.id === nodeId ? { ...n, locked: !n.locked } : n),
            hasUnsavedChanges: true,
        }));
        saveToLocalStorageSync(get());
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
