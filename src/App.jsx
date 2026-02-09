import Whiteboard from './components/Canvas/Whiteboard';
import Toolbar from './components/UI/Toolbar';
import BottomControls from './components/UI/BottomControls';
import ImageUploader from './components/Upload/ImageUploader';
import YoutubeEmbed from './components/Upload/YoutubeEmbed';
import YoutubePlayer from './components/Upload/YoutubePlayer';
import PdfUploader from './components/Upload/PdfUploader';
import AudioUploader from './components/Upload/AudioUploader';
import VideoUploader from './components/Upload/VideoUploader';
import AudioPlayer from './components/Upload/AudioPlayer';
import VideoPlayer from './components/Upload/VideoPlayer';
import { useEffect, useState, useCallback } from 'react';
import useStore from './store/useStore';

function App() {
  const {
    tool, setTool, deleteSelectedNodes, selectedNodeIds, clearSelection,
    loadFromCloud, isSaving, lastSaved, isLoading
  } = useStore();
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [showYoutubeEmbed, setShowYoutubeEmbed] = useState(false);
  const [showPdfUploader, setShowPdfUploader] = useState(false);
  const [showAudioUploader, setShowAudioUploader] = useState(false);
  const [showVideoUploader, setShowVideoUploader] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);

  // Load from cloud on startup
  useEffect(() => {
    loadFromCloud();
  }, [loadFromCloud]);

  // Expose functions globally for Whiteboard to trigger playback
  useEffect(() => {
    window.playYoutubeVideo = (videoId) => setPlayingVideoId(videoId);
    window.playAudioFile = (src, fileName) => setPlayingAudio({ src, fileName });
    window.playVideoFile = (src, fileName) => setPlayingVideo({ src, fileName });
    return () => {
      delete window.playYoutubeVideo;
      delete window.playAudioFile;
      delete window.playVideoFile;
    };
  }, []);

  // Warn on close if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (useStore.getState().hasUnsavedChanges || useStore.getState().isSaving) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (tool === 'image') { setShowImageUploader(true); setTool('select'); }
    else if (tool === 'youtube') { setShowYoutubeEmbed(true); setTool('select'); }
    else if (tool === 'pdf') { setShowPdfUploader(true); setTool('select'); }
    else if (tool === 'audio') { setShowAudioUploader(true); setTool('select'); }
    else if (tool === 'video') { setShowVideoUploader(true); setTool('select'); }
  }, [tool, setTool]);

  const handleDelete = useCallback(() => {
    if (selectedNodeIds.length > 0) deleteSelectedNodes();
  }, [selectedNodeIds, deleteSelectedNodes]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
        return;
      }

      if (e.key === 'Escape') {
        clearSelection();
        setShowImageUploader(false);
        setShowYoutubeEmbed(false);
        setShowPdfUploader(false);
        setShowAudioUploader(false);
        setShowVideoUploader(false);
        setPlayingVideoId(null);
        setPlayingAudio(null);
        setPlayingVideo(null);
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'v') setTool('select');
      else if (key === 's') setTool('shape');
      else if (key === 't') setTool('text');
      else if (key === 'i') setShowImageUploader(true);
      else if (key === 'y') setShowYoutubeEmbed(true);
      else if (key === 'p') setTool('pen');
      else if (key === 'e') setTool('eraser');
      else if (key === 'f') setShowPdfUploader(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, handleDelete, clearSelection]);

  return (
    <div className="w-full h-full relative light" style={{ backgroundColor: '#f5f6f8' }}>
      {/* Canvas */}
      <Whiteboard />

      {/* UI Chrome */}
      <Toolbar />
      <BottomControls />

      {/* Modals */}
      {showImageUploader && <ImageUploader onClose={() => setShowImageUploader(false)} />}
      {showYoutubeEmbed && <YoutubeEmbed onClose={() => setShowYoutubeEmbed(false)} />}
      {showPdfUploader && <PdfUploader onClose={() => setShowPdfUploader(false)} />}
      {showAudioUploader && <AudioUploader onClose={() => setShowAudioUploader(false)} />}
      {showVideoUploader && <VideoUploader onClose={() => setShowVideoUploader(false)} />}

      {/* Players */}
      {playingVideoId && <YoutubePlayer videoId={playingVideoId} onClose={() => setPlayingVideoId(null)} />}
      {playingAudio && <AudioPlayer src={playingAudio.src} fileName={playingAudio.fileName} onClose={() => setPlayingAudio(null)} />}
      {playingVideo && <VideoPlayer src={playingVideo.src} fileName={playingVideo.fileName} onClose={() => setPlayingVideo(null)} />}

    </div>
  );
}

export default App;
