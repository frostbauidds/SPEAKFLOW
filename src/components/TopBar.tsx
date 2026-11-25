import {
  Download,
  Focus,
  PanelRight,
  Redo2,
  RotateCw,
  Trash2,
  Undo2,
} from 'lucide-react';
import { ARCHITECTURE_PRESETS, type ArchitecturePreset } from '../data/presets';
import type { ViewMode } from '../types/graph';

interface TopBarProps {
  title: string;
  activePresetId: ArchitecturePreset['id'] | 'custom';
  viewMode: ViewMode;
  autoRotate: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isInspectorOpen: boolean;
  hasNodes: boolean;
  onSelectPreset: (presetId: ArchitecturePreset['id']) => void;
  onChangeViewMode: (mode: ViewMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  onToggleAutoRotate: () => void;
  onToggleInspector: () => void;
  onClearCanvas: () => void;
  onExportJson: () => void;
}

export function TopBar({
  title,
  activePresetId,
  viewMode,
  autoRotate,
  canUndo,
  canRedo,
  isInspectorOpen,
  hasNodes,
  onSelectPreset,
  onChangeViewMode,
  onUndo,
  onRedo,
  onFitView,
  onToggleAutoRotate,
  onToggleInspector,
  onClearCanvas,
  onExportJson,
}: TopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-14 px-4 sm:px-6 flex items-center justify-between gap-4 bg-[#060B17]/92 border-b border-sky-500/15">
      {/* Zone 1: Brand + Active Architecture Title */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-[var(--font-display)] text-lg font-bold tracking-wide text-sky-400 whitespace-nowrap shrink-0">
          HoloArch
        </span>
        <span
          aria-hidden="true"
          className="hidden sm:inline text-slate-700 select-none"
        >
          /
        </span>
        <h1
          title={title}
          className="hidden sm:block text-sm font-medium text-slate-200 truncate max-w-[200px] lg:max-w-[300px]"
        >
          {title}
        </h1>
      </div>

      {/* Zone 2: Preset Blueprints & 3D/2D/Atlas Mode Switch */}
      <div className="flex items-center gap-3 shrink-0">
        {viewMode !== 'atlas' && (
          <>
            <label className="sr-only" htmlFor="blueprint-preset-select">
              Starter Architecture Blueprint
            </label>
            <select
              id="blueprint-preset-select"
              aria-label="Starter Architecture Blueprint"
              value={activePresetId === 'custom' ? '' : activePresetId}
              onChange={(e) => {
                const val = e.target.value as ArchitecturePreset['id'];
                if (val) onSelectPreset(val);
              }}
              className="hidden md:block h-9 px-3 rounded-lg bg-[#0C1528] border border-slate-700/80 text-xs font-medium text-slate-200 hover:border-sky-500/40 focus:outline-none focus:border-sky-400 transition-colors cursor-pointer"
            >
              {activePresetId === 'custom' && (
                <option value="" disabled>
                  Custom Diagram
                </option>
              )}
              <optgroup
                label="Medical &amp; Anatomy"
                className="bg-[#0C1528] text-sky-300"
              >
                {ARCHITECTURE_PRESETS.filter((p) => p.category === 'medical').map(
                  (preset) => (
                    <option
                      key={preset.id}
                      value={preset.id}
                      className="bg-[#0C1528] text-slate-200"
                    >
                      {preset.shortName}
                    </option>
                  )
                )}
              </optgroup>
              <optgroup
                label="Engineering &amp; Systems"
                className="bg-[#0C1528] text-sky-300"
              >
                {ARCHITECTURE_PRESETS.filter(
                  (p) => p.category === 'engineering'
                ).map((preset) => (
                  <option
                    key={preset.id}
                    value={preset.id}
                    className="bg-[#0C1528] text-slate-200"
                  >
                    {preset.shortName}
                  </option>
                ))}
              </optgroup>
              {ARCHITECTURE_PRESETS.filter((p) => p.category === 'general').map(
                (preset) => (
                  <option
                    key={preset.id}
                    value={preset.id}
                    className="bg-[#0C1528] text-slate-200"
                  >
                    {preset.shortName}
                  </option>
                )
              )}
            </select>
          </>
        )}

        <div
          role="group"
          aria-label="Viewport Mode"
          className="inline-flex items-center p-0.5 rounded-lg bg-[#0C1528] border border-slate-700/80"
        >
          <button
            type="button"
            onClick={() => onChangeViewMode('3d')}
            aria-pressed={viewMode === '3d'}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === '3d'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            3D Hologram
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('2d')}
            aria-pressed={viewMode === '2d'}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === '2d'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            2D Schematic
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('atlas')}
            aria-pressed={viewMode === 'atlas'}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'atlas'
                ? 'bg-rose-500 text-white'
                : 'text-slate-400 hover:text-rose-200'
            }`}
          >
            3D Anatomy
          </button>
        </div>
      </div>

      {/* Zone 3: Direct Whiteboard Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {viewMode !== 'atlas' && (
          <>
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo last change"
              title="Undo (Ctrl+Z)"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo change"
              title="Redo (Ctrl+Shift+Z)"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onFitView}
              disabled={!hasNodes}
              aria-label="Recenter camera view"
              title="Recenter View"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Focus className="w-4 h-4" />
            </button>

            {viewMode === '3d' && (
              <button
                type="button"
                onClick={onToggleAutoRotate}
                disabled={!hasNodes}
                aria-label="Toggle orbital rotation"
                aria-pressed={autoRotate}
                title="Toggle Orbital Rotation"
                className={`hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer disabled:opacity-35 disabled:pointer-events-none ${
                  autoRotate
                    ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                    : 'border-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClearCanvas}
              disabled={!hasNodes}
              aria-label="Clear canvas"
              title="Clear Canvas"
              className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onExportJson}
          disabled={viewMode !== 'atlas' && !hasNodes}
          aria-label="Export diagram JSON"
          title="Export Clean JSON"
          className="hidden lg:inline-flex h-9 px-3 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#0C1528] text-xs font-medium text-slate-200 hover:border-sky-500/50 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          Export
        </button>

        {viewMode !== 'atlas' && (
          <button
            type="button"
            onClick={onToggleInspector}
            aria-label="Toggle architecture inspector"
            aria-expanded={isInspectorOpen}
            className={`h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isInspectorOpen
                ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                : 'bg-[#0C1528] border-slate-700/80 text-slate-200 hover:border-sky-500/50 hover:text-white'
            }`}
          >
            <PanelRight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Inspector</span>
          </button>
        )}
      </div>
    </header>
  );
}
