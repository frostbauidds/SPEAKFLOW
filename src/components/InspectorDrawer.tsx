import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Sparkles,
  X,
} from 'lucide-react';
import type { ArchitectureGraph } from '../types/graph';
import {
  NODE_TYPE_META,
  VALID_NODE_TYPES,
  sanitizeGraphForSerialization,
} from '../utils/graphUtils';

interface InspectorDrawerProps {
  isOpen: boolean;
  graph: ArchitectureGraph;
  selectedNodeId: string | null;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onExpandNodePrompt: (nodeLabel: string) => void;
  onExportJson: () => void;
}

type InspectorTab = 'node' | 'json' | 'commands';

const VOICE_COMMAND_GUIDE: Array<{ phrases: string; effect: string }> = [
  { phrases: '"Undo" / "Go back"', effect: 'Revert to previous snapshot' },
  { phrases: '"Redo"', effect: 'Restore undone snapshot' },
  { phrases: '"Switch to 2D" / "Switch to 3D" / "3D anatomy"', effect: 'Toggle schematic, hologram & anatomy atlas' },
  { phrases: '"Heart anatomy" / "Brain anatomy" / "Kidney anatomy"', effect: 'Open 3D cutaway anatomical diagrams' },
  { phrases: '"Recenter" / "Fit view"', effect: 'Frame all nodes in camera' },
  { phrases: '"Rotate" / "Stop rotating"', effect: 'Toggle 3D orbital spin' },
  { phrases: '"Clear canvas"', effect: 'Wipe board (undoable)' },
  { phrases: '"Export JSON"', effect: 'Download sanitized diagram' },
  { phrases: '"Load heart" / "Load kidney" / "Load RAG"', effect: 'Switch medical or engineering preset' },
];

export function InspectorDrawer({
  isOpen,
  graph,
  selectedNodeId,
  onClose,
  onSelectNode,
  onExpandNodePrompt,
  onExportJson,
}: InspectorDrawerProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('node');
  const [copied, setCopied] = useState(false);

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId]
  );

  const connections = useMemo(() => {
    if (!selectedNode) return { incoming: [], outgoing: [] };
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
    const incoming = graph.links
      .filter((l) => l.target === selectedNode.id)
      .map((l) => ({ link: l, peer: nodeMap.get(l.source) }));
    const outgoing = graph.links
      .filter((l) => l.source === selectedNode.id)
      .map((l) => ({ link: l, peer: nodeMap.get(l.target) }));
    return { incoming, outgoing };
  }, [graph.links, graph.nodes, selectedNode]);

  const cleanJsonString = useMemo(
    () => JSON.stringify(sanitizeGraphForSerialization(graph), null, 2),
    [graph]
  );

  if (!isOpen) return null;

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(cleanJsonString);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may be blocked in restricted contexts
    }
  };

  return (
    <aside
      aria-label="Architecture Inspector"
      className="fixed top-16 right-4 bottom-28 z-20 w-[min(360px,92vw)] rounded-xl bg-[#070E1E]/95 border border-sky-500/20 shadow-[0_18px_50px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800/90 flex items-center justify-between gap-2">
        <h2 className="font-[var(--font-display)] text-sm font-semibold tracking-wide text-slate-100">
          Architecture Inspector
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close architecture inspector"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Segmented Tabs */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-800/70">
        <div
          role="tablist"
          aria-label="Inspector Sections"
          className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#040914] border border-slate-800"
        >
          {(
            [
              { id: 'node', label: 'Components' },
              { id: 'json', label: 'Clean JSON' },
              { id: 'commands', label: 'Guide' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-sky-500/20 text-sky-200 border border-sky-400/35'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto holo-scroll p-4 space-y-4">
        {activeTab === 'node' && (
          <>
            {selectedNode ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-sky-400">
                      {NODE_TYPE_META[selectedNode.type].label}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {selectedNode.id}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100 leading-snug">
                    {selectedNode.label}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {selectedNode.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onExpandNodePrompt(selectedNode.label)}
                  className="w-full py-2 px-3 rounded-lg bg-sky-500/15 border border-sky-400/35 text-xs font-medium text-sky-200 hover:bg-sky-500/25 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  Expand {selectedNode.label} in detail
                </button>

                {/* Outgoing Links */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <h4 className="text-xs font-semibold text-slate-400">
                    Outgoing Connections ({connections.outgoing.length})
                  </h4>
                  {connections.outgoing.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Terminal sink — no outgoing links.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {connections.outgoing.map(({ link, peer }) => (
                        <li key={`${link.source}-${link.target}-${link.label}`}>
                          <button
                            type="button"
                            onClick={() => onSelectNode(link.target)}
                            className="w-full text-left px-2.5 py-2 rounded-lg bg-[#0C1528] border border-slate-800 hover:border-sky-500/40 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                          >
                            <span className="text-xs font-medium text-slate-200 truncate">
                              {peer?.label ?? link.target}
                            </span>
                            <span className="font-mono text-[11px] text-sky-400/90 shrink-0 inline-flex items-center gap-1">
                              <ArrowRight className="w-3 h-3" />
                              {link.label}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Incoming Links */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <h4 className="text-xs font-semibold text-slate-400">
                    Incoming Connections ({connections.incoming.length})
                  </h4>
                  {connections.incoming.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Entry source — no incoming links.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {connections.incoming.map(({ link, peer }) => (
                        <li key={`${link.source}-${link.target}-${link.label}`}>
                          <button
                            type="button"
                            onClick={() => onSelectNode(link.source)}
                            className="w-full text-left px-2.5 py-2 rounded-lg bg-[#0C1528] border border-slate-800 hover:border-sky-500/40 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                          >
                            <span className="text-xs font-medium text-slate-200 truncate">
                              {peer?.label ?? link.source}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400 shrink-0">
                              {link.label}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Click any node in the 3D hologram or select one below to inspect
                its protocols and fly the camera to it.
              </p>
            )}

            {/* Full Node Directory */}
            <div className="space-y-2 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold">All Components</span>
                <span className="font-mono tabular-nums">
                  {graph.nodes.length}
                </span>
              </div>
              {graph.nodes.length === 0 ? (
                <p className="text-xs text-slate-500">No nodes on canvas.</p>
              ) : (
                <ul className="space-y-1">
                  {graph.nodes.map((node) => {
                    const meta = NODE_TYPE_META[node.type];
                    const active = node.id === selectedNodeId;
                    return (
                      <li key={node.id}>
                        <button
                          type="button"
                          onClick={() => onSelectNode(node.id)}
                          className={`w-full text-left px-2.5 py-2 rounded-lg border flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            active
                              ? 'bg-sky-500/15 border-sky-400/45 text-sky-100'
                              : 'bg-transparent border-transparent hover:bg-[#0C1528] text-slate-300'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              aria-hidden="true"
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: meta.color }}
                            />
                            <span className="text-xs font-medium truncate">
                              {node.label}
                            </span>
                          </span>
                          <span className="text-[11px] text-slate-500 shrink-0">
                            {node.isNew ? 'New · ' : ''}
                            {node.type}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {activeTab === 'json' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-400">
                Sanitized canonical graph (zero circular refs)
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="px-2.5 py-1 rounded-md bg-[#0C1528] border border-slate-700 text-xs text-slate-200 hover:border-sky-400/50 inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onExportJson}
                  className="px-2.5 py-1 rounded-md bg-[#0C1528] border border-slate-700 text-xs text-slate-200 hover:border-sky-400/50 inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  Save
                </button>
              </div>
            </div>
            <pre className="p-3 rounded-lg bg-[#040914] border border-slate-800 font-mono text-[11px] leading-relaxed text-slate-300 overflow-x-auto holo-scroll">
              {cleanJsonString}
            </pre>
          </div>
        )}

        {activeTab === 'commands' && (
          <div className="space-y-5">
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-200">
                Node Geometry Archetypes
              </h3>
              <ul className="space-y-2">
                {VALID_NODE_TYPES.map((type) => {
                  const meta = NODE_TYPE_META[type];
                  return (
                    <li
                      key={type}
                      className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-800/60 last:border-b-0"
                    >
                      <span className="flex items-center gap-2.5 text-slate-200">
                        <span
                          aria-hidden="true"
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        {meta.label}
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {meta.shapeName}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <h3 className="text-xs font-semibold text-slate-200">
                Instant Voice Commands (Zero Latency)
              </h3>
              <ul className="space-y-2">
                {VOICE_COMMAND_GUIDE.map((item) => (
                  <li
                    key={item.phrases}
                    className="space-y-0.5 text-xs pb-1.5 border-b border-slate-800/60 last:border-b-0"
                  >
                    <p className="font-mono text-[11px] text-sky-300">
                      {item.phrases}
                    </p>
                    <p className="text-slate-400">{item.effect}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
