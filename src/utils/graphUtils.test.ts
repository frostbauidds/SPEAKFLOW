import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createForceGraphPayload,
  matchVoiceCommand,
  normalizeNodeType,
  sanitizeGraphForSerialization,
  toSnakeCase,
  validateAndNormalizeGraph,
} from './graphUtils';
import { getPresetById } from '../data/presets';
import type { ArchitectureGraph, ForceGraphNode } from '../types/graph';

test('toSnakeCase normalizes labels and camelCase strings cleanly', () => {
  assert.equal(toSnakeCase('APIGateway'), 'apigateway');
  assert.equal(toSnakeCase('Query Orchestrator'), 'query_orchestrator');
  assert.equal(toSnakeCase('Redis Cache (v2)!'), 'redis_cache_v2');
  assert.equal(toSnakeCase('   '), 'node');
});

test('sanitizeGraphForSerialization strips Three.js circular refs and converts link objects to string IDs', () => {
  const nodeA: ForceGraphNode = {
    id: 'api_gateway',
    label: 'API Gateway',
    type: 'input',
    description: 'Ingress router',
    isNew: true,
    x: 12.5,
    y: -30.2,
    z: 8.1,
    vx: 0.4,
    vy: -0.1,
    vz: 0.2,
  };
  const nodeB: ForceGraphNode = {
    id: 'redis_cache',
    label: 'Redis Cache',
    type: 'storage',
    description: 'Low latency cache',
    isNew: false,
    x: 40,
    y: 10,
    z: -15,
  };

  // Create circular Three.js-style reference that would crash JSON.stringify
  const fakeThreeObj: Record<string, unknown> = { type: 'Group' };
  fakeThreeObj.self = fakeThreeObj;
  nodeA.__threeObj = fakeThreeObj;

  const mutated = {
    title: 'Edge Cache Graph',
    summary: 'Added cache',
    nodes: [nodeA, nodeB],
    links: [
      { source: nodeA, target: nodeB, label: 'RESP / TCP' },
      { source: 'api_gateway', target: 'non_existent', label: 'Dangling' },
    ],
  };

  const clean = sanitizeGraphForSerialization(mutated);

  // Must serialize cleanly without throwing circular JSON error
  const serialized = JSON.stringify(clean);
  const reparsed = JSON.parse(serialized);

  assert.equal(reparsed.nodes.length, 2);
  assert.deepEqual(Object.keys(reparsed.nodes[0]).sort(), [
    'description',
    'id',
    'label',
    'type',
  ]);
  assert.equal(reparsed.links.length, 1);
  assert.deepEqual(reparsed.links[0], {
    source: 'api_gateway',
    target: 'redis_cache',
    label: 'RESP / TCP',
  });
});

test('validateAndNormalizeGraph deduplicates nodes, drops invalid links, and computes isNew accurately', () => {
  const previousGraph: ArchitectureGraph = {
    title: 'Initial',
    summary: 'Initial',
    nodes: [
      {
        id: 'api_gateway',
        label: 'API Gateway',
        type: 'input',
        description: 'Gateway',
        isNew: false,
      },
    ],
    links: [],
  };

  const rawLlmPayload = JSON.stringify({
    title: 'Expanded System',
    summary: 'Added Redis cache and worker service.',
    nodes: [
      {
        id: 'api_gateway',
        label: 'API Gateway',
        type: 'input',
        description: 'Gateway',
        isNew: false,
      },
      {
        id: 'api_gateway',
        label: 'Duplicate Gateway',
        type: 'input',
        description: 'Should be dropped',
      },
      {
        id: 'Redis Cache',
        label: 'Redis Cache',
        type: 'cache', // should normalize to storage
        description: 'In-memory cache',
      },
    ],
    links: [
      { source: 'api_gateway', target: 'Redis Cache', label: 'TCP' },
      { source: 'api_gateway', target: 'ghost_node', label: 'Broken' },
    ],
  });

  const result = validateAndNormalizeGraph(rawLlmPayload, previousGraph);
  assert.equal(result.ok, true);
  assert.ok(result.graph);
  assert.equal(result.deduplicatedNodes, 1);
  assert.equal(result.droppedLinks, 1);
  assert.equal(result.graph.nodes.length, 2);
  assert.equal(result.graph.nodes[0].isNew, false);
  assert.equal(result.graph.nodes[1].id, 'redis_cache');
  assert.equal(result.graph.nodes[1].type, 'storage');
  assert.equal(result.graph.nodes[1].isNew, true);
  assert.equal(result.graph.links.length, 1);
  assert.equal(result.graph.links[0].target, 'redis_cache');
});

test('validateAndNormalizeGraph rejects malformed JSON without throwing', () => {
  const malformed = validateAndNormalizeGraph('{ invalid json ');
  assert.equal(malformed.ok, false);
  assert.ok(malformed.error);

  const missingNodes = validateAndNormalizeGraph({ title: 'No Nodes' });
  assert.equal(missingNodes.ok, false);
});

test('createForceGraphPayload isolates canonical graph from mutations and preserves cached positions', () => {
  const starter = getPresetById('rag').graph;
  const cache = new Map([['web_client', { x: 100, y: 200, z: -50 }]]);

  const payload = createForceGraphPayload(starter, cache);
  assert.equal(payload.nodes[0].x, 100);
  assert.equal(payload.nodes[0].y, 200);
  assert.equal(payload.nodes[0].z, -50);

  // Mutate payload like react-force-graph does
  payload.links[0].source = payload.nodes[0];
  assert.equal(typeof starter.links[0].source, 'string');
});

test('matchVoiceCommand recognizes zero-latency commands and passes architecture prompts through', () => {
  assert.equal(matchVoiceCommand('Undo').command, 'undo');
  assert.equal(matchVoiceCommand('Go back.').command, 'undo');
  assert.equal(matchVoiceCommand('switch to 2D').command, 'mode_2d');
  assert.equal(matchVoiceCommand('Hologram view').command, 'mode_3d');
  assert.equal(matchVoiceCommand('Clear canvas!').command, 'clear');
  assert.equal(matchVoiceCommand('Recenter').command, 'recenter');
  assert.equal(matchVoiceCommand('load drone').command, 'preset_drone');
  assert.equal(matchVoiceCommand('load heart').command, 'preset_heart');
  assert.equal(matchVoiceCommand('show kidney').command, 'preset_nephron');
  assert.equal(matchVoiceCommand('3D anatomy').command, 'mode_atlas');
  assert.equal(matchVoiceCommand('heart anatomy').command, 'atlas_heart');
  assert.equal(matchVoiceCommand('brain anatomy').command, 'atlas_brain');
  assert.equal(matchVoiceCommand('kidney anatomy').command, 'atlas_kidney');

  const llmPrompt = matchVoiceCommand(
    'Add Coronary Arteries branching from the Aorta to supply the myocardium'
  );
  assert.equal(llmPrompt.matched, false);
});

test('medical presets validate cleanly and anatomical node types normalize accurately', () => {
  for (const presetId of ['heart', 'nephron'] as const) {
    const preset = getPresetById(presetId);
    const check = validateAndNormalizeGraph(preset.graph);
    assert.equal(check.ok, true);
    assert.equal(check.droppedLinks, 0);
    assert.equal(check.deduplicatedNodes, 0);
    assert.ok(preset.graph.nodes.length >= 8);
    for (const node of preset.graph.nodes) {
      assert.ok(node.description.trim().length > 20);
    }
  }

  assert.equal(normalizeNodeType('pacemaker'), 'ai');
  assert.equal(normalizeNodeType('valve'), 'hardware');
  assert.equal(normalizeNodeType('alveoli'), 'storage');
  assert.equal(normalizeNodeType('venous'), 'input');
  assert.equal(normalizeNodeType('aorta'), 'output');
});
