import {
    MousePointer2, Square, Type, Image, Youtube, Pencil, Trash2, Eraser, FileText, ChevronRight,
    Circle, Triangle, Star, Diamond, Hexagon, Minus, ArrowRight, Pentagon, Octagon, Heart, Cloud, RectangleHorizontal, Plus,
    Undo2, Redo2, FolderOpen, Music, Video
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import useStore from '../../store/useStore';
import { cn } from '../../lib/utils';
import ConfirmModal from './ConfirmModal';

const shapeOptions = [
    { id: 'rectangle', Icon: Square, label: 'Rectangle' },
    { id: 'roundedRect', Icon: RectangleHorizontal, label: 'Rounded Rectangle' },
    { id: 'circle', Icon: Circle, label: 'Circle' },
    { id: 'ellipse', Icon: Circle, label: 'Ellipse' },
    { id: 'triangle', Icon: Triangle, label: 'Triangle' },
    { id: 'star', Icon: Star, label: 'Star' },
    { id: 'diamond', Icon: Diamond, label: 'Diamond' },
    { id: 'pentagon', Icon: Pentagon, label: 'Pentagon' },
    { id: 'hexagon', Icon: Hexagon, label: 'Hexagon' },
    { id: 'octagon', Icon: Octagon, label: 'Octagon' },
    { id: 'heart', Icon: Heart, label: 'Heart' },
    { id: 'cloud', Icon: Cloud, label: 'Cloud' },
    { id: 'cross', Icon: Plus, label: 'Cross/Plus' },
];

const lineOptions = [
    { id: 'arrow', Icon: ArrowRight, label: 'Arrow' },
    { id: 'line', Icon: Minus, label: 'Line' },
];

const penColors = [
    '#000000', '#374151', '#6b7280', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
];

const mediaOptions = [
    { id: 'image', Icon: Image, label: 'Image' },
    { id: 'pdf', Icon: FileText, label: 'PDF' },
    { id: 'audio', Icon: Music, label: 'Audio' },
    { id: 'video', Icon: Video, label: 'Video' },
];

export default function Toolbar() {
    const {
        tool, setTool, shapeType, setShapeType,
        strokeColor, setStrokeColor, strokeWidth, setStrokeWidth,
        textColor, setTextColor,
        nodes, selectedNodeIds, deleteAllNodes, deleteSelectedNodes,
        isSaving, isLoading, lastSaved,
        undo, redo, canUndo, canRedo,
    } = useStore();

    const [activePopup, setActivePopup] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const popupRef = useRef(null);

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                setActivePopup(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToolClick = (toolName, hasPopup = false) => {
        if (hasPopup) {
            if (activePopup === toolName) {
                setActivePopup(null);
            } else {
                setActivePopup(toolName);
                setTool(toolName);
            }
        } else {
            setTool(toolName);
            setActivePopup(null);
        }
    };

    const handleShapeSelect = (shapeId) => {
        setShapeType(shapeId);
        setTool('shape');
        setActivePopup(null);
    };

    const ToolButton = ({ toolName, icon: Icon, label, hasPopup, isActive }) => (
        <button
            onClick={() => handleToolClick(toolName, hasPopup)}
            className={cn(
                "flex items-center justify-center rounded-lg transition-all relative group",
                (isActive || tool === toolName)
                    ? "bg-purple-100 text-purple-600"
                    : "text-gray-600 hover:bg-gray-100"
            )}
            style={{
                width: 'clamp(28px, 2.5vw + 1vh, 42px)',
                height: 'clamp(28px, 2.5vw + 1vh, 42px)',
            }}
            title={label}
        >
            <Icon style={{ width: 'clamp(14px, 1.2vw + 0.5vh, 22px)', height: 'clamp(14px, 1.2vw + 0.5vh, 22px)' }} />
            {hasPopup && (
                <ChevronRight className="absolute opacity-50" style={{ width: 'clamp(6px, 0.5vw, 10px)', height: 'clamp(6px, 0.5vw, 10px)', right: '2px', bottom: '2px' }} />
            )}
        </button>
    );

    return (
        <div className="fixed left-0 top-0 bottom-0 z-40 flex items-center" ref={popupRef}>
            <div className="bg-white rounded-r-xl shadow-lg border border-l-0 border-gray-200 flex flex-col my-2 ml-0" style={{ padding: 'clamp(2px, 0.3vw, 6px)', gap: 'clamp(1px, 0.15vw, 3px)', maxHeight: 'calc(100vh - 16px)', overflowY: 'auto', overflowX: 'visible', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {/* Select */}
                <ToolButton toolName="select" icon={MousePointer2} label="Select (V)" />

                <div className="h-px bg-gray-200 my-1" />

                {/* Shape Tool */}
                <ToolButton toolName="shape" icon={Square} label="Shapes (S)" hasPopup isActive={tool === 'shape'} />

                {/* Text Tool */}
                <ToolButton toolName="text" icon={Type} label="Text (T)" />

                {/* Pen Tool */}
                <ToolButton toolName="pen" icon={Pencil} label="Pen (P)" hasPopup isActive={tool === 'pen'} />

                {/* Eraser */}
                <ToolButton toolName="eraser" icon={Eraser} label="Eraser (E)" />

                <div className="h-px bg-gray-200 my-1" />

                {/* Media Upload Tool with Popup */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setActivePopup(activePopup === 'media' ? null : 'media');
                    }}
                    className={cn(
                        "flex items-center justify-center rounded-lg transition-all relative group",
                        activePopup === 'media'
                            ? "bg-purple-100 text-purple-600"
                            : "text-gray-600 hover:bg-gray-100"
                    )}
                    style={{
                        width: 'clamp(28px, 2.5vw + 1vh, 42px)',
                        height: 'clamp(28px, 2.5vw + 1vh, 42px)',
                    }}
                    title="Add Media"
                >
                    <FolderOpen style={{ width: 'clamp(14px, 1.2vw + 0.5vh, 22px)', height: 'clamp(14px, 1.2vw + 0.5vh, 22px)' }} />
                    <ChevronRight className="absolute opacity-50" style={{ width: 'clamp(6px, 0.5vw, 10px)', height: 'clamp(6px, 0.5vw, 10px)', right: '2px', bottom: '2px' }} />
                </button>

                {/* YouTube */}
                <ToolButton toolName="youtube" icon={Youtube} label="YouTube (Y)" />

                <div className="h-px bg-gray-200 my-1" />

                {/* Delete */}
                <button
                    onClick={() => {
                        if (selectedNodeIds.length > 0) {
                            deleteSelectedNodes();
                        } else if (nodes.length > 0) {
                            setShowConfirm(true);
                        }
                    }}
                    disabled={nodes.length === 0}
                    className={cn(
                        "flex items-center justify-center rounded-lg transition-colors",
                        nodes.length > 0
                            ? "text-red-500 hover:bg-red-50"
                            : "text-gray-300 cursor-not-allowed"
                    )}
                    style={{
                        width: 'clamp(28px, 2.5vw + 1vh, 42px)',
                        height: 'clamp(28px, 2.5vw + 1vh, 42px)',
                    }}
                    title={selectedNodeIds.length > 0 ? `Delete Selected (${selectedNodeIds.length})` : "Clear All"}
                >
                    <Trash2 style={{ width: 'clamp(14px, 1.2vw + 0.5vh, 22px)', height: 'clamp(14px, 1.2vw + 0.5vh, 22px)' }} />
                </button>

                <div className="h-px bg-gray-200 my-1" />

                {/* Undo/Redo */}
                <button
                    onClick={() => undo()}
                    disabled={!canUndo()}
                    className={cn(
                        "flex items-center justify-center rounded-lg transition-colors",
                        canUndo()
                            ? "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                            : "text-gray-300 cursor-not-allowed"
                    )}
                    style={{
                        width: 'clamp(28px, 2.5vw + 1vh, 42px)',
                        height: 'clamp(28px, 2.5vw + 1vh, 42px)',
                    }}
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 style={{ width: 'clamp(14px, 1.2vw + 0.5vh, 22px)', height: 'clamp(14px, 1.2vw + 0.5vh, 22px)' }} />
                </button>
                <button
                    onClick={() => redo()}
                    disabled={!canRedo()}
                    className={cn(
                        "flex items-center justify-center rounded-lg transition-colors",
                        canRedo()
                            ? "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                            : "text-gray-300 cursor-not-allowed"
                    )}
                    style={{
                        width: 'clamp(28px, 2.5vw + 1vh, 42px)',
                        height: 'clamp(28px, 2.5vw + 1vh, 42px)',
                    }}
                    title="Redo (Ctrl+Y)"
                >
                    <Redo2 style={{ width: 'clamp(14px, 1.2vw + 0.5vh, 22px)', height: 'clamp(14px, 1.2vw + 0.5vh, 22px)' }} />
                </button>

                <div className="h-px bg-gray-200 my-1" />

                {/* Cloud Sync Status Indicator */}
                <div
                    className="flex items-center justify-center rounded-lg"
                    style={{
                        width: 'clamp(28px, 2.5vw + 1vh, 42px)',
                        height: 'clamp(28px, 2.5vw + 1vh, 42px)',
                    }}
                    title={
                        isLoading ? "Loading..." :
                            isSaving ? "Saving..." :
                                lastSaved ? "Saved to cloud" : "Local"
                    }
                >
                    {isLoading ? (
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
                    ) : isSaving ? (
                        <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full animate-pulse" />
                    ) : lastSaved ? (
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                    ) : (
                        <div className="w-2.5 h-2.5 bg-gray-400 rounded-full" />
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={showConfirm}
                message="Are you sure you want to delete all items?"
                onConfirm={() => {
                    deleteAllNodes();
                    setShowConfirm(false);
                }}
                onCancel={() => setShowConfirm(false)}
            />

            {/* Media Popup - positioned outside scrollable container */}
            {activePopup === 'media' && (
                <div
                    className="fixed bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-44 z-50"
                    style={{ left: 'clamp(50px, 4vw + 2vh, 70px)', top: '50%', transform: 'translateY(-50%)' }}
                >
                    <div className="text-xs text-gray-500 mb-2">Add Media</div>
                    <div className="flex flex-col gap-1">
                        {mediaOptions.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => {
                                    setTool(opt.id);
                                    setActivePopup(null);
                                }}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors text-sm"
                            >
                                <opt.Icon className="w-4 h-4" />
                                <span>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Shape Popup - positioned outside scrollable container */}
            {activePopup === 'shape' && (
                <div
                    className="fixed bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-52 z-50"
                    style={{ left: 'clamp(50px, 4vw + 2vh, 70px)', top: '120px' }}
                >
                    {/* Shapes Grid */}
                    <div className="text-xs text-gray-500 mb-2">Shapes</div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {shapeOptions.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => handleShapeSelect(opt.id)}
                                className={cn(
                                    "w-10 h-10 flex items-center justify-center rounded-lg transition-all border-2",
                                    shapeType === opt.id
                                        ? "bg-purple-100 text-purple-600 border-purple-400"
                                        : "hover:bg-gray-100 border-transparent text-gray-700"
                                )}
                                title={opt.label}
                            >
                                <opt.Icon className="w-6 h-6" />
                            </button>
                        ))}
                    </div>

                    {/* Lines */}
                    <div className="text-xs text-gray-500 mb-2">Lines</div>
                    <div className="grid grid-cols-4 gap-2">
                        {lineOptions.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => handleShapeSelect(opt.id)}
                                className={cn(
                                    "w-10 h-10 flex items-center justify-center rounded-lg transition-all border-2",
                                    shapeType === opt.id
                                        ? "bg-purple-100 text-purple-600 border-purple-400"
                                        : "hover:bg-gray-100 border-transparent text-gray-700"
                                )}
                                title={opt.label}
                            >
                                <opt.Icon className="w-6 h-6" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Pen Popup - positioned outside scrollable container */}
            {activePopup === 'pen' && (
                <div
                    className="fixed bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-48 z-50"
                    style={{ left: 'clamp(50px, 4vw + 2vh, 70px)', top: '180px' }}
                >
                    {/* Stroke Width */}
                    <div className="mb-3">
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={strokeWidth}
                            onChange={(e) => setStrokeWidth(Number(e.target.value))}
                            className="w-full h-1.5 accent-purple-500"
                        />
                        <div className="text-xs text-gray-500 mt-1">Stroke width: {strokeWidth}px</div>
                    </div>

                    {/* All Colors */}
                    <div className="text-xs text-gray-500 mb-2">Colors</div>
                    <div className="grid grid-cols-6 gap-1.5">
                        {penColors.map(color => (
                            <button
                                key={color}
                                onClick={() => setStrokeColor(color)}
                                className={cn(
                                    "w-6 h-6 rounded-full transition-transform hover:scale-110",
                                    strokeColor === color ? "ring-2 ring-purple-500 ring-offset-1" : ""
                                )}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}
