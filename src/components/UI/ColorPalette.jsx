import { useState } from 'react';

const STORAGE_KEY = 'kot_custom_colors';

// 64 preset colors: 8 rows × 8 columns
const PRESET_COLORS = [
    // Row 1 - Neutrals
    '#000000', '#1a1a1a', '#333333', '#555555', '#777777', '#999999', '#bbbbbb', '#ffffff',
    // Row 2 - Warm grays to browns
    '#2c1810', '#4a2c20', '#6b4433', '#8d6e63', '#a1887f', '#bcaaa4', '#d7ccc8', '#efebe9',
    // Row 3 - Reds
    '#b71c1c', '#c62828', '#d32f2f', '#e53935', '#ef5350', '#ef9a9a', '#ffcdd2', '#ffebee',
    // Row 4 - Oranges & Yellows
    '#e65100', '#f57c00', '#fb8c00', '#ff9800', '#ffa726', '#ffb74d', '#ffe0b2', '#fff3e0',
    // Row 5 - Greens
    '#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#66bb6a', '#81c784', '#a5d6a7', '#c8e6c9',
    // Row 6 - Blues
    '#0d47a1', '#1565c0', '#1976d2', '#1e88e5', '#42a5f5', '#64b5f6', '#90caf9', '#bbdefb',
    // Row 7 - Purples
    '#4a148c', '#6a1b9a', '#7b1fa2', '#8e24aa', '#ab47bc', '#ce93d8', '#e1bee7', '#f3e5f5',
    // Row 8 - Pinks & Special
    '#880e4f', '#ad1457', '#c2185b', '#e91e63', '#ec407a', '#f48fb1', '#f8bbd0', '#fce4ec',
];

function loadCustomColors() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
}

function saveCustomColors(colors) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
    } catch { /* ignore */ }
}

export default function ColorPalette({ selectedColor, onColorSelect, title = 'Color', showTransparent = false, showEyedropper = true }) {
    const [customColors, setCustomColors] = useState(loadCustomColors);
    const eyedropperSupported = typeof window !== 'undefined' && 'EyeDropper' in window;

    const addCustomColor = (color) => {
        const updated = [color, ...customColors.filter(c => c !== color)].slice(0, 10);
        setCustomColors(updated);
        saveCustomColors(updated);
    };

    const handleEyedropper = async () => {
        try {
            const eyeDropper = new window.EyeDropper();
            const result = await eyeDropper.open();
            onColorSelect(result.sRGBHex);
            addCustomColor(result.sRGBHex);
        } catch { /* user cancelled */ }
    };

    return (
        <div className="w-full">
            <div className="text-xs text-gray-500 mb-2">{title}</div>

            {/* Transparent option */}
            {showTransparent && (
                <button
                    onClick={() => onColorSelect('transparent')}
                    className={`w-6 h-6 rounded transition-transform hover:scale-110 border border-gray-300 relative overflow-hidden mb-2 ${selectedColor === 'transparent' ? 'ring-2 ring-purple-500 ring-offset-1' : ''}`}
                    title="No fill"
                >
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-px bg-red-400 rotate-45" />
                    </div>
                </button>
            )}

            {/* 8×8 Preset Grid */}
            <div className="grid grid-cols-8 gap-1 mb-3">
                {PRESET_COLORS.map(color => (
                    <button
                        key={color}
                        onClick={() => onColorSelect(color)}
                        className={`w-5 h-5 rounded-sm transition-transform hover:scale-125 ${selectedColor === color ? 'ring-2 ring-purple-500 ring-offset-1' : ''}`}
                        style={{
                            backgroundColor: color,
                            border: color === '#ffffff' ? '1px solid #e0e0e0' : 'none',
                        }}
                        title={color}
                    />
                ))}
            </div>

            {/* Custom Colors */}
            {customColors.length > 0 && (
                <>
                    <div className="text-xs text-gray-400 mb-1">Custom</div>
                    <div className="flex gap-1 mb-2 flex-wrap">
                        {customColors.map((color, i) => (
                            <button
                                key={`${color}-${i}`}
                                onClick={() => onColorSelect(color)}
                                className={`w-5 h-5 rounded-sm transition-transform hover:scale-125 ${selectedColor === color ? 'ring-2 ring-purple-500 ring-offset-1' : ''}`}
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Eyedropper + Custom input */}
            <div className="flex gap-1.5 items-center">
                {showEyedropper && eyedropperSupported && (
                    <button
                        onClick={handleEyedropper}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Pick color from screen"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m2 22 1-1h3l9-9" />
                            <path d="M3 21v-3l9-9" />
                            <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3L15 6" />
                        </svg>
                        Eyedropper
                    </button>
                )}
                <input
                    type="color"
                    value={selectedColor === 'transparent' ? '#000000' : selectedColor}
                    onChange={(e) => {
                        onColorSelect(e.target.value);
                        addCustomColor(e.target.value);
                    }}
                    className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                    title="Pick custom color"
                />
            </div>
        </div>
    );
}

export { PRESET_COLORS };
