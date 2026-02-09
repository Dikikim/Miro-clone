import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Debounce helper
let saveTimeout = null;
const debounceSave = (fn, delay = 2000) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(fn, delay);
};

const useStore = create((set, get) => ({
    // Canvas state
    nodes: [],
    selectedNodeIds: [],
    tool: 'select', // 'select', 'shape', 'text', 'image', 'youtube', 'pen', 'eraser'
    shapeType: 'rectangle', // 'rectangle', 'circle', 'triangle', 'star', 'arrow', 'diamond', 'hexagon'

    // Canvas view state
    stagePosition: { x: 0, y: 0 },
    stageScale: 1,

    // Tool colors
    fillColor: '#3b82f6',
    strokeColor: '#1e40af',
    strokeWidth: 2,
    textColor: '#000000',

    // Cloud sync state
    isSaving: false,
    isLoading: false,
    lastSaved: null,
    cloudError: null,
    hasUnsavedChanges: false,

    // Actions
    setTool: (tool) => set({ tool }),
    setShapeType: (shapeType) => set({ shapeType }),

    setFillColor: (color) => set({ fillColor: color }),
    setStrokeColor: (color) => set({ strokeColor: color }),
    setStrokeWidth: (width) => set({ strokeWidth: width }),
    setTextColor: (color) => set({ textColor: color }),

    addNode: (nodeData) => {
        const newNode = {
            id: uuidv4(),
            ...nodeData,
        };
        set((state) => ({ nodes: [...state.nodes, newNode], hasUnsavedChanges: true }));
        // Auto-save after adding node
        debounceSave(() => get().saveToCloud());
        return newNode.id;
    },

    updateNode: (id, updates) => {
        set((state) => ({
            nodes: state.nodes.map((node) =>
                node.id === id ? { ...node, ...updates } : node
            ),
            hasUnsavedChanges: true,
        }));
        // Auto-save after updating node
        debounceSave(() => get().saveToCloud());
    },

    deleteNode: (id) => {
        set((state) => ({
            nodes: state.nodes.filter((node) => node.id !== id),
            selectedNodeIds: state.selectedNodeIds.filter((nodeId) => nodeId !== id),
            hasUnsavedChanges: true,
        }));
        // Auto-save after deleting node
        debounceSave(() => get().saveToCloud());
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
        debounceSave(() => get().saveToCloud());
    },
    setStageScale: (scale) => {
        set({ stageScale: scale, hasUnsavedChanges: true });
        debounceSave(() => get().saveToCloud());
    },

    // Delete selected nodes
    deleteSelectedNodes: () => {
        set((state) => ({
            nodes: state.nodes.filter((node) => !state.selectedNodeIds.includes(node.id)),
            selectedNodeIds: [],
            hasUnsavedChanges: true,
        }));
        debounceSave(() => get().saveToCloud());
    },

    // Delete all nodes
    deleteAllNodes: () => {
        set({ nodes: [], selectedNodeIds: [], hasUnsavedChanges: true });
        debounceSave(() => get().saveToCloud());
    },

    // Cloud sync actions
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
                console.log('✓ Saved to cloud');
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            console.error('✗ Cloud save error:', error);
            set({ cloudError: 'Failed to save to cloud' });
        } finally {
            set({ isSaving: false });
        }
    },

    loadFromCloud: async () => {
        set({ isLoading: true, cloudError: null });

        try {
            const response = await fetch(`${API_URL}/load`);

            if (response.ok) {
                const data = await response.json();
                set({
                    nodes: data.nodes || [],
                    stagePosition: data.stagePosition || { x: 0, y: 0 },
                    stageScale: data.stageScale || 1,
                });
                console.log(`✓ Loaded ${data.nodes?.length || 0} nodes from cloud`);
            } else {
                throw new Error('Failed to load');
            }
        } catch (error) {
            console.error('✗ Cloud load error:', error);
            set({ cloudError: 'Failed to load from cloud' });
        } finally {
            set({ isLoading: false });
        }
    },
}));

export default useStore;
