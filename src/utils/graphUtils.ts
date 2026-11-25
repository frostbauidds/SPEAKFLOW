import type {
  ArchitectureGraph,
  CleanArchitectureGraph,
  ForceGraphData,
  ForceGraphLink,
  ForceGraphNode,
  GraphLink,
  GraphNode,
  NodePosition3D,
  NodeType,
  ValidationResult,
  VoiceCommandMatch,
} from '../types/graph';

export const VALID_NODE_TYPES: readonly NodeType[] = [
  'input',
  'compute',
  'storage',
  'ai',
  'hardware',
  'output',
] as const;

export interface NodeTypeMeta {
  type: NodeType;
  label: string;
  color: string;
  emissive: string;
  dimColor: string;
  shapeName: string;
}

export const NODE_TYPE_META: Record<NodeType, NodeTypeMeta> = {
  input: {
    type: 'input',
    label: 'Input / Ingress',
    color: '#38BDF8', // Electric Cyan
    emissive: '#0284C7',
    dimColor: 'rgba(56, 189, 248, 0.22)',
    shapeName: 'Octahedron Beacon',
  },
  compute: {
    type: 'compute',
    label: 'Compute / Service',
    color: '#818CF8', // Cobalt Indigo
    emissive: '#4F46E5',
    dimColor: 'rgba(129, 140, 248, 0.22)',
    shapeName: 'Icosahedron Core',
  },
  storage: {
    type: 'storage',
    label: 'Storage / Cache',
    color: '#34D399', // Emerald Circuit
    emissive: '#059669',
    dimColor: 'rgba(52, 211, 153, 0.22)',
    shapeName: 'Stacked Vault',
  },
  ai: {
    type: 'ai',
    label: 'AI / Inference',
    color: '#C084FC', // Neural Violet
    emissive: '#9333EA',
    dimColor: 'rgba(192, 132, 252, 0.22)',
    shapeName: 'Dodecahedron Matrix',
  },
  hardware: {
    type: 'hardware',
    label: 'Hardware / Edge',
    color: '#F59E0B', // Arc Amber
    emissive: '#D97706',
    dimColor: 'rgba(245, 158, 11, 0.22)',
    shapeName: 'Chassis Module',
  },
  output: {
    type: 'output',
    label: 'Output / Egress',
    color: '#FB7185', // Signal Coral
    emissive: '#E11D48',
    dimColor: 'rgba(251, 113, 133, 0.22)',
    shapeName: 'Emitter Crystal',
  },
};

export function toSnakeCase(input: string): string {
  const cleaned = input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'node';
}

export function normalizeNodeType(rawType: unknown): NodeType {
  if (typeof rawType !== 'string') return 'compute';
  const normalized = rawType.trim().toLowerCase();
  if ((VALID_NODE_TYPES as readonly string[]).includes(normalized)) {
    return normalized as NodeType;
  }
  if (
    normalized.includes('db') ||
    normalized.includes('data') ||
    normalized.includes('cache') ||
    normalized.includes('queue') ||
    normalized.includes('store') ||
    normalized.includes('capillar') ||
    normalized.includes('alveol') ||
    normalized.includes('reservoir') ||
    normalized.includes('membrane') ||
    normalized.includes('vesicle')
  ) {
    return 'storage';
  }
  if (
    normalized.includes('llm') ||
    normalized.includes('model') ||
    normalized.includes('ml') ||
    normalized.includes('neural') ||
    normalized.includes('agent') ||
    normalized.includes('nerve') ||
    normalized.includes('pacemaker') ||
    normalized.includes('hormone') ||
    normalized.includes('brain') ||
    normalized.includes('endocrine') ||
    normalized.includes('conduction')
  ) {
    return 'ai';
  }
  if (
    normalized.includes('sensor') ||
    normalized.includes('chip') ||
    normalized.includes('mcu') ||
    normalized.includes('fpga') ||
    normalized.includes('motor') ||
    normalized.includes('circuit') ||
    normalized.includes('valve') ||
    normalized.includes('vessel') ||
    normalized.includes('artery') ||
    normalized.includes('organ') ||
    normalized.includes('bone') ||
    normalized.includes('muscle')
  ) {
    return 'hardware';
  }
  if (
    normalized.includes('client') ||
    normalized.includes('user') ||
    normalized.includes('ingress') ||
    normalized.includes('gateway') ||
    normalized.includes('vein') ||
    normalized.includes('venous') ||
    normalized.includes('afferent') ||
    normalized.includes('receptor') ||
    normalized.includes('stimulus')
  ) {
    return 'input';
  }
  if (
    normalized.includes('egress') ||
    normalized.includes('display') ||
    normalized.includes('sink') ||
    normalized.includes('ui') ||
    normalized.includes('response') ||
    normalized.includes('aorta') ||
    normalized.includes('efferent') ||
    normalized.includes('excret') ||
    normalized.includes('effector')
  ) {
    return 'output';
  }
  return 'compute';
}

export function extractEndpointId(endpoint: unknown): string {
  if (typeof endpoint === 'string') {
    return endpoint.trim();
  }
  if (endpoint && typeof endpoint === 'object' && 'id' in endpoint) {
    const idVal = (endpoint as { id?: unknown }).id;
    if (typeof idVal === 'string') return idVal.trim();
    if (typeof idVal === 'number') return String(idVal);
  }
  return '';
}

/**
 * CRITICAL GUARDRAIL #1:
 * Strips all Three.js, d3-force, and circular object references.
 * Returns a pure deep-copy JSON-safe structure containing ONLY
 * { id, label, type, description } for nodes and string IDs for links.
 */
export function sanitizeGraphForSerialization(
  graph:
    | ArchitectureGraph
    | {
        title?: unknown;
        summary?: unknown;
        nodes?: Array<Partial<ForceGraphNode>>;
        links?: Array<Partial<ForceGraphLink>>;
      }
): CleanArchitectureGraph {
  const title =
    typeof graph?.title === 'string' && graph.title.trim().length > 0
      ? graph.title.trim()
      : 'Untitled Architecture';
  const summary =
    typeof graph?.summary === 'string' ? graph.summary.trim() : '';

  const seenNodeIds = new Set<string>();
  const cleanNodes: CleanArchitectureGraph['nodes'] = [];

  if (Array.isArray(graph?.nodes)) {
    for (const rawNode of graph.nodes) {
      if (!rawNode || typeof rawNode !== 'object') continue;
      const rawId =
        typeof rawNode.id === 'string' && rawNode.id.trim().length > 0
          ? rawNode.id.trim()
          : typeof rawNode.label === 'string' && rawNode.label.trim().length > 0
            ? toSnakeCase(rawNode.label)
            : '';
      if (!rawId || seenNodeIds.has(rawId)) continue;
      seenNodeIds.add(rawId);

      cleanNodes.push({
        id: rawId,
        label:
          typeof rawNode.label === 'string' && rawNode.label.trim().length > 0
            ? rawNode.label.trim()
            : rawId,
        type: normalizeNodeType(rawNode.type),
        description:
          typeof rawNode.description === 'string'
            ? rawNode.description.trim()
            : '',
      });
    }
  }

  const cleanLinks: CleanArchitectureGraph['links'] = [];
  const seenLinkKeys = new Set<string>();

  if (Array.isArray(graph?.links)) {
    for (const rawLink of graph.links) {
      if (!rawLink || typeof rawLink !== 'object') continue;
      const sourceId = extractEndpointId(rawLink.source);
      const targetId = extractEndpointId(rawLink.target);
      if (!sourceId || !targetId) continue;
      if (!seenNodeIds.has(sourceId) || !seenNodeIds.has(targetId)) continue;

      const label =
        typeof rawLink.label === 'string' ? rawLink.label.trim() : '';
      const dedupeKey = `${sourceId}->${targetId}::${label.toLowerCase()}`;
      if (seenLinkKeys.has(dedupeKey)) continue;
      seenLinkKeys.add(dedupeKey);

      cleanLinks.push({
        source: sourceId,
        target: targetId,
        label,
      });
    }
  }

  return {
    title,
    summary,
    nodes: cleanNodes,
    links: cleanLinks,
  };
}

/**
 * CRITICAL GUARDRAIL #2:
 * Crash-proof validator for any LLM response (string or parsed object).
 * - Runs safely inside try/catch
 * - Deduplicates node IDs
 * - Drops links whose source or target does not exist in nodes
 * - Marks genuinely new nodes with `isNew: true` relative to previousGraph
 */
export function validateAndNormalizeGraph(
  rawInput: unknown,
  previousGraph?: ArchitectureGraph
): ValidationResult {
  try {
    let parsed: unknown = rawInput;
    if (typeof rawInput === 'string') {
      const trimmed = rawInput.trim();
      // Strip optional markdown code fences defensively
      const cleanedJson = trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      if (!cleanedJson) {
        return { ok: false, error: 'Empty response payload.' };
      }
      parsed = JSON.parse(cleanedJson);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Graph response must be a JSON object.' };
    }

    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.nodes)) {
      return { ok: false, error: 'Graph response is missing a valid nodes array.' };
    }
    if (obj.links !== undefined && !Array.isArray(obj.links)) {
      return { ok: false, error: 'Graph links field must be an array.' };
    }

    const previousNodeIds = new Set(
      previousGraph ? previousGraph.nodes.map((n) => n.id) : []
    );

    const seenIds = new Set<string>();
    const idRemap = new Map<string, string>();
    const normalizedNodes: GraphNode[] = [];
    let deduplicatedNodes = 0;

    for (const entry of obj.nodes) {
      if (!entry || typeof entry !== 'object') continue;
      const item = entry as Record<string, unknown>;

      const rawIdStr = typeof item.id === 'string' ? item.id.trim() : '';
      const rawLabelStr =
        typeof item.label === 'string' ? item.label.trim() : '';

      const candidateId = rawIdStr
        ? toSnakeCase(rawIdStr)
        : rawLabelStr
          ? toSnakeCase(rawLabelStr)
          : '';

      if (!candidateId) continue;

      if (rawIdStr) {
        idRemap.set(rawIdStr, candidateId);
      }

      if (seenIds.has(candidateId)) {
        deduplicatedNodes += 1;
        continue;
      }

      seenIds.add(candidateId);

      const label =
        rawLabelStr ||
        candidateId
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');

      const description =
        typeof item.description === 'string' && item.description.trim().length > 0
          ? item.description.trim()
          : 'System component';

      // Determine isNew accurately: if we have a previousGraph, any newly appearing ID is new;
      // also respect explicit true from LLM for newly modified nodes if previousGraph existed.
      const isTrulyNew = previousGraph
        ? !previousNodeIds.has(candidateId) || item.isNew === true
        : item.isNew === true;

      normalizedNodes.push({
        id: candidateId,
        label,
        type: normalizeNodeType(item.type),
        description,
        isNew: isTrulyNew,
      });
    }

    const normalizedLinks: GraphLink[] = [];
    const seenLinkKeys = new Set<string>();
    let droppedLinks = 0;

    if (Array.isArray(obj.links)) {
      for (const entry of obj.links) {
        if (!entry || typeof entry !== 'object') {
          droppedLinks += 1;
          continue;
        }
        const item = entry as Record<string, unknown>;
        const rawSource = extractEndpointId(item.source);
        const rawTarget = extractEndpointId(item.target);

        const source = idRemap.get(rawSource) ?? toSnakeCase(rawSource);
        const target = idRemap.get(rawTarget) ?? toSnakeCase(rawTarget);

        if (
          !rawSource ||
          !rawTarget ||
          !seenIds.has(source) ||
          !seenIds.has(target)
        ) {
          droppedLinks += 1;
          continue;
        }

        const label =
          typeof item.label === 'string' && item.label.trim().length > 0
            ? item.label.trim()
            : 'Data Flow';

        const key = `${source}->${target}::${label.toLowerCase()}`;
        if (seenLinkKeys.has(key)) continue;
        seenLinkKeys.add(key);

        normalizedLinks.push({
          source,
          target,
          label,
        });
      }
    }

    const title =
      typeof obj.title === 'string' && obj.title.trim().length > 0
        ? obj.title.trim()
        : previousGraph?.title || 'System Architecture';

    const summary =
      typeof obj.summary === 'string' && obj.summary.trim().length > 0
        ? obj.summary.trim()
        : 'Updated architecture diagram.';

    return {
      ok: true,
      graph: {
        title,
        summary,
        nodes: normalizedNodes,
        links: normalizedLinks,
      },
      droppedLinks,
      deduplicatedNodes,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to parse graph JSON.',
    };
  }
}

/**
 * Produces an isolated mutable copy for react-force-graph so internal d3/Three.js
 * mutations never leak into canonical React state or undo history.
 * Optionally seeds surviving nodes with their cached (x, y, z) coordinates so
 * incremental edits keep existing nodes stable in 3D/2D space.
 */
export function createForceGraphPayload(
  graph: ArchitectureGraph,
  positionCache?: Map<string, NodePosition3D>
): ForceGraphData {
  const nodes: ForceGraphNode[] = graph.nodes.map((node) => {
    const cached = positionCache?.get(node.id);
    const clone: ForceGraphNode = {
      id: node.id,
      label: node.label,
      type: node.type,
      description: node.description,
      isNew: Boolean(node.isNew),
    };
    if (cached && typeof cached.x === 'number' && Number.isFinite(cached.x)) {
      clone.x = cached.x;
    }
    if (cached && typeof cached.y === 'number' && Number.isFinite(cached.y)) {
      clone.y = cached.y;
    }
    if (cached && typeof cached.z === 'number' && Number.isFinite(cached.z)) {
      clone.z = cached.z;
    }
    return clone;
  });

  const links: ForceGraphLink[] = graph.links.map((link) => ({
    source: link.source,
    target: link.target,
    label: link.label,
  }));

  return { nodes, links };
}

/**
 * Instant Client-Side Voice Commands (Zero LLM Latency).
 * Checked before dispatching any instruction to Gemini Flash.
 */
export function matchVoiceCommand(rawTranscript: string): VoiceCommandMatch {
  const normalized = rawTranscript
    .trim()
    .toLowerCase()
    .replace(/[.!?,;]+$/g, '')
    .replace(/\s+/g, ' ');

  if (!normalized) {
    return { matched: false };
  }

  // Undo
  if (
    /^(undo|undo last|undo that|go back|revert|revert last|step back)$/.test(
      normalized
    )
  ) {
    return {
      matched: true,
      command: 'undo',
      feedback: 'Reverted to previous architecture snapshot.',
    };
  }

  // Redo
  if (/^(redo|redo last|redo that|step forward)$/.test(normalized)) {
    return {
      matched: true,
      command: 'redo',
      feedback: 'Restored next architecture snapshot.',
    };
  }

  // Clear / Reset canvas
  if (
    /^(clear|clear all|clear canvas|clear board|clear whiteboard|clear diagram|reset canvas|reset board|wipe canvas|start fresh|blank canvas)$/.test(
      normalized
    )
  ) {
    return {
      matched: true,
      command: 'clear',
      feedback: 'Cleared architecture canvas (say "undo" to restore).',
    };
  }

  // Switch to 2D
  if (
    /^(2d|2d view|2d mode|flat view|schematic view|switch to 2d|go to 2d|show 2d)$/.test(
      normalized
    )
  ) {
    return {
      matched: true,
      command: 'mode_2d',
      feedback: 'Switched to 2D schematic view.',
    };
  }

  // Switch to 3D
  if (
    /^(3d|3d view|3d mode|hologram|hologram view|switch to 3d|go to 3d|show 3d)$/.test(
      normalized
    )
  ) {
    return {
      matched: true,
      command: 'mode_3d',
      feedback: 'Switched to 3D hologram view.',
    };
  }

  // Switch to 3D Anatomy Atlas
  if (
    /^(anatomy|anatomy atlas|3d anatomy|medical atlas|atlas|atlas mode|switch to anatomy|open anatomy|show anatomy)$/.test(
      normalized
    )
  ) {
    return {
      matched: true,
      command: 'mode_atlas',
      feedback: 'Opened 3D Anatomy Atlas.',
    };
  }

  // Direct 3D Anatomy Atlas specimens
  if (
    /^(heart anatomy|heart atlas|3d heart anatomy|show heart anatomy|open heart atlas)$/.test(
      normalized
    )
  ) {
    return {
      matched: true,
      command: 'atlas_heart',
      feedback: 'Opened Human Heart 3D Anatomy Atlas.',
    };
  }
  if (
    /^(brain anatomy|brain atlas|3d brain|show brain anatomy|open brain atlas|load brain)$/.test(
      normalized
    )
  ) {
    return {
      matched: true,
      command: 'atlas_brain',
      feedback: 'Opened Human Brain 3D Anatomy Atlas.',
    };
  }
  if (
    /^(kidney anatomy|kidney atlas|3d kidney|show kidney anatomy|open kidney atlas)$/.test(
      normalized
    )
  ) {
    return {
      matched: true,
      command: 'atlas_kidney',
      feedback: 'Opened Human Kidney 3D Anatomy Atlas.',
    };
  }

  // Recenter / Fit view
  if (
    /^(recenter|re-center|center|center view|reset view|reset camera|fit view|fit graph|zoom to fit|frame all)$/.test(
      normalized
    )
  ) {
    return {
      matched: true,
      command: 'recenter',
      feedback: 'Recentered hologram camera.',
    };
  }

  // Rotation controls
  if (/^(stop rotating|stop rotation|pause rotation|freeze camera)$/.test(normalized)) {
    return {
      matched: true,
      command: 'stop_rotate',
      feedback: 'Paused orbital rotation.',
    };
  }
  if (/^(start rotating|start rotation|orbit|auto rotate|spin)$/.test(normalized)) {
    return {
      matched: true,
      command: 'start_rotate',
      feedback: 'Enabled orbital rotation.',
    };
  }
  if (/^(rotate|toggle rotate|toggle rotation)$/.test(normalized)) {
    return {
      matched: true,
      command: 'toggle_rotate',
      feedback: 'Toggled orbital rotation.',
    };
  }

  // Export JSON
  if (
    /^(export|export json|download json|save json|save diagram|download diagram)$/.test(
      normalized
    )
  ) {
    return {
      matched: true,
      command: 'export_json',
      feedback: 'Exported architecture JSON.',
    };
  }

  // Inspector
  if (
    /^(inspector|toggle inspector|show json|open inspector|close inspector|inspect)$/.test(
      normalized
    )
  ) {
    return {
      matched: true,
      command: 'toggle_inspector',
      feedback: 'Toggled architecture inspector.',
    };
  }

  // Preset loaders
  if (/^(load|open|show)\s+(rag|rag pipeline|search|search engine|demo)$/.test(normalized)) {
    return {
      matched: true,
      command: 'preset_rag',
      feedback: 'Loaded Real-Time RAG Search Pipeline.',
    };
  }
  if (/^(load|open|show)\s+(drone|flight stack|hardware|embedded drone)$/.test(normalized)) {
    return {
      matched: true,
      command: 'preset_drone',
      feedback: 'Loaded Autonomous Drone Flight Stack.',
    };
  }
  if (/^(load|open|show)\s+(fintech|ledger|payments|microservices)$/.test(normalized)) {
    return {
      matched: true,
      command: 'preset_fintech',
      feedback: 'Loaded Event-Driven FinTech Ledger.',
    };
  }
  if (/^(load|open|show)\s+(heart|human heart|cardiac|cardiovascular|circulation)$/.test(normalized)) {
    return {
      matched: true,
      command: 'preset_heart',
      feedback: 'Loaded Human Heart & Cardiac Circulation.',
    };
  }
  if (/^(load|open|show)\s+(nephron|kidney|renal|renal nephron)$/.test(normalized)) {
    return {
      matched: true,
      command: 'preset_nephron',
      feedback: 'Loaded Renal Nephron & Urine Formation.',
    };
  }

  return { matched: false };
}
