import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const LOCAL_STORAGE_KEY_PREFIX = 'kot_state_board_';
const BOARD_NAMES_KEY = 'kot_board_names';
const CURRENT_BOARD_KEY = 'kot_current_board';
const MAX_BOARDS = 6;
const DEFAULT_BOARD_NAMES = ['Board 1', 'Board 2', 'Board 3', 'Board 4', 'Board 5', 'Board 6'];

const getBoardStorageKey = (boardId) => `${LOCAL_STORAGE_KEY_PREFIX}${boardId}`;
const MAX_HISTORY = 50;

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
    } catch (e) {
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
    } catch (e) { /* ignore */ }
    return [...DEFAULT_BOARD_NAMES];
};

const saveBoardNames = (names) => {
    try {
        localStorage.setItem(BOARD_NAMES_KEY, JSON.stringify(names));
    } catch (e) { /* ignore */ }
};

// Load/save current board ID
const loadCurrentBoardId = () => {
    try {
        const raw = localStorage.getItem(CURRENT_BOARD_KEY);
        if (raw !== null) {
            const id = parseInt(raw, 10);
            if (id >= 0 && id < MAX_BOARDS) return id;
        }
    } catch (e) { /* ignore */ }
    return 0;
};

const saveCurrentBoardId = (id) => {
    try {
        localStorage.setItem(CURRENT_BOARD_KEY, String(id));
    } catch (e) { /* ignore */ }
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
    strokeWidth: 2,
    textColor: '#000000',
    highlighterColor: '#ffeb3b',

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
    pushToHistory: () => {
        const { nodes, history, historyIndex } = get();
        // Shallow clone avoiding deep copy of base64 strings
        const snapshot = nodes.map(node => (node.points ? { ...node, points: [...node.points] } : { ...node }));
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
        const snapshot = history[newIndex].map(node => (node.points ? { ...node, points: [...node.points] } : { ...node }));
        set({ nodes: snapshot, historyIndex: newIndex, selectedNodeIds: [], hasUnsavedChanges: true });
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;
        const newIndex = historyIndex + 1;
        const snapshot = history[newIndex].map(node => (node.points ? { ...node, points: [...node.points] } : { ...node }));
        set({ nodes: snapshot, historyIndex: newIndex, selectedNodeIds: [], hasUnsavedChanges: true });
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    // --- Actions ---
    setTool: (tool) => set({ tool }),
    setShapeType: (shapeType) => set({ shapeType }),

    setFillColor: (color) => set({ fillColor: color }),
    setStrokeColor: (color) => set({ strokeColor: color }),
    setStrokeWidth: (width) => set({ strokeWidth: width }),
    setTextColor: (color) => set({ textColor: color }),
    setHighlighterColor: (color) => set({ highlighterColor: color }),

    addNode: (nodeData) => {
        get().pushToHistory();
        const newNode = { id: uuidv4(), ...nodeData };
        set((state) => ({ nodes: [...state.nodes, newNode], hasUnsavedChanges: true }));
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
        return newNode.id;
    },

    updateNode: (id, updates) => {
        get().pushToHistory();
        set((state) => ({
            nodes: state.nodes.map((node) =>
                node.id === id ? { ...node, ...updates } : node
            ),
            hasUnsavedChanges: true,
        }));
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    deleteNode: (id) => {
        get().pushToHistory();
        set((state) => ({
            nodes: state.nodes.filter((node) => node.id !== id),
            selectedNodeIds: state.selectedNodeIds.filter((nodeId) => nodeId !== id),
            hasUnsavedChanges: true,
        }));
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
        get().pushToHistory();
        set((state) => ({
            nodes: state.nodes.filter((node) => !state.selectedNodeIds.includes(node.id)),
            selectedNodeIds: [],
            hasUnsavedChanges: true,
        }));
        saveToLocalStorageSync(get());
        debounceSave(() => get().syncSave());
    },

    deleteAllNodes: () => {
        get().pushToHistory();
        set({ nodes: [], selectedNodeIds: [], hasUnsavedChanges: true });
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
                boardNames,
                stagePosition: localData.stagePosition || { x: 0, y: 0 },
                stageScale: localData.stageScale || 1,
                history: [nodes.map(node => (node.points ? { ...node, points: [...node.points] } : { ...node }))],
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

        // Load target board
        const localData = await loadFromLocalStorage(targetBoardId);
        const nodes = localData ? (localData.nodes || []) : [];

        set({
            currentBoardId: targetBoardId,
            nodes,
            selectedNodeIds: [],
            stagePosition: localData ? (localData.stagePosition || { x: 0, y: 0 }) : { x: 0, y: 0 },
            stageScale: localData ? (localData.stageScale || 1) : 1,
            history: [nodes.map(node => (node.points ? { ...node, points: [...node.points] } : { ...node }))],
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
    } catch (e) { /* ignore */ }
}

export { loadMediaFromDB, saveMediaToDB };
export default useStore;
