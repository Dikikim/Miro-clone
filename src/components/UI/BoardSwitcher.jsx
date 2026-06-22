import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Pencil, Plus, Trash2, Search } from 'lucide-react';
import useStore from '../../store/useStore';
import ConfirmModal from './ConfirmModal';

const BOARD_COLORS = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899',
    '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#e11d48',
];

export default function BoardSwitcher() {
    const { currentBoardId, boards, switchBoard, renameBoard, addBoard, deleteBoard, boardSearch, setBoardSearch, theme } = useStore();
    const isDark = theme === 'dark';
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [panelRect, setPanelRect] = useState(null);
    const dropdownRef = useRef(null);
    const menuRef = useRef(null);          // the portaled dropdown panel
    const editInputRef = useRef(null);
    const searchInputRef = useRef(null);

    // Match the dropdown to the header panel's width/left edge so it lines up
    // evenly with the header instead of being a fixed 260px.
    const measurePanel = useCallback(() => {
        const el = document.querySelector('[data-header-panel]');
        if (el) setPanelRect(el.getBoundingClientRect());
    }, []);
    useEffect(() => {
        if (!isOpen) return;
        measurePanel();
        window.addEventListener('resize', measurePanel);
        return () => window.removeEventListener('resize', measurePanel);
    }, [isOpen, measurePanel]);

    const boardName = (id) => boards.find(b => b.id === id)?.name || '';
    const currentIdx = Math.max(0, boards.findIndex(b => b.id === currentBoardId));

    const handleRenameSubmit = useCallback((id) => {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== boardName(id)) {
            renameBoard(id, trimmed);
        }
        setEditingId(null);
    }, [editValue, boards, renameBoard]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            const inTrigger = dropdownRef.current?.contains(e.target);
            const inMenu = menuRef.current?.contains(e.target);   // portaled to <body>
            if (!inTrigger && !inMenu) {
                setIsOpen(false);
                if (editingId !== null) handleRenameSubmit(editingId);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [editingId, handleRenameSubmit]);

    // Focus input when editing
    useEffect(() => {
        if (editingId !== null && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    // Focus search when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleBoardClick = (id) => {
        if (editingId !== null) return;
        switchBoard(id);
        setIsOpen(false);
        setBoardSearch('');
    };

    const startEditing = (id, e) => {
        e.stopPropagation();
        setEditingId(id);
        setEditValue(boardName(id));
    };

    const handleAddBoard = async () => {
        const newId = await addBoard();
        if (newId) {
            switchBoard(newId);
        }
    };

    const filteredBoards = boards
        .map((b, idx) => ({ name: b.name, id: b.id, idx }))
        .filter(b => !boardSearch || b.name.toLowerCase().includes(boardSearch.toLowerCase()));

    return (
        <div ref={dropdownRef} className="relative">
            {/* Trigger button */}
            <button
                onClick={() => { if (!isOpen) measurePanel(); setIsOpen(!isOpen); setBoardSearch(''); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shadow-sm ${isDark ? 'glass-chip-dark text-gray-200' : 'glass-chip text-gray-700'}`}
                style={{ minWidth: '120px' }}
            >
                <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: BOARD_COLORS[currentIdx % BOARD_COLORS.length] }}
                />
                <span className="flex-1 text-left truncate max-w-[120px]">{boardName(currentBoardId)}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown — portaled to <body> so it escapes the header's
                pointer-events-none subtree and stacking context. */}
            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    className={`fixed rounded-xl py-1.5 z-[1000] menu-accent-edge ${isDark ? 'popup-solid-dark' : 'popup-solid'}`}
                    style={{
                        top: panelRect ? panelRect.bottom + 8 : 60,
                        left: panelRect ? panelRect.left : undefined,
                        right: panelRect ? undefined : 16,
                        width: panelRect ? panelRect.width : 260,
                    }}
                >
                    {/* Search */}
                    <div className="px-2 pb-1.5">
                        <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <input
                                ref={searchInputRef}
                                value={boardSearch}
                                onChange={(e) => setBoardSearch(e.target.value)}
                                placeholder="Search boards..."
                                className={`text-sm outline-none bg-transparent flex-1 ${isDark ? 'text-gray-200 placeholder-gray-500' : 'text-gray-700 placeholder-gray-400'}`}
                            />
                        </div>
                    </div>

                    {/* Board list - scrollable */}
                    <div style={{ maxHeight: '280px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                        {filteredBoards.map(({ name, id, idx }) => (
                            <div
                                key={id}
                                onClick={() => handleBoardClick(id)}
                                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${id === currentBoardId
                                    ? (isDark ? 'bg-purple-900/30' : 'bg-purple-50')
                                    : (isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50')
                                    }`}
                            >
                                {/* Color dot */}
                                <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: BOARD_COLORS[idx % BOARD_COLORS.length] }}
                                />

                                {/* Name or edit input */}
                                {editingId === id ? (
                                    <input
                                        ref={editInputRef}
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={() => handleRenameSubmit(id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameSubmit(id);
                                            if (e.key === 'Escape') setEditingId(null);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`flex-1 text-sm border border-purple-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-purple-400 ${isDark ? 'bg-gray-700 text-white border-purple-500' : 'bg-white text-gray-900'}`}
                                        maxLength={30}
                                    />
                                ) : (
                                    <span className={`flex-1 text-sm truncate ${id === currentBoardId
                                        ? (isDark ? 'font-semibold text-purple-300' : 'font-semibold text-purple-700')
                                        : name.startsWith('Board ')
                                            ? (isDark ? 'text-gray-500' : 'text-gray-400')
                                            : (isDark ? 'text-gray-300' : 'text-gray-700')
                                        }`}>
                                        {name}
                                    </span>
                                )}

                                {/* Rename pencil button */}
                                {editingId !== id && (
                                    <button
                                        onClick={(e) => startEditing(id, e)}
                                        className="p-0.5 text-gray-300 hover:text-purple-500 transition-colors"
                                        title="Rename board"
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                )}

                                {/* Delete button - only if more than 1 board */}
                                {boards.length > 1 && editingId !== id && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(id); }}
                                        className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                                        title="Delete board"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                )}

                                {/* Active checkmark */}
                                {id === currentBoardId && editingId !== id && (
                                    <Check className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add Board button */}
                    <div className={`border-t mt-1 pt-1 px-2 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                        <button
                            onClick={handleAddBoard}
                            disabled={boards.length >= 100}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${boards.length >= 100
                                ? 'text-gray-400 cursor-not-allowed'
                                : isDark
                                    ? 'text-purple-400 hover:bg-gray-700'
                                    : 'text-purple-600 hover:bg-purple-50'
                                }`}
                        >
                            <Plus className="w-4 h-4" />
                            Add Board ({boards.length}/100)
                        </button>
                    </div>

                    {/* Hint */}
                    <div className={`border-t mt-1 pt-2 pb-1 px-3 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Boards auto-save independently
                        </span>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={confirmDeleteId !== null}
                message={`Delete "${boardName(confirmDeleteId)}"? This cannot be undone.`}
                onConfirm={() => {
                    deleteBoard(confirmDeleteId);
                    setConfirmDeleteId(null);
                }}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </div>
    );
}
