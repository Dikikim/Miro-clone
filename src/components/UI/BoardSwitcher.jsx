import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Pencil, Plus, Trash2, Search } from 'lucide-react';
import useStore from '../../store/useStore';
import ConfirmModal from './ConfirmModal';

const BOARD_COLORS = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899',
    '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#e11d48',
];

export default function BoardSwitcher() {
    const { currentBoardId, boardNames, switchBoard, renameBoard, addBoard, deleteBoard, boardSearch, setBoardSearch, theme } = useStore();
    const isDark = theme === 'dark';
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const dropdownRef = useRef(null);
    const editInputRef = useRef(null);
    const searchInputRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
                if (editingId !== null) handleRenameSubmit(editingId);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [editingId, editValue]);

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
        setEditValue(boardNames[id]);
    };

    const handleRenameSubmit = (id) => {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== boardNames[id]) {
            renameBoard(id, trimmed);
        }
        setEditingId(null);
    };

    const handleAddBoard = () => {
        const newId = addBoard();
        if (newId !== null) {
            switchBoard(newId);
        }
    };

    const filteredBoards = boardNames
        .map((name, id) => ({ name, id }))
        .filter(b => !boardSearch || b.name.toLowerCase().includes(boardSearch.toLowerCase()));

    return (
        <div ref={dropdownRef} className="relative">
            {/* Trigger button */}
            <button
                onClick={() => { setIsOpen(!isOpen); setBoardSearch(''); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors shadow-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                style={{ minWidth: '120px' }}
            >
                <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: BOARD_COLORS[currentBoardId % BOARD_COLORS.length] }}
                />
                <span className="truncate max-w-[120px]">{boardNames[currentBoardId]}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div
                    className={`absolute right-0 top-full mt-2 rounded-xl shadow-xl border py-1.5 z-[100] ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                    style={{ width: '260px' }}
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
                        {filteredBoards.map(({ name, id }) => (
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
                                    style={{ backgroundColor: BOARD_COLORS[id % BOARD_COLORS.length] }}
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
                                        ? 'font-semibold text-purple-700'
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
                                {boardNames.length > 1 && editingId !== id && (
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
                                    <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add Board button */}
                    <div className={`border-t mt-1 pt-1 px-2 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                        <button
                            onClick={handleAddBoard}
                            disabled={boardNames.length >= 100}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${boardNames.length >= 100
                                ? 'text-gray-400 cursor-not-allowed'
                                : isDark
                                    ? 'text-purple-400 hover:bg-gray-700'
                                    : 'text-purple-600 hover:bg-purple-50'
                                }`}
                        >
                            <Plus className="w-4 h-4" />
                            Add Board ({boardNames.length}/100)
                        </button>
                    </div>

                    {/* Hint */}
                    <div className={`border-t mt-1 pt-2 pb-1 px-3 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Boards auto-save independently
                        </span>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={confirmDeleteId !== null}
                message={`Delete "${boardNames[confirmDeleteId] || ''}"? This cannot be undone.`}
                onConfirm={() => {
                    deleteBoard(confirmDeleteId);
                    setConfirmDeleteId(null);
                }}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </div>
    );
}
