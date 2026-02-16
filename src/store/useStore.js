import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const API_URL = import.meta.env.VITE_API_URL || '';  // Empty = local-only, no cloud sync
const LOCAL_STORAGE_KEY = 'miro_clone_state';
const MAX_HISTORY = 50;

// Debounce helper
let saveTimeout = null;
const debounceSave = (fn, delay = 2000) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(fn, delay);
};

// --- IndexedDB helpers for large media data ---
const MEDIA_DB_NAME = 'miro_clone_media';
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

const saveToLocalStorage = async (state) => {
    try {
        // Separate large media src data into IndexedDB
        const nodesForStorage = await Promise.all(state.nodes.map(async (node) => {
            if (node.src && node.src.length > LARGE_SRC_THRESHOLD) {
                await saveMediaToDB(node.id, node.src);
                return { ...node, src: `__idb__${node.id}` };
            }
            return node;
        }));

        const data = {
            nodes: nodesForStorage,
            stagePosition: state.stagePosition,
            stageScale: state.stageScale,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        console.log('✓ Saved to localStorage');
    } catch (e) {
        console.error('✗ localStorage save error:', e);
    }
};

const loadFromLocalStorage = async () => {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            // Rehydrate large media sources from IndexedDB
            if (data.nodes) {
                data.nodes = await Promise.all(data.nodes.map(async (node) => {
                    if (node.src && typeof node.src === 'string' && node.src.startsWith('__idb__')) {
                        const nodeId = node.src.replace('__idb__', '');
                        const src = await loadMediaFromDB(nodeId);
                        return { ...node, src: src || '' };
                    }
                    return node;
                }));
            }
            console.log(`✓ Loaded ${data.nodes?.length || 0} nodes from localStorage`);
            return data;
        }
    } catch (e) {
        console.error('✗ localStorage load error:', e);
    }
    return null;
};

const useStore = create((set, get) => ({
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

    // Undo/Redo history
    history: [],
    historyIndex: -1,

    // Cloud sync state
    isSaving: false,
    isLoading: false,
    lastSaved: null,
    cloudError: null,
    hasUnsavedChanges: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

    // --- Computed helpers ---
    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    // --- History management ---
    pushToHistory: () => {
        const { nodes, history, historyIndex } = get();
        // Deep clone current nodes
        const snapshot = JSON.parse(JSON.stringify(nodes));
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
        const snapshot = JSON.parse(JSON.stringify(history[newIndex]));
        set({ nodes: snapshot, historyIndex: newIndex, selectedNodeIds: [], hasUnsavedChanges: true });
        debounceSave(() => get().syncSave());
    },

    redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;
        const newIndex = historyIndex + 1;
        const snapshot = JSON.parse(JSON.stringify(history[newIndex]));
        set({ nodes: snapshot, historyIndex: newIndex, selectedNodeIds: [], hasUnsavedChanges: true });
        debounceSave(() => get().syncSave());
    },

    // --- Actions ---
    setTool: (tool) => set({ tool }),
    setShapeType: (shapeType) => set({ shapeType }),

    setFillColor: (color) => set({ fillColor: color }),
    setStrokeColor: (color) => set({ strokeColor: color }),
    setStrokeWidth: (width) => set({ strokeWidth: width }),
    setTextColor: (color) => set({ textColor: color }),

    addNode: (nodeData) => {
        get().pushToHistory();
        const newNode = { id: uuidv4(), ...nodeData };
        set((state) => ({ nodes: [...state.nodes, newNode], hasUnsavedChanges: true }));
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
        debounceSave(() => get().syncSave());
    },

    deleteNode: (id) => {
        get().pushToHistory();
        set((state) => ({
            nodes: state.nodes.filter((node) => node.id !== id),
            selectedNodeIds: state.selectedNodeIds.filter((nodeId) => nodeId !== id),
            hasUnsavedChanges: true,
        }));
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
        debounceSave(() => get().syncSave());
    },

    deleteAllNodes: () => {
        get().pushToHistory();
        set({ nodes: [], selectedNodeIds: [], hasUnsavedChanges: true });
        debounceSave(() => get().syncSave());
    },

    // --- Online/Offline ---
    setOnline: (online) => set({ isOnline: online }),

    // --- Unified save: always localStorage, optionally cloud ---
    syncSave: async () => {
        const state = get();
        // Always save to localStorage + IndexedDB on PC
        await saveToLocalStorage(state);
        set({ hasUnsavedChanges: false, lastSaved: new Date().toISOString() });

        // Only attempt cloud if API_URL is explicitly configured
        if (API_URL && state.isOnline) {
            await get().saveToCloud();
        }
    },

    saveToCloud: async () => {
        const state = get();
        if (state.isSaving) return;

        set({ isSaving: true, cloudError: null });

        try {
            const response = await fetch(`${API_URL}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodes: state.nodes,
                    stagePosition: state.stagePosition,
                    stageScale: state.stageScale,
                }),
            });

            if (response.ok) {
                set({ lastSaved: new Date().toISOString(), hasUnsavedChanges: false });
                console.log('✓ Saved to cloud (Google Drive)');
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            console.error('✗ Cloud save error:', error);
            set({ cloudError: 'Failed to save to cloud' });
            // Still mark as saved since localStorage has the data
            set({ hasUnsavedChanges: false, lastSaved: new Date().toISOString() });
        } finally {
            set({ isSaving: false });
        }
    },

    loadFromCloud: async () => {
        set({ isLoading: true, cloudError: null });

        // Only try cloud if API_URL is explicitly configured and online
        if (API_URL && get().isOnline) {
            try {
                const response = await fetch(`${API_URL}/load`);
                if (response.ok) {
                    const data = await response.json();
                    const nodes = data.nodes || [];
                    set({
                        nodes,
                        stagePosition: data.stagePosition || { x: 0, y: 0 },
                        stageScale: data.stageScale || 1,
                        history: [JSON.parse(JSON.stringify(nodes))],
                        historyIndex: 0,
                    });
                    await saveToLocalStorage(get());
                    console.log(`✓ Loaded ${nodes.length} nodes from cloud`);
                    set({ isLoading: false });
                    return;
                }
            } catch (error) {
                console.warn('✗ Cloud load failed, falling back to localStorage:', error);
            }
        }

        // Fallback: load from localStorage
        const localData = await loadFromLocalStorage();
        if (localData) {
            const nodes = localData.nodes || [];
            set({
                nodes,
                stagePosition: localData.stagePosition || { x: 0, y: 0 },
                stageScale: localData.stageScale || 1,
                history: [JSON.parse(JSON.stringify(nodes))],
                historyIndex: 0,
            });
        } else {
            // Nothing saved anywhere — start fresh
            set({ history: [[]], historyIndex: 0 });
        }
        set({ isLoading: false });
    },
}));

export default useStore;
