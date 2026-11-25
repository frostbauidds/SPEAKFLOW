export type NodeType =
  | 'input'
  | 'compute'
  | 'storage'
  | 'ai'
  | 'hardware'
  | 'output';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  description: string;
  isNew?: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
}

export interface ArchitectureGraph {
  title: string;
  summary: string;
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface CleanGraphNode {
  id: string;
  label: string;
  type: NodeType;
  description: string;
}

export interface CleanGraphLink {
  source: string;
  target: string;
  label: string;
}

export interface CleanArchitectureGraph {
  title: string;
  summary: string;
  nodes: CleanGraphNode[];
  links: CleanGraphLink[];
}

export type ViewMode = '3d' | '2d' | 'atlas';

export type InstantCommandType =
  | 'undo'
  | 'redo'
  | 'clear'
  | 'mode_2d'
  | 'mode_3d'
  | 'mode_atlas'
  | 'atlas_heart'
  | 'atlas_brain'
  | 'atlas_kidney'
  | 'recenter'
  | 'toggle_rotate'
  | 'start_rotate'
  | 'stop_rotate'
  | 'export_json'
  | 'toggle_inspector'
  | 'preset_rag'
  | 'preset_drone'
  | 'preset_fintech'
  | 'preset_heart'
  | 'preset_nephron';

export interface VoiceCommandMatch {
  matched: boolean;
  command?: InstantCommandType;
  feedback?: string;
}

export interface ValidationResult {
  ok: boolean;
  graph?: ArchitectureGraph;
  error?: string;
  droppedLinks?: number;
  deduplicatedNodes?: number;
}

export interface NodePosition3D {
  x?: number;
  y?: number;
  z?: number;
}

export interface ForceGraphNode extends GraphNode {
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  index?: number;
  __threeObj?: unknown;
}

export interface ForceGraphLink {
  source: string | ForceGraphNode;
  target: string | ForceGraphNode;
  label: string;
}

export interface ForceGraphData {
  nodes: ForceGraphNode[];
  links: ForceGraphLink[];
}
