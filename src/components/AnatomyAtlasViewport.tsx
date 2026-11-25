import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GraduationCap,
  HeartPulse,
  ImagePlus,
  Loader2,
  RotateCcw,
  Stethoscope,
  X,
} from 'lucide-react';
import type { AnatomyAtlas, LaidOutAtlasPin } from '../types/anatomy';
import {
  ANATOMY_CATEGORY_META,
  layoutAtlasPins,
} from '../utils/anatomyUtils';

interface AnatomyAtlasViewportProps {
  atlases: AnatomyAtlas[];
  activeAtlas: AnatomyAtlas;
  selectedPinId: string | null;
  isHudCollapsed: boolean;
  isAnnotatingUpload: boolean;
  onSelectAtlas: (atlasId: string) => void;
  onSelectPin: (pinId: string | null) => void;
  onUploadMedicalImage: (imageDataUrl: string, fileName: string) => void;
}

interface StageGeometry {
  stageW: number;
  stageH: number;
  imgLeft: number;
  imgTop: number;
  imgW: number;
  imgH: number;
  leftRailEdgeX: number;
  rightRailEdgeX: number;
}

function getSpecimenIcon(id: string) {
  if (id === 'heart') return HeartPulse;
  if (id === 'brain') return Brain;
  return Stethoscope;
}

export function AnatomyAtlasViewport({
  atlases,
  activeAtlas,
  selectedPinId,
  isHudCollapsed,
  isAnnotatingUpload,
  onSelectAtlas,
  onSelectPin,
  onUploadMedicalImage,
}: AnatomyAtlasViewportProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const [geom, setGeom] = useState<StageGeometry | null>(null);

  const { left: leftPins, right: rightPins } = useMemo(
    () => layoutAtlasPins(activeAtlas.pins, 7, 93),
    [activeAtlas.pins]
  );

  const orderedPins = useMemo<LaidOutAtlasPin[]>(
    () => [...leftPins, ...rightPins],
    [leftPins, rightPins]
  );

  // Reset quiz reveals and hover when switching specimen
  useEffect(() => {
    setHoveredPinId(null);
    setRevealedIds(new Set());
  }, [activeAtlas.id]);

  const measureGeometry = useCallback(() => {
    const stageEl = stageRef.current;
    const imgEl = imageRef.current;
    if (!stageEl || !imgEl) return;

    const stageRect = stageEl.getBoundingClientRect();
    const imgRect = imgEl.getBoundingClientRect();
    if (stageRect.width < 100 || stageRect.height < 100 || imgRect.width < 40) {
      return;
    }

    const railWidth = Math.max(150, Math.min(248, stageRect.width * 0.24));
    setGeom({
      stageW: stageRect.width,
      stageH: stageRect.height,
      imgLeft: imgRect.left - stageRect.left,
      imgTop: imgRect.top - stageRect.top,
      imgW: imgRect.width,
      imgH: imgRect.height,
      leftRailEdgeX: railWidth,
      rightRailEdgeX: stageRect.width - railWidth,
    });
  }, []);

  useEffect(() => {
    measureGeometry();
    const stageEl = stageRef.current;
    if (!stageEl) return;

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => measureGeometry());
      observer.observe(stageEl);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', measureGeometry);
    return () => window.removeEventListener('resize', measureGeometry);
  }, [measureGeometry, activeAtlas.imageUrl, isHudCollapsed]);

  const activePinId = hoveredPinId ?? selectedPinId;
  const activePin = useMemo(
    () => orderedPins.find((p) => p.id === activePinId) ?? null,
    [activePinId, orderedPins]
  );

  const handlePinClick = useCallback(
    (pinId: string) => {
      if (isQuizMode) {
        setRevealedIds((prev) => {
          const next = new Set(prev);
          next.add(pinId);
          return next;
        });
      }
      onSelectPin(pinId === selectedPinId ? null : pinId);
    },
    [isQuizMode, onSelectPin, selectedPinId]
  );

  const handleStepTour = useCallback(
    (delta: 1 | -1) => {
      if (orderedPins.length === 0) return;
      const currentIdx = orderedPins.findIndex((p) => p.id === selectedPinId);
      const nextIdx =
        currentIdx === -1
          ? delta > 0
            ? 0
            : orderedPins.length - 1
          : (currentIdx + delta + orderedPins.length) % orderedPins.length;
      const target = orderedPins[nextIdx];
      if (isQuizMode) {
        setRevealedIds((prev) => new Set(prev).add(target.id));
      }
      onSelectPin(target.id);
    },
    [isQuizMode, onSelectPin, orderedPins, selectedPinId]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onUploadMedicalImage(reader.result, file.name);
        }
      };
      reader.readAsDataURL(file);
    },
    [onUploadMedicalImage]
  );

  const selectedIndex = orderedPins.findIndex((p) => p.id === selectedPinId);
  const railWidthPx = geom ? Math.round(geom.leftRailEdgeX) : 220;

  return (
    <div
      data-testid="anatomy-atlas-viewport"
      data-atlas-id={activeAtlas.id}
      data-pin-count={orderedPins.length}
      className={`relative w-full h-full flex flex-col overflow-hidden bg-[#030712] transition-[padding] duration-200 ${
        isHudCollapsed ? 'pb-14' : 'pb-48'
      }`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 44%, rgba(14, 165, 233, 0.08) 0%, rgba(3, 7, 18, 0) 62%)',
      }}
    >
      {/* Top Specimen & Teaching Controls Bar */}
      <div className="shrink-0 z-20 px-4 sm:px-6 pt-3 pb-2 flex flex-wrap items-center justify-between gap-2.5">
        {/* Built-in 3D Specimens + Upload Custom Medical Diagram */}
        <div className="flex flex-wrap items-center gap-1.5">
          {atlases.map((atlas) => {
            const Icon = getSpecimenIcon(atlas.id);
            const isCurrent = atlas.id === activeAtlas.id;
            return (
              <button
                key={atlas.id}
                type="button"
                onClick={() => onSelectAtlas(atlas.id)}
                className={`h-8 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  isCurrent
                    ? 'bg-rose-500/18 border-rose-400/50 text-rose-200'
                    : 'bg-[#091224] border-slate-800 text-slate-300 hover:border-sky-500/40 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isCurrent ? 'text-rose-400' : 'text-slate-400'
                  }`}
                />
                {atlas.shortName}
              </button>
            );
          })}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={isAnnotatingUpload}
            onClick={() => fileInputRef.current?.click()}
            title="Upload any medical textbook diagram or organ image for instant AI leader-line labeling"
            className="h-8 px-3 rounded-lg border border-sky-500/35 bg-sky-500/12 text-xs font-medium text-sky-200 hover:bg-sky-500/22 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {isAnnotatingUpload ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-300" />
            ) : (
              <ImagePlus className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span>
              {isAnnotatingUpload ? 'Labeling Image...' : 'Upload Medical Image'}
            </span>
          </button>
        </div>

        {/* Teacher Lecture Tour & Quiz Mode Controls */}
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Guided Anatomy Tour"
            className="inline-flex items-center rounded-lg bg-[#091224] border border-slate-800 p-0.5"
          >
            <button
              type="button"
              onClick={() => handleStepTour(-1)}
              aria-label="Previous anatomical part"
              title="Previous structure"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-300 tabular-nums whitespace-nowrap">
              {selectedIndex >= 0
                ? `${selectedIndex + 1} / ${orderedPins.length}`
                : `Tour (${orderedPins.length})`}
            </span>
            <button
              type="button"
              onClick={() => handleStepTour(1)}
              aria-label="Next anatomical part"
              title="Next structure"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !isQuizMode;
              setIsQuizMode(next);
              if (next) {
                setRevealedIds(new Set());
                onSelectPin(null);
              }
            }}
            aria-pressed={isQuizMode}
            className={`h-8 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              isQuizMode
                ? 'bg-amber-500/20 border-amber-400/55 text-amber-200'
                : 'bg-[#091224] border-slate-800 text-slate-300 hover:border-sky-500/40 hover:text-white'
            }`}
          >
            {isQuizMode ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Quiz Mode ({revealedIds.size}/{orderedPins.length})
                </span>
              </>
            ) : (
              <>
                <GraduationCap className="w-3.5 h-3.5 text-sky-400" />
                <span>Quiz / Teach Mode</span>
              </>
            )}
          </button>

          {isQuizMode && (
            <button
              type="button"
              onClick={() =>
                revealedIds.size === orderedPins.length
                  ? setRevealedIds(new Set())
                  : setRevealedIds(new Set(orderedPins.map((p) => p.id)))
              }
              className="h-8 px-2.5 rounded-lg border border-slate-800 bg-[#091224] text-xs text-slate-300 hover:text-white hover:border-sky-500/40 inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              {revealedIds.size === orderedPins.length ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Hide All
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  Reveal All
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Centered Textbook-Style Leader-Line Stage */}
      <div className="relative flex-1 min-h-0 px-3 sm:px-6 flex items-center justify-center">
        <div
          ref={stageRef}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onSelectPin(null);
            }
          }}
          className="relative w-full max-w-[1260px] h-full min-h-[340px] flex items-center justify-center"
        >
          {/* Full-Overlay Crisp SVG Leader Lines Connecting Pins -> Left/Right Annotation Rails */}
          {geom && (
            <svg
              aria-hidden="true"
              className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible"
              viewBox={`0 0 ${geom.stageW} ${geom.stageH}`}
            >
              {orderedPins.map((pin) => {
                const pinX = geom.imgLeft + (pin.x / 100) * geom.imgW;
                const pinY = geom.imgTop + (pin.y / 100) * geom.imgH;
                const labelY = (pin.labelY / 100) * geom.stageH;
                const isLeft = pin.side === 'left';
                const railX = isLeft
                  ? geom.leftRailEdgeX + 4
                  : geom.rightRailEdgeX - 4;
                const elbowX = isLeft
                  ? Math.max(railX + 18, geom.imgLeft - 14)
                  : Math.min(railX - 18, geom.imgLeft + geom.imgW + 14);

                const isActive = pin.id === activePinId;
                const isDimmed = Boolean(activePinId) && !isActive;
                const meta = ANATOMY_CATEGORY_META[pin.category];

                return (
                  <g
                    key={pin.id}
                    opacity={isDimmed ? 0.24 : 1}
                    className="transition-opacity duration-150"
                  >
                    <polyline
                      points={`${pinX},${pinY} ${elbowX},${labelY} ${railX},${labelY}`}
                      fill="none"
                      stroke={isActive ? '#38BDF8' : 'rgba(148, 163, 184, 0.52)'}
                      strokeWidth={isActive ? 2.1 : 1.15}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Textbook vertical anchor tick next to label */}
                    <line
                      x1={railX}
                      y1={labelY - 7}
                      x2={railX}
                      y2={labelY + 7}
                      stroke={isActive ? '#38BDF8' : meta.color}
                      strokeWidth={isActive ? 2.4 : 1.6}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
            </svg>
          )}

          {/* Left Annotation Rail */}
          <div
            className="absolute top-0 bottom-0 left-0 z-20 pointer-events-none"
            style={{ width: `${railWidthPx}px` }}
          >
            {leftPins.map((pin) => {
              const isActive = pin.id === activePinId;
              const isDimmed = Boolean(activePinId) && !isActive;
              const isMasked = isQuizMode && !revealedIds.has(pin.id);
              const meta = ANATOMY_CATEGORY_META[pin.category];

              return (
                <button
                  key={pin.id}
                  type="button"
                  data-testid={`atlas-label-${pin.id}`}
                  onMouseEnter={() => setHoveredPinId(pin.id)}
                  onMouseLeave={() =>
                    setHoveredPinId((curr) => (curr === pin.id ? null : curr))
                  }
                  onClick={() => handlePinClick(pin.id)}
                  style={{ top: `${pin.labelY}%` }}
                  className={`pointer-events-auto absolute right-0 -translate-y-1/2 max-w-full px-2.5 py-1.5 rounded-lg border text-right transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0B1B36]/95 border-sky-400/70 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.22)] z-30'
                      : 'bg-[#070F20]/88 border-slate-800/80 text-slate-200 hover:border-sky-500/45 hover:text-white'
                  } ${isDimmed ? 'opacity-50' : 'opacity-100'}`}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-xs font-medium leading-tight truncate">
                      {isMasked ? `Structure #${pin.orderIndex}` : pin.label}
                    </span>
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: isMasked ? '#F59E0B' : meta.color }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Center 3D Cutaway Specimen Frame */}
          <div className="relative h-full max-h-[590px] aspect-square max-w-[48%] flex items-center justify-center select-none">
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-[#030712]">
              <img
                ref={imageRef}
                src={activeAtlas.imageUrl}
                alt={activeAtlas.title}
                onLoad={measureGeometry}
                draggable={false}
                className="w-full h-full object-contain block"
              />

              {/* Subtle radial edge blend so specimen floats seamlessly in dark space */}
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: 'inset 0 0 42px 12px rgba(3, 7, 18, 0.72)',
                }}
              />

              {/* Interactive Anatomical Pins Anchored Directly on the 3D Image */}
              {orderedPins.map((pin) => {
                const isActive = pin.id === activePinId;
                const isSelected = pin.id === selectedPinId;
                const meta = ANATOMY_CATEGORY_META[pin.category];
                return (
                  <button
                    key={pin.id}
                    type="button"
                    data-testid={`atlas-pin-${pin.id}`}
                    aria-label={
                      isQuizMode && !revealedIds.has(pin.id)
                        ? `Anatomical structure ${pin.orderIndex}`
                        : pin.label
                    }
                    onMouseEnter={() => setHoveredPinId(pin.id)}
                    onMouseLeave={() =>
                      setHoveredPinId((curr) => (curr === pin.id ? null : curr))
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePinClick(pin.id);
                    }}
                    style={{
                      left: `${pin.x}%`,
                      top: `${pin.y}%`,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center rounded-full transition-transform cursor-pointer ${
                      isActive ? 'scale-125 z-30' : 'hover:scale-125'
                    }`}
                  >
                    {/* Outer halo ring */}
                    <span
                      className={`absolute rounded-full transition-all ${
                        isActive
                          ? 'w-7 h-7 border-2 border-sky-400/90 bg-sky-400/20'
                          : 'w-5 h-5 border border-white/55 bg-slate-950/55'
                      }`}
                    />
                    {/* Core precision pin dot / quiz number */}
                    {isQuizMode ? (
                      <span
                        className="relative w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold text-slate-950 shadow-sm"
                        style={{
                          backgroundColor: isActive ? '#38BDF8' : '#F59E0B',
                        }}
                      >
                        {pin.orderIndex}
                      </span>
                    ) : (
                      <span
                        className="relative w-2.5 h-2.5 rounded-full border border-slate-950 shadow-sm"
                        style={{
                          backgroundColor: isSelected
                            ? '#38BDF8'
                            : isActive
                              ? '#E0F2FE'
                              : meta.color,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Annotation Rail */}
          <div
            className="absolute top-0 bottom-0 right-0 z-20 pointer-events-none"
            style={{ width: `${railWidthPx}px` }}
          >
            {rightPins.map((pin) => {
              const isActive = pin.id === activePinId;
              const isDimmed = Boolean(activePinId) && !isActive;
              const isMasked = isQuizMode && !revealedIds.has(pin.id);
              const meta = ANATOMY_CATEGORY_META[pin.category];

              return (
                <button
                  key={pin.id}
                  type="button"
                  data-testid={`atlas-label-${pin.id}`}
                  onMouseEnter={() => setHoveredPinId(pin.id)}
                  onMouseLeave={() =>
                    setHoveredPinId((curr) => (curr === pin.id ? null : curr))
                  }
                  onClick={() => handlePinClick(pin.id)}
                  style={{ top: `${pin.labelY}%` }}
                  className={`pointer-events-auto absolute left-0 -translate-y-1/2 max-w-full px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0B1B36]/95 border-sky-400/70 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.22)] z-30'
                      : 'bg-[#070F20]/88 border-slate-800/80 text-slate-200 hover:border-sky-500/45 hover:text-white'
                  } ${isDimmed ? 'opacity-50' : 'opacity-100'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: isMasked ? '#F59E0B' : meta.color }}
                    />
                    <span className="text-xs font-medium leading-tight truncate">
                      {isMasked ? `Structure #${pin.orderIndex}` : pin.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Floating Anatomical Explanation & Clinical Pearl Teaching Card */}
        {activePin && (!isQuizMode || revealedIds.has(activePin.id)) && (
          <div
            data-testid="anatomy-study-card"
            className={`fixed z-30 w-[min(336px,90vw)] rounded-xl border border-sky-400/45 bg-[#060E1F]/96 shadow-[0_18px_48px_rgba(0,0,0,0.78)] p-4 space-y-2.5 transition-all ${
              activePin.side === 'right' ? 'left-5' : 'right-5'
            } ${isHudCollapsed ? 'bottom-16' : 'bottom-44'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      ANATOMY_CATEGORY_META[activePin.category].color,
                  }}
                />
                <span className="font-mono text-[10px] uppercase tracking-wider text-sky-300 truncate">
                  {ANATOMY_CATEGORY_META[activePin.category].label} · Part{' '}
                  {activePin.orderIndex}/{orderedPins.length}
                </span>
              </div>
              {selectedPinId && (
                <button
                  type="button"
                  onClick={() => onSelectPin(null)}
                  aria-label="Close anatomical explanation"
                  className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <h3 className="font-[var(--font-display)] text-base font-semibold text-slate-50 leading-snug">
              {activePin.label}
            </h3>

            <p className="text-xs leading-relaxed text-slate-300">
              {activePin.description}
            </p>

            {/* Clinical & Exam Pearl Box */}
            <div className="rounded-lg bg-amber-500/10 border border-amber-400/25 px-3 py-2 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-amber-300">
                <Stethoscope className="w-3 h-3" />
                Clinical &amp; Exam Pearl
              </div>
              <p className="text-[11.5px] leading-relaxed text-amber-100/90">
                {activePin.clinicalNote}
              </p>
            </div>

            {/* Step Tour Footer */}
            <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">{activeAtlas.system}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStepTour(-1)}
                  className="px-2 py-1 rounded bg-[#0C1528] border border-slate-800 text-slate-300 hover:border-sky-500/40 hover:text-white transition-colors cursor-pointer"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => handleStepTour(1)}
                  className="px-2 py-1 rounded bg-sky-500/20 border border-sky-400/40 text-sky-200 hover:bg-sky-500/30 transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
