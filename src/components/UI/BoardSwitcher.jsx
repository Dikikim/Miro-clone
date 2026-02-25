import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Pencil } from 'lucide-react';
import useStore from '../../store/useStore';

const BOARD_COLORS = [
    '#8b5cf6', // purple
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#ec4899', // pink
];

export default function BoardSwitcher() {
    const { currentBoardId, boardNames, switchBoard, renameBoard } = useStore();
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const dropdownRef = useRef(null);
    const editInputRef = useRef(null);

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

    const handleBoardClick = (id) => {
        if (editingId !== null) return; // Don't switch while editing
        switchBoard(id);
        setIsOpen(false);
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

    return (
        <div ref={dropdownRef} className="relative">
            {/* Trigger button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                style={{ minWidth: '120px' }}
            >
                <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: BOARD_COLORS[currentBoardId] }}
                />
                <span className="truncate max-w-[120px]">{boardNames[currentBoardId]}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div
                    className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-[100]"
                    style={{ width: '240px' }}
                >
                    {boardNames.map((name, id) => (
                        <div
                            key={id}
                            onClick={() => handleBoardClick(id)}
                            className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${id === currentBoardId
                                ? 'bg-purple-50'
                                : 'hover:bg-gray-50'
                                }`}
                        >
                            {/* Color dot */}
                            <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: BOARD_COLORS[id] }}
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
                                    className="flex-1 text-sm text-gray-900 bg-white border border-purple-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-purple-400"
                                    maxLength={30}
                                />
                            ) : (
                                <span className={`flex-1 text-sm truncate ${id === currentBoardId
                                    ? 'font-semibold text-purple-700'
                                    : name.startsWith('Board ')
                                        ? 'text-gray-400'
                                        : 'text-gray-700'
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

                            {/* Active checkmark */}
                            {id === currentBoardId && editingId !== id && (
                                <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />
                            )}
                        </div>
                    ))}

                    {/* Hint */}
                    <div className="border-t border-gray-100 mt-1.5 pt-2 pb-1 px-3">
                        <span className="text-[10px] text-gray-400">
                            Boards auto-save independently
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
