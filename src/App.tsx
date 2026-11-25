import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import {
  GraphViewport,
  type GraphViewportHandle,
} from './components/GraphViewport';
import { AnatomyAtlasViewport } from './components/AnatomyAtlasViewport';
import { TopBar } from './components/TopBar';
import { CommandHud } from './components/CommandHud';
import { InspectorDrawer } from './components/InspectorDrawer';
import { ANATOMY_ATLASES } from './data/anatomyAtlases';
import {
  ARCHITECTURE_PRESETS,
  type ArchitecturePreset,
  getPresetById,
} from './data/presets';
import { useVoiceRecognition } from './hooks/useVoiceRecognition';
import type { AnatomyAtlas } from './types/anatomy';
import type { ArchitectureGraph, ViewMode } from './types/graph';
import { validateAnatomyPayload } from './utils/anatomyUtils';
import {
  matchVoiceCommand,
  sanitizeGraphForSerialization,
  toSnakeCase,
  validateAndNormalizeGraph,
} from './utils/graphUtils';

interface ToastState {
  id: number;
  tone: 'info' | 'success' | 'warning';
  message: string;
}

function cloneCanonicalGraph(graph: ArchitectureGraph): ArchitectureGraph {
  const clean = sanitizeGraphForSerialization(graph);
  const newFlagMap = new Map(graph.nodes.map((n) => [n.id, Boolean(n.isNew)]));
  return {
    title: clean.title,
    summary: clean.summary,
    nodes: clean.nodes.map((n) => ({
      ...n,
      isNew: newFlagMap.get(n.id) ?? false,
    })),
    links: clean.links.map((l) => ({ ...l })),
  };
}

export default function App() {
  const initialPreset = ARCHITECTURE_PRESETS[0];

  const [graph, setGraph] = useState<ArchitectureGraph>(() =>
    cloneCanonicalGraph(initialPreset.graph)
  );
  const [activePresetId, setActivePresetId] = useState<
    ArchitecturePreset['id'] | 'custom'
  >(initialPreset.id);
  const [undoStack, setUndoStack] = useState<ArchitectureGraph[]>([]);
  const [redoStack, setRedoStack] = useState<ArchitectureGraph[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [autoRotate, setAutoRotate] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // 3D Anatomy Atlas state (built-in 3D cutaways + uploaded annotated medical diagrams)
  const [atlases, setAtlases] = useState<AnatomyAtlas[]>(() => ANATOMY_ATLASES);
  const [activeAtlasId, setActiveAtlasId] = useState<string>(ANATOMY_ATLASES[0].id);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [isAnnotatingUpload, setIsAnnotatingUpload] = useState(false);

  const activeAtlas = useMemo(
    () => atlases.find((a) => a.id === activeAtlasId) ?? atlases[0],
    [atlases, activeAtlasId]
  );

  const viewportRef = useRef<GraphViewportHandle | null>(null);
  const graphRef = useRef<ArchitectureGraph>(graph);
  const viewModeRef = useRef<ViewMode>(viewMode);
  const activeAtlasRef = useRef<AnatomyAtlas>(activeAtlas);
  const undoStackRef = useRef<ArchitectureGraph[]>(undoStack);
  const redoStackRef = useRef<ArchitectureGraph[]>(redoStack);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    activeAtlasRef.current = activeAtlas;
  }, [activeAtlas]);

  useEffect(() => {
    undoStackRef.current = undoStack;
  }, [undoStack]);

  useEffect(() => {
    redoStackRef.current = redoStack;
  }, [redoStack]);

  const showToast = useCallback(
    (message: string, tone: ToastState['tone'] = 'info', durationMs = 3800) => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      const nextToast: ToastState = { id: Date.now(), tone, message };
      setToast(nextToast);
      toastTimerRef.current = window.setTimeout(() => {
        setToast((curr) => (curr?.id === nextToast.id ? null : curr));
        toastTimerRef.current = null;
      }, durationMs);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const commitGraphTransition = useCallback(
    (
      nextGraph: ArchitectureGraph,
      nextPresetId: ArchitecturePreset['id'] | 'custom' = 'custom'
    ) => {
      const prevClean = cloneCanonicalGraph(graphRef.current);
      setUndoStack((stack) => [...stack.slice(-24), prevClean]);
      setRedoStack([]);
      setGraph(cloneCanonicalGraph(nextGraph));
      setActivePresetId(nextPresetId);
      setSelectedNodeId((curr) =>
        curr && nextGraph.nodes.some((n) => n.id === curr) ? curr : null
      );
    },
    []
  );

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) {
      showToast('Nothing to undo.', 'info', 2200);
      return false;
    }
    const previous = stack[stack.length - 1];
    const currentClean = cloneCanonicalGraph(graphRef.current);
    setUndoStack(stack.slice(0, -1));
    setRedoStack((r) => [...r.slice(-24), currentClean]);
    setGraph(cloneCanonicalGraph(previous));
    setSelectedNodeId(null);
    return true;
  }, [showToast]);

  const handleRedo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) {
      showToast('Nothing to redo.', 'info', 2200);
      return false;
    }
    const next = stack[stack.length - 1];
    const currentClean = cloneCanonicalGraph(graphRef.current);
    setRedoStack(stack.slice(0, -1));
    setUndoStack((u) => [...u.slice(-24), currentClean]);
    setGraph(cloneCanonicalGraph(next));
    setSelectedNodeId(null);
    return true;
  }, [showToast]);

  const handleClearCanvas = useCallback(() => {
    if (graphRef.current.nodes.length === 0) {
      showToast('Canvas is already blank.', 'info', 2200);
      return;
    }
    const blank = getPresetById('blank');
    commitGraphTransition(blank.graph, 'blank');
    showToast('Cleared canvas. Say or press Undo to restore.', 'info');
  }, [commitGraphTransition, showToast]);

  const handleLoadPreset = useCallback(
    (presetId: ArchitecturePreset['id']) => {
      const preset = getPresetById(presetId);
      commitGraphTransition(preset.graph, preset.id);
      showToast(`Loaded ${preset.shortName}.`, 'success', 2600);
    },
    [commitGraphTransition, showToast]
  );

  const handleExportJson = useCallback(() => {
    if (viewModeRef.current === 'atlas') {
      const atlas = activeAtlasRef.current;
      const exportable = {
        id: atlas.id,
        title: atlas.title,
        system: atlas.system,
        summary: atlas.summary,
        pins: atlas.pins,
      };
      const json = JSON.stringify(exportable, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${toSnakeCase(atlas.title)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exported ${toSnakeCase(atlas.title)}.json`, 'success', 2600);
      return;
    }

    const clean = sanitizeGraphForSerialization(graphRef.current);
    const json = JSON.stringify(clean, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${toSnakeCase(clean.title)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${toSnakeCase(clean.title)}.json`, 'success', 2600);
  }, [showToast]);

  const handleSelectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (nodeId) {
      viewportRef.current?.focusNode(nodeId);
    }
  }, []);

  const handleSelectAtlas = useCallback((atlasId: string) => {
    setActiveAtlasId(atlasId);
    setSelectedPinId(null);
  }, []);

  const handleUploadMedicalImage = useCallback(
    async (imageDataUrl: string, fileName: string) => {
      setIsAnnotatingUpload(true);
      try {
        const response = await fetch('/api/anatomy/annotate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageDataUrl, fileName }),
        });
        const data = (await response.json().catch(() => null)) as {
          atlas?: unknown;
          error?: string;
        } | null;

        if (!response.ok || !data?.atlas) {
          throw new Error(
            data?.error || 'Could not annotate uploaded medical diagram.'
          );
        }

        const customId = `upload_${Date.now()}`;
        const validated = validateAnatomyPayload(data.atlas);

        if (!validated.ok || !validated.atlas) {
          throw new Error(validated.error || 'Malformed annotation output.');
        }

        const newAtlas: AnatomyAtlas = {
          ...validated.atlas,
          id: customId,
          imageUrl: imageDataUrl,
          shortName:
            validated.atlas.shortName ||
            fileName.replace(/\.[^.]+$/, '').slice(0, 22) ||
            'Uploaded Diagram',
        };
        setAtlases((prev) => [...prev, newAtlas]);
        setActiveAtlasId(newAtlas.id);
        setSelectedPinId(newAtlas.pins[0]?.id ?? null);
        showToast(
          `Annotated ${newAtlas.pins.length} anatomical structures on ${newAtlas.shortName}.`,
          'success',
          4200
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to label medical image.';
        showToast(msg, 'warning', 5200);
      } finally {
        setIsAnnotatingUpload(false);
      }
    },
    [showToast]
  );

  /**
   * Unified instruction pipeline for both Live Voice (Web Speech API)
   * and Always-Visible Text Fallback Input:
   * 1. Instant zero-latency client-side commands checked first
   * 2. Incremental Gemini Flash update via server-side /api/graph/update
   * 3. Crash-proof validator protecting previous valid graph state
   */
  const handleSubmitInstruction = useCallback(
    async (rawInstruction: string) => {
      const instruction = rawInstruction.trim();
      if (!instruction) return;

      // Step 1: Instant Client-Side Voice Commands (Zero LLM Latency)
      const instant = matchVoiceCommand(instruction);
      if (instant.matched && instant.command) {
        switch (instant.command) {
          case 'undo':
            if (handleUndo() && instant.feedback) {
              showToast(instant.feedback, 'info', 2500);
            }
            return;
          case 'redo':
            if (handleRedo() && instant.feedback) {
              showToast(instant.feedback, 'info', 2500);
            }
            return;
          case 'clear':
            handleClearCanvas();
            return;
          case 'mode_2d':
            setViewMode('2d');
            showToast(instant.feedback || 'Switched to 2D Schematic.', 'info', 2400);
            return;
          case 'mode_3d':
            setViewMode('3d');
            showToast(instant.feedback || 'Switched to 3D Hologram.', 'info', 2400);
            return;
          case 'mode_atlas':
            setViewMode('atlas');
            setIsInspectorOpen(false);
            showToast(instant.feedback || 'Opened 3D Anatomy Atlas.', 'info', 2400);
            return;
          case 'atlas_heart':
            setViewMode('atlas');
            setIsInspectorOpen(false);
            setActiveAtlasId('heart');
            setSelectedPinId(null);
            showToast(instant.feedback || 'Opened Human Heart 3D Anatomy.', 'success', 2600);
            return;
          case 'atlas_brain':
            setViewMode('atlas');
            setIsInspectorOpen(false);
            setActiveAtlasId('brain');
            setSelectedPinId(null);
            showToast(instant.feedback || 'Opened Human Brain 3D Anatomy.', 'success', 2600);
            return;
          case 'atlas_kidney':
            setViewMode('atlas');
            setIsInspectorOpen(false);
            setActiveAtlasId('kidney');
            setSelectedPinId(null);
            showToast(instant.feedback || 'Opened Human Kidney 3D Anatomy.', 'success', 2600);
            return;
          case 'recenter':
            viewportRef.current?.fitView();
            showToast(instant.feedback || 'Recentered camera.', 'info', 2200);
            return;
          case 'toggle_rotate':
            setAutoRotate((prev) => {
              const next = !prev;
              showToast(
                next ? 'Enabled orbital rotation.' : 'Paused orbital rotation.',
                'info',
                2200
              );
              return next;
            });
            return;
          case 'start_rotate':
            setAutoRotate(true);
            showToast(instant.feedback || 'Enabled orbital rotation.', 'info', 2200);
            return;
          case 'stop_rotate':
            setAutoRotate(false);
            showToast(instant.feedback || 'Paused orbital rotation.', 'info', 2200);
            return;
          case 'export_json':
            handleExportJson();
            return;
          case 'toggle_inspector':
            if (viewModeRef.current !== 'atlas') {
              setIsInspectorOpen((prev) => !prev);
            }
            return;
          case 'preset_rag':
            setViewMode((m) => (m === 'atlas' ? '3d' : m));
            handleLoadPreset('rag');
            return;
          case 'preset_drone':
            setViewMode((m) => (m === 'atlas' ? '3d' : m));
            handleLoadPreset('drone');
            return;
          case 'preset_fintech':
            setViewMode((m) => (m === 'atlas' ? '3d' : m));
            handleLoadPreset('fintech');
            return;
          case 'preset_heart':
            setViewMode((m) => (m === 'atlas' ? '3d' : m));
            handleLoadPreset('heart');
            return;
          case 'preset_nephron':
            setViewMode((m) => (m === 'atlas' ? '3d' : m));
            handleLoadPreset('nephron');
            return;
        }
      }

      // Step 2A: If in 3D Anatomy Atlas mode, enrich teaching annotations via /api/anatomy/update
      if (viewModeRef.current === 'atlas') {
        setIsProcessing(true);
        try {
          const current = activeAtlasRef.current;
          const response = await fetch('/api/anatomy/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentAtlas: {
                title: current.title,
                shortName: current.shortName,
                system: current.system,
                summary: current.summary,
                pins: current.pins,
              },
              instruction,
            }),
          });

          const data = (await response.json().catch(() => null)) as {
            atlas?: unknown;
            error?: string;
          } | null;

          if (!response.ok || !data?.atlas) {
            throw new Error(
              data?.error || 'Could not update anatomy annotations. Kept previous state.'
            );
          }

          const validated = validateAnatomyPayload(data.atlas);

          if (!validated.ok || !validated.atlas) {
            throw new Error(
              validated.error || 'Malformed anatomy output. Kept previous state.'
            );
          }

          const updatedAtlas: AnatomyAtlas = {
            ...validated.atlas,
            id: current.id,
            imageUrl: current.imageUrl,
            shortName: current.shortName,
            suggestedPrompts:
              validated.atlas.suggestedPrompts.length > 0
                ? validated.atlas.suggestedPrompts
                : current.suggestedPrompts,
          };
          setAtlases((prev) =>
            prev.map((item) => (item.id === current.id ? updatedAtlas : item))
          );
          showToast(updatedAtlas.summary, 'success', 4200);
        } catch (err) {
          const reason =
            err instanceof Error
              ? err.message
              : 'Retrying / kept previous state.';
          showToast(`Kept previous state — ${reason}`, 'warning', 5200);
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      // Step 2B: Send sanitized canonical graph + instruction to Gemini Flash
      setIsProcessing(true);
      try {
        const cleanPayload = sanitizeGraphForSerialization(graphRef.current);
        const response = await fetch('/api/graph/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentGraph: cleanPayload,
            instruction,
          }),
        });

        const data = (await response.json().catch(() => null)) as {
          graph?: unknown;
          error?: string;
        } | null;

        if (!response.ok || !data?.graph) {
          throw new Error(
            data?.error || 'Could not apply architecture edit. Kept previous state.'
          );
        }

        // Step 3: Crash-proof client-side validation before mutating React state
        const validation = validateAndNormalizeGraph(
          data.graph,
          graphRef.current
        );
        if (!validation.ok || !validation.graph) {
          throw new Error(
            validation.error || 'Malformed graph output. Kept previous state.'
          );
        }

        commitGraphTransition(validation.graph, 'custom');
        showToast(validation.graph.summary, 'success', 4200);
      } catch (err) {
        const reason =
          err instanceof Error
            ? err.message
            : 'Retrying / kept previous state.';
        showToast(`Kept previous state — ${reason}`, 'warning', 5200);
      } finally {
        setIsProcessing(false);
      }
    },
    [
      commitGraphTransition,
      handleClearCanvas,
      handleExportJson,
      handleLoadPreset,
      handleRedo,
      handleUndo,
      showToast,
    ]
  );

  const voice = useVoiceRecognition({
    debounceMs: 900,
    onCommitTranscript: (transcript) => {
      void handleSubmitInstruction(transcript);
    },
    onVoiceError: (message) => {
      showToast(message, 'warning', 4500);
    },
  });

  // Global keyboard shortcuts (Undo / Redo / Cinema HUD toggle / Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setSelectedPinId(null);
        setIsInspectorOpen(false);
        return;
      }

      if (isEditable) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if (e.key.toLowerCase() === 'h' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setIsHudCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRedo, handleUndo]);

  const suggestedPrompts = useMemo(() => {
    if (viewMode === 'atlas') {
      return activeAtlas.suggestedPrompts;
    }
    if (activePresetId !== 'custom') {
      return getPresetById(activePresetId).suggestedPrompts;
    }
    if (graph.nodes.length === 0) {
      return getPresetById('blank').suggestedPrompts;
    }
    return [
      'Add Redis cache for low latency',
      'Add OpenTelemetry observability stack',
      'Add rate-limiting circuit breaker',
    ];
  }, [activeAtlas.suggestedPrompts, activePresetId, graph.nodes.length, viewMode]);

  const activeTitle = viewMode === 'atlas' ? activeAtlas.title : graph.title;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#030712] text-slate-100 select-none">
      {/* Top 3-Zone Navigation Bar */}
      <TopBar
        title={activeTitle}
        activePresetId={activePresetId}
        viewMode={viewMode}
        autoRotate={autoRotate}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        isInspectorOpen={isInspectorOpen}
        hasNodes={graph.nodes.length > 0}
        onSelectPreset={handleLoadPreset}
        onChangeViewMode={(nextMode) => {
          setViewMode(nextMode);
          if (nextMode === 'atlas') {
            setIsInspectorOpen(false);
          }
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onFitView={() => viewportRef.current?.fitView()}
        onToggleAutoRotate={() => setAutoRotate((prev) => !prev)}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        onClearCanvas={handleClearCanvas}
        onExportJson={handleExportJson}
      />

      {/* Non-blocking Toast Banner */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-40 max-w-[min(560px,92vw)] px-3.5 py-2.5 rounded-lg border shadow-[0_12px_36px_rgba(0,0,0,0.6)] flex items-center gap-2.5 text-xs font-medium ${
            toast.tone === 'warning'
              ? 'bg-[#1D1206]/95 border-amber-500/45 text-amber-200'
              : toast.tone === 'success'
                ? 'bg-[#061C1B]/95 border-emerald-500/40 text-emerald-200'
                : 'bg-[#081326]/95 border-sky-500/40 text-sky-200'
          }`}
        >
          {toast.tone === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : toast.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
          )}
          <span className="leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="ml-1 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Full-Bleed Unobstructed Viewport (3D/2D Force Graph OR 3D Anatomy Atlas) */}
      <main className="w-full h-full pt-14">
        {viewMode === 'atlas' ? (
          <AnatomyAtlasViewport
            atlases={atlases}
            activeAtlas={activeAtlas}
            selectedPinId={selectedPinId}
            isHudCollapsed={isHudCollapsed}
            isAnnotatingUpload={isAnnotatingUpload}
            onSelectAtlas={handleSelectAtlas}
            onSelectPin={setSelectedPinId}
            onUploadMedicalImage={(dataUrl, name) =>
              void handleUploadMedicalImage(dataUrl, name)
            }
          />
        ) : (
          <GraphViewport
            ref={viewportRef}
            graph={graph}
            viewMode={viewMode}
            selectedNodeId={selectedNodeId}
            autoRotate={autoRotate}
            isInspectorOpen={isInspectorOpen}
            onSelectNode={handleSelectNode}
            onOpenInspector={() => setIsInspectorOpen(true)}
            onSwitchTo2D={() => setViewMode('2d')}
            onQuickPrompt={(prompt) => void handleSubmitInstruction(prompt)}
            onLoadPreset={handleLoadPreset}
          />
        )}
      </main>

      {/* On-Demand Right-Side Inspector Drawer (Graph Modes Only) */}
      {viewMode !== 'atlas' && (
        <InspectorDrawer
          isOpen={isInspectorOpen}
          graph={graph}
          selectedNodeId={selectedNodeId}
          onClose={() => setIsInspectorOpen(false)}
          onSelectNode={handleSelectNode}
          onExpandNodePrompt={(nodeLabel) => {
            void handleSubmitInstruction(
              `Expand ${nodeLabel} by adding its key connected sub-structures, supporting pathways, or regulatory components`
            );
          }}
          onExportJson={handleExportJson}
        />
      )}

      {/* Collapsible Floating Bottom Voice + Text Command HUD */}
      <CommandHud
        summary={viewMode === 'atlas' ? activeAtlas.summary : graph.summary}
        nodeCount={graph.nodes.length}
        linkCount={graph.links.length}
        statusMeta={
          viewMode === 'atlas'
            ? `${activeAtlas.pins.length} structures · ${activeAtlas.system}`
            : undefined
        }
        inputPlaceholder={
          viewMode === 'atlas'
            ? 'Ask to enrich clinical pearls, simplify for Year 1 students, or say "brain anatomy", "kidney anatomy", "3d"...'
            : undefined
        }
        isProcessing={isProcessing}
        isVoiceSupported={voice.isSupported}
        isListening={voice.isListening}
        interimTranscript={voice.interimTranscript}
        pendingTranscript={voice.pendingTranscript}
        isDebouncePending={voice.isDebouncePending}
        suggestedPrompts={suggestedPrompts}
        isCollapsed={isHudCollapsed}
        onToggleCollapse={() => setIsHudCollapsed((prev) => !prev)}
        onToggleListening={voice.toggleListening}
        onFlushVoiceNow={voice.flushNow}
        onSubmitInstruction={(text) => void handleSubmitInstruction(text)}
      />
    </div>
  );
}
