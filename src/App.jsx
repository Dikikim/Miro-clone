import Whiteboard from './components/Canvas/Whiteboard';
import Header from './components/UI/Header';
import Toolbar from './components/UI/Toolbar';
import BottomControls from './components/UI/BottomControls';
import ContextMenu from './components/UI/ContextMenu';
import CommentOverlay from './components/UI/CommentOverlay';
import ImageUploader from './components/Upload/ImageUploader';
import YoutubeEmbed from './components/Upload/YoutubeEmbed';

import PdfUploader from './components/Upload/PdfUploader';
import AudioUploader from './components/Upload/AudioUploader';
import VideoUploader from './components/Upload/VideoUploader';

import { useEffect, useState, useCallback } from 'react';
import useStore from './store/useStore';

function App() {
  const {
    tool, setTool, deleteSelectedNodes, selectedNodeIds, clearSelection,
    loadData, addNode,
    undo, redo,
    theme,
    copySelectedNodes, pasteNodes, cutSelectedNodes,
  } = useStore();
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [showYoutubeEmbed, setShowYoutubeEmbed] = useState(false);
  const [showPdfUploader, setShowPdfUploader] = useState(false);
  const [showAudioUploader, setShowAudioUploader] = useState(false);
  const [showVideoUploader, setShowVideoUploader] = useState(false);



  // Load data on startup
  useEffect(() => {
    loadData();
  }, [loadData]);



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

  // External drag-and-drop from OS
  useEffect(() => {
    const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    const handleDrop = (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      const { stagePosition, stageScale } = useStore.getState();
      const baseX = (e.clientX - stagePosition.x) / stageScale;
      const baseY = (e.clientY - stagePosition.y) / stageScale;

      files.forEach((file, idx) => {
        const x = baseX + idx * 30;
        const y = baseY + idx * 30;
        const ext = file.name.split('.').pop()?.toLowerCase();

        // PDFs must be handled with arrayBuffer, not FileReader
        if (file.type === 'application/pdf' || ext === 'pdf') {
          import('./utils/pdfHelpers').then(async ({ loadPdfJs, bytesToBase64 }) => {
            const { saveMediaToDB } = await import('./store/useStore');
            const { v4: uuidv4 } = await import('uuid');
            try {
              const arrayBuffer = await file.arrayBuffer();
              const pdfBytesCopy = new Uint8Array(arrayBuffer).slice();
              const pdfjsLib = await loadPdfJs();
              const pdf = await pdfjsLib.getDocument({ data: pdfBytesCopy }).promise;
              const page = await pdf.getPage(1);
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              await page.render({ canvasContext: context, viewport }).promise;
              const coverDataUrl = canvas.toDataURL('image/png');
              const scaledWidth = viewport.width / 2;
              const scaledHeight = viewport.height / 2;
              const nodeId = uuidv4();
              const base64Pdf = bytesToBase64(new Uint8Array(arrayBuffer));
              await saveMediaToDB(`${nodeId}_pdf`, base64Pdf);
              addNode({
                id: nodeId,
                type: 'pdf',
                x: x - scaledWidth / 2,
                y: y - scaledHeight / 2,
                width: scaledWidth,
                height: scaledHeight,
                fileName: file.name,
                coverSrc: coverDataUrl,
                totalPages: pdf.numPages,
                currentPage: 1,
              });
            } catch (err) {
              console.error('PDF drag-drop error:', err);
            }
          });
          return; // skip FileReader for PDF
        }

        const reader = new FileReader();
        reader.onload = () => {
          const src = reader.result;
          const isImage = file.type.startsWith('image/') || ext === 'heic' || ext === 'heif';
          if (isImage) {
            const img = new window.Image();
            img.onload = () => {
              const maxDim = 500;
              const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
              addNode({ type: 'image', x: x - (img.width * scale) / 2, y: y - (img.height * scale) / 2, width: img.width * scale, height: img.height * scale, src, fileName: file.name });
            };
            img.onerror = () => {
              // Fallback for HEIC/HEIF or unsupported formats
              addNode({ type: 'image', x, y, width: 300, height: 300, src, fileName: file.name });
            };
            img.src = src;
          } else if (file.type.startsWith('audio/')) {
            addNode({ type: 'audio', x, y, width: 300, height: 80, src, fileName: file.name });
          } else if (file.type.startsWith('video/')) {
            addNode({ type: 'video', x, y, width: 400, height: 300, src, fileName: file.name });
          }
        };
        reader.readAsDataURL(file);
      });

    };
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [addNode]);

  // Global paste listener for images from clipboard
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(item => item.type.startsWith('image/'));
      if (imageItem) {
        e.preventDefault();
        const file = imageItem.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const { stagePosition, stageScale } = useStore.getState();
          const cx = (window.innerWidth / 2 - stagePosition.x) / stageScale;
          const cy = (window.innerHeight / 2 - stagePosition.y) / stageScale;
          const img = new window.Image();
          img.onload = () => {
            const maxDim = 500;
            const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
            addNode({ type: 'image', x: cx - (img.width * scale) / 2, y: cy - (img.height * scale) / 2, width: img.width * scale, height: img.height * scale, src: reader.result });
          };
          img.onerror = () => {
            addNode({ type: 'image', x: cx - 150, y: cy - 150, width: 300, height: 300, src: reader.result });
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addNode]);

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

      // Undo/Redo and Clipboard keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          // Select all canvas objects
          const allIds = useStore.getState().nodes.map(n => n.id);
          if (allIds.length > 0) {
            useStore.setState({ selectedNodeIds: allIds });
            setTool('select');
          }
          return;
        }
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          copySelectedNodes();
          return;
        }
        if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          pasteNodes();
          return;
        }
        if (e.key === 'x' || e.key === 'X') {
          e.preventDefault();
          cutSelectedNodes();
          return;
        }
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          redo();
          return;
        }
      }

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

        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'v') setTool('select');
      else if (key === 's') setTool('shape');
      else if (key === 't') setTool('text');
      else if (key === 'i') setShowImageUploader(true);
      else if (key === 'y') setShowYoutubeEmbed(true);
      else if (key === 'p') setTool('pen');
      else if (key === 'h') setTool('highlighter');
      else if (key === 'n') setTool('sticky');
      else if (key === 'l') setTool('laser');
      else if (key === 'e') setTool('eraser');
      else if (key === 'f') setShowPdfUploader(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, handleDelete, clearSelection, undo, redo, copySelectedNodes, pasteNodes, cutSelectedNodes]);

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f5f6f8' }}>
      {/* Fixed, faint watermark logo — sits behind the canvas and never moves
          with pan/zoom because it lives outside the Konva stage transform. */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: 'url(/transp_bg.png)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'contain',
          transform: 'scale(1.43)', // contained watermark, 30% larger
          opacity: theme === 'dark' ? 0.10 : 0.08,
        }}
      />

      {/* Canvas */}
      <Whiteboard />

      {/* Header with board switcher */}
      <Header />

      {/* UI Chrome */}
      <Toolbar />
      <BottomControls />
      <ContextMenu />
      <CommentOverlay />

      {/* Modals */}
      {showImageUploader && <ImageUploader onClose={() => setShowImageUploader(false)} />}
      {showYoutubeEmbed && <YoutubeEmbed onClose={() => setShowYoutubeEmbed(false)} />}
      {showPdfUploader && <PdfUploader onClose={() => setShowPdfUploader(false)} />}
      {showAudioUploader && <AudioUploader onClose={() => setShowAudioUploader(false)} />}
      {showVideoUploader && <VideoUploader onClose={() => setShowVideoUploader(false)} />}



    </div>
  );
}

export default App;
