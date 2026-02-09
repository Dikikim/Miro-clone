import { Minus, Plus } from 'lucide-react';
import useStore from '../../store/useStore';

export default function BottomControls() {
    const { stageScale, setStageScale } = useStore();

    const zoomPercent = Math.round(stageScale * 100);

    const handleZoomIn = () => setStageScale(Math.min(5, stageScale * 1.2));
    const handleZoomOut = () => setStageScale(Math.max(0.1, stageScale / 1.2));
    const handleZoomReset = () => setStageScale(1);

    return (
        <>
            {/* Bottom Right - Zoom (like Miro) */}
            <div className="fixed bottom-3 right-3 z-40">
                <div className="flex items-center bg-white rounded-lg shadow-lg border border-gray-200" style={{ gap: '0', padding: '0' }}>
                    <button
                        onClick={handleZoomReset}
                        className="font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors text-center"
                        style={{
                            padding: 'clamp(4px, 0.4vw, 10px) clamp(6px, 0.6vw, 14px)',
                            fontSize: 'clamp(10px, 0.8vw + 0.3vh, 14px)',
                            minWidth: 'clamp(36px, 3vw, 52px)'
                        }}
                    >
                        {zoomPercent}%
                    </button>
                </div>
            </div>
        </>
    );
}
