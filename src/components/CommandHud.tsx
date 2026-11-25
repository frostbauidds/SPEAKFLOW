import { type FormEvent, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  Loader2,
  Mic,
  MicOff,
  Send,
} from 'lucide-react';

interface CommandHudProps {
  summary: string;
  nodeCount: number;
  linkCount: number;
  statusMeta?: string;
  inputPlaceholder?: string;
  isProcessing: boolean;
  isVoiceSupported: boolean;
  isListening: boolean;
  interimTranscript: string;
  pendingTranscript: string;
  isDebouncePending: boolean;
  suggestedPrompts: string[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onToggleListening: () => void;
  onFlushVoiceNow: () => void;
  onSubmitInstruction: (instruction: string) => void;
}

export function CommandHud({
  summary,
  nodeCount,
  linkCount,
  statusMeta,
  inputPlaceholder,
  isProcessing,
  isVoiceSupported,
  isListening,
  interimTranscript,
  pendingTranscript,
  isDebouncePending,
  suggestedPrompts,
  isCollapsed,
  onToggleCollapse,
  onToggleListening,
  onFlushVoiceNow,
  onSubmitInstruction,
}: CommandHudProps) {
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isProcessing) return;
    setInputText('');
    onSubmitInstruction(trimmed);
  };

  const liveCaption = [pendingTranscript, interimTranscript]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(860px,94vw)] flex flex-col items-center pointer-events-none">
      {/* Collapse / Expand Cinema Mode Toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!isCollapsed}
        className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#081020]/95 border border-sky-500/20 text-[11px] font-medium text-slate-300 hover:text-sky-200 hover:border-sky-400/45 transition-colors cursor-pointer"
      >
        {isCollapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
            Show Command HUD
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
            Hide HUD
          </>
        )}
      </button>

      {!isCollapsed && (
        <section
          aria-label="Voice and Text Architecture Command Bar"
          className="pointer-events-auto w-full rounded-xl bg-[#070E1E]/95 border border-sky-500/25 shadow-[0_18px_50px_rgba(0,0,0,0.65)] p-3.5 sm:p-4 space-y-3"
        >
          {/* Top Status & Live Caption Strip */}
          <div className="flex items-center justify-between gap-3 text-xs min-h-[22px]">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {isProcessing ? (
                <div className="flex items-center gap-2 text-sky-300 font-medium truncate">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="truncate">
                    Synthesizing incremental hologram update...
                  </span>
                </div>
              ) : isListening ? (
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Real active audio capture waveform (rendered only while mic is armed) */}
                  <div
                    aria-hidden="true"
                    className="flex items-center gap-0.5 h-3.5 shrink-0"
                  >
                    <span
                      className="voice-bar w-0.5 h-full bg-amber-400 rounded-full"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="voice-bar w-0.5 h-full bg-amber-400 rounded-full"
                      style={{ animationDelay: '140ms' }}
                    />
                    <span
                      className="voice-bar w-0.5 h-full bg-amber-400 rounded-full"
                      style={{ animationDelay: '280ms' }}
                    />
                    <span
                      className="voice-bar w-0.5 h-full bg-amber-400 rounded-full"
                      style={{ animationDelay: '420ms' }}
                    />
                  </div>
                  <p className="text-amber-200 truncate">
                    {liveCaption || 'Listening — speak an architecture change or command...'}
                  </p>
                  {isDebouncePending && liveCaption && (
                    <button
                      type="button"
                      onClick={onFlushVoiceNow}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30 font-medium transition-colors cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      Send now
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-slate-300 truncate" title={summary}>
                  {summary || 'Ready for voice or text instructions.'}
                </p>
              )}
            </div>

            {/* Clean unboxed metadata counts (Zero-Pill Discipline) */}
            <div className="hidden sm:flex items-center gap-2 text-slate-400 font-mono tabular-nums text-[11px] shrink-0">
              {statusMeta ? (
                <span>{statusMeta}</span>
              ) : (
                <>
                  <span>{nodeCount} nodes</span>
                  <span aria-hidden="true">·</span>
                  <span>{linkCount} links</span>
                </>
              )}
              {!isVoiceSupported && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300/90 font-sans">
                    Text mode (browser lacks Web Speech)
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Main Voice + Text Fallback Input Row */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onToggleListening}
              disabled={!isVoiceSupported || isProcessing}
              aria-label={
                isListening
                  ? 'Stop voice microphone'
                  : isVoiceSupported
                    ? 'Start live voice dictation'
                    : 'Voice dictation unsupported in this browser'
              }
              aria-pressed={isListening}
              title={
                !isVoiceSupported
                  ? 'Web Speech API is unavailable in this browser; use the text bar.'
                  : isListening
                    ? 'Stop Listening'
                    : 'Speak Architecture Instruction'
              }
              className={`h-11 px-3.5 rounded-lg inline-flex items-center gap-2 text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                isListening
                  ? 'bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400'
                  : 'bg-[#0E1930] text-sky-300 border-sky-500/35 hover:bg-sky-500/15 hover:border-sky-400/60'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Speak</span>
                </>
              )}
            </button>

            <div className="relative flex-1 min-w-0">
              <label htmlFor="architecture-command-input" className="sr-only">
                Describe an architecture change or instant voice command
              </label>
              <input
                ref={inputRef}
                id="architecture-command-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isProcessing}
                placeholder={
                  inputPlaceholder ||
                  'Describe a system or anatomy (e.g. "Add Coronary Arteries" or "Add Redis cache") or type "3d anatomy", "2d", "undo"...'
                }
                className="w-full h-11 px-3.5 rounded-lg bg-[#040914] border border-slate-700/90 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 transition-colors disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              aria-label="Apply architecture instruction"
              className="h-11 px-4 rounded-lg inline-flex items-center gap-1.5 bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Apply</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Suggested Incremental Edits & Instant Voice Shortcuts */}
          {suggestedPrompts.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 overflow-x-auto holo-scroll pb-0.5">
              <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                Try saying:
              </span>
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isProcessing}
                  onClick={() => onSubmitInstruction(prompt)}
                  className="px-2.5 py-1 rounded-md bg-[#0C1528] border border-slate-800 text-[11px] text-slate-300 hover:border-sky-500/45 hover:text-sky-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
