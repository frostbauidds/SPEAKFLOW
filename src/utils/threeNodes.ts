import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import SpriteText from 'three-spritetext';
import { NODE_TYPE_META } from './graphUtils';
import type { ForceGraphLink, ForceGraphNode, NodeType } from '../types/graph';

let cachedSoftwareGl: boolean | null = null;

/**
 * Probes WebGL renderer string to detect CPU/software WebGL (SwiftShader, llvmpipe, etc.)
 * without changing scene contents or app logic.
 */
export function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedSoftwareGl;
  } catch {
    cachedSoftwareGl = false;
    return false;
  }
}

// Shared pooled geometries so we never allocate redundant buffers per node
const SHARED_GEOMETRIES = {
  octaCore: new THREE.OctahedronGeometry(5.6, 0),
  icoCore: new THREE.IcosahedronGeometry(5.4, 0),
  dodecaCore: new THREE.DodecahedronGeometry(5.8, 0),
  vaultPlatter: new THREE.CylinderGeometry(5.4, 5.4, 2.3, 6),
  hardwareBase: new THREE.BoxGeometry(8.2, 4.8, 8.2),
  hardwareTop: new THREE.BoxGeometry(6.0, 1.8, 6.0),
  hardwarePin: new THREE.CylinderGeometry(0.45, 0.45, 1.4, 6),
  outputCore: new THREE.ConeGeometry(4.8, 8.8, 6),
  outputBase: new THREE.ConeGeometry(4.8, 4.4, 6),
  gyroRing: new THREE.TorusGeometry(8.2, 0.28, 10, 36),
  innerCollar: new THREE.TorusGeometry(6.6, 0.34, 10, 32),
  newHaloRing: new THREE.TorusGeometry(10.2, 0.38, 10, 42),
  selectedRing: new THREE.TorusGeometry(11.4, 0.45, 10, 48),
  wireOcta: new THREE.OctahedronGeometry(8.1, 0),
  wireBox: new THREE.BoxGeometry(10.2, 6.8, 10.2),
};

interface TypeMaterials {
  primary: THREE.MeshPhysicalMaterial;
  accent: THREE.MeshStandardMaterial;
  wireframe: THREE.MeshBasicMaterial;
}

const materialPool = new Map<NodeType, TypeMaterials>();

const NEW_HIGHLIGHT_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0xf59e0b,
  transparent: true,
  opacity: 0.92,
});

const SELECTED_HIGHLIGHT_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  transparent: true,
  opacity: 0.95,
});

const METALLIC_TRIM_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x94a3b8,
  metalness: 0.85,
  roughness: 0.25,
});

function getTypeMaterials(type: NodeType): TypeMaterials {
  const existing = materialPool.get(type);
  if (existing) return existing;

  const meta = NODE_TYPE_META[type] ?? NODE_TYPE_META.compute;
  const color = new THREE.Color(meta.color);
  const emissive = new THREE.Color(meta.emissive);

  const primary = new THREE.MeshPhysicalMaterial({
    color,
    emissive,
    emissiveIntensity: 0.42,
    metalness: 0.48,
    roughness: 0.22,
    clearcoat: 0.85,
    clearcoatRoughness: 0.16,
  });

  const accent = new THREE.MeshStandardMaterial({
    color: color.clone().offsetHSL(0, 0.05, 0.12),
    emissive: color,
    emissiveIntensity: 0.58,
    metalness: 0.25,
    roughness: 0.55,
  });

  const wireframe = new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.28,
  });

  const bundle: TypeMaterials = { primary, accent, wireframe };
  materialPool.set(type, bundle);
  return bundle;
}

/**
 * Builds a composite multi-part holographic 3D architectural node (THREE.Group)
 * with distinct primary silhouette, secondary gyro/containment frame, accent detail,
 * and always-camera-facing SpriteText label.
 */
export function buildHologramNodeObject(
  node: ForceGraphNode,
  isSelected: boolean,
  isHovered: boolean
): THREE.Group {
  const group = new THREE.Group();
  const mats = getTypeMaterials(node.type);

  switch (node.type) {
    case 'input': {
      const core = new THREE.Mesh(SHARED_GEOMETRIES.octaCore, mats.primary);
      const reticle = new THREE.Mesh(SHARED_GEOMETRIES.wireOcta, mats.wireframe);
      const ring = new THREE.Mesh(SHARED_GEOMETRIES.gyroRing, mats.accent);
      ring.rotation.x = Math.PI / 2.6;
      ring.rotation.y = Math.PI / 6;
      group.add(core, reticle, ring);
      break;
    }
    case 'compute': {
      const core = new THREE.Mesh(SHARED_GEOMETRIES.icoCore, mats.primary);
      const collar = new THREE.Mesh(SHARED_GEOMETRIES.innerCollar, METALLIC_TRIM_MATERIAL);
      collar.rotation.x = Math.PI / 2;
      const orbit = new THREE.Mesh(SHARED_GEOMETRIES.gyroRing, mats.accent);
      orbit.rotation.x = Math.PI / 3;
      orbit.rotation.z = -Math.PI / 5;
      group.add(core, collar, orbit);
      break;
    }
    case 'storage': {
      const bottomPlatter = new THREE.Mesh(SHARED_GEOMETRIES.vaultPlatter, mats.primary);
      bottomPlatter.position.y = -3.0;
      const midPlatter = new THREE.Mesh(SHARED_GEOMETRIES.vaultPlatter, METALLIC_TRIM_MATERIAL);
      midPlatter.position.y = 0;
      midPlatter.scale.set(0.92, 0.8, 0.92);
      const topPlatter = new THREE.Mesh(SHARED_GEOMETRIES.vaultPlatter, mats.primary);
      topPlatter.position.y = 3.0;
      const ring = new THREE.Mesh(SHARED_GEOMETRIES.gyroRing, mats.accent);
      ring.rotation.x = Math.PI / 2;
      group.add(bottomPlatter, midPlatter, topPlatter, ring);
      break;
    }
    case 'ai': {
      const core = new THREE.Mesh(SHARED_GEOMETRIES.dodecaCore, mats.primary);
      const ringA = new THREE.Mesh(SHARED_GEOMETRIES.gyroRing, mats.accent);
      ringA.rotation.x = Math.PI / 3;
      const ringB = new THREE.Mesh(SHARED_GEOMETRIES.gyroRing, mats.accent);
      ringB.rotation.y = Math.PI / 3;
      ringB.rotation.x = -Math.PI / 4;
      const collar = new THREE.Mesh(SHARED_GEOMETRIES.innerCollar, METALLIC_TRIM_MATERIAL);
      collar.rotation.z = Math.PI / 2;
      group.add(core, ringA, ringB, collar);
      break;
    }
    case 'hardware': {
      const chassis = new THREE.Mesh(SHARED_GEOMETRIES.hardwareBase, mats.primary);
      const heatsink = new THREE.Mesh(SHARED_GEOMETRIES.hardwareTop, METALLIC_TRIM_MATERIAL);
      heatsink.position.y = 3.2;
      const cage = new THREE.Mesh(SHARED_GEOMETRIES.wireBox, mats.wireframe);
      const pinOffsets: Array<[number, number]> = [
        [-3.0, -3.0],
        [3.0, -3.0],
        [-3.0, 3.0],
        [3.0, 3.0],
      ];
      group.add(chassis, heatsink, cage);
      for (const [px, pz] of pinOffsets) {
        const pin = new THREE.Mesh(SHARED_GEOMETRIES.hardwarePin, mats.accent);
        pin.position.set(px, -3.0, pz);
        group.add(pin);
      }
      break;
    }
    case 'output': {
      const upper = new THREE.Mesh(SHARED_GEOMETRIES.outputCore, mats.primary);
      upper.position.y = 2.2;
      const lower = new THREE.Mesh(SHARED_GEOMETRIES.outputBase, METALLIC_TRIM_MATERIAL);
      lower.rotation.x = Math.PI;
      lower.position.y = -4.2;
      const ring = new THREE.Mesh(SHARED_GEOMETRIES.gyroRing, mats.accent);
      ring.rotation.x = Math.PI / 2;
      group.add(upper, lower, ring);
      break;
    }
  }

  // Highlight newly added nodes from the latest Gemini edit
  if (node.isNew) {
    const newHalo = new THREE.Mesh(
      SHARED_GEOMETRIES.newHaloRing,
      NEW_HIGHLIGHT_MATERIAL
    );
    newHalo.rotation.x = Math.PI / 2;
    group.add(newHalo);
  }

  // Reusable selection focus reticle (toggled in place without rebuilding node geometry)
  const focusRing = new THREE.Mesh(
    SHARED_GEOMETRIES.selectedRing,
    SELECTED_HIGHLIGHT_MATERIAL
  );
  focusRing.name = 'selection_focus_ring';
  focusRing.rotation.x = Math.PI / 2.2;
  focusRing.rotation.y = Math.PI / 8;
  focusRing.visible = isSelected || isHovered;
  group.add(focusRing);

  if (isSelected || isHovered) {
    group.scale.setScalar(isSelected ? 1.15 : 1.07);
  }

  // Crisp, always-camera-facing 3D SpriteText label
  const labelSprite = new SpriteText(node.label || node.id);
  labelSprite.name = 'node_label_sprite';
  labelSprite.fontFace = 'Plus Jakarta Sans, system-ui, sans-serif';
  labelSprite.fontWeight = '600';
  labelSprite.textHeight = 4.4;
  labelSprite.color = isSelected ? '#E0F2FE' : '#F8FAFC';
  labelSprite.backgroundColor = isSelected
    ? 'rgba(14, 165, 233, 0.34)'
    : 'rgba(3, 7, 18, 0.78)';
  labelSprite.borderColor = node.isNew
    ? 'rgba(245, 158, 11, 0.85)'
    : isSelected
      ? 'rgba(56, 189, 248, 0.9)'
      : 'rgba(148, 163, 184, 0.32)';
  labelSprite.borderWidth = 0.7;
  labelSprite.borderRadius = 4;
  labelSprite.padding = [2.2, 4.5];
  labelSprite.position.set(0, 12.8, 0);
  group.add(labelSprite);

  return group;
}

/**
 * Updates selection highlight & scale on an existing 3D node group in place,
 * avoiding costly ForceGraph3D mesh teardown/rebuilds that reset positions after cooldown.
 */
export function updateHologramNodeVisualState(
  group: THREE.Group,
  isSelected: boolean,
  isHovered: boolean
): void {
  const focusRing = group.getObjectByName('selection_focus_ring');
  if (focusRing) {
    focusRing.visible = isSelected || isHovered;
  }
  group.scale.setScalar(isSelected ? 1.15 : isHovered ? 1.07 : 1);
}

/**
 * Crisp protocol label SpriteText attached to the midpoint of each 3D link.
 */
export function buildLinkLabelSprite(link: ForceGraphLink): SpriteText {
  const sprite = new SpriteText(link.label || '');
  sprite.fontFace = 'JetBrains Mono, ui-monospace, monospace';
  sprite.fontWeight = '500';
  sprite.textHeight = 2.6;
  sprite.color = '#94A3B8';
  sprite.backgroundColor = 'rgba(3, 7, 18, 0.72)';
  sprite.padding = [1.2, 2.8];
  sprite.borderRadius = 3;
  return sprite;
}

/**
 * Creates a grounded J.A.R.V.I.S. holographic floor projection reticle beneath the graph.
 */
function createHologramFloorReticle(): THREE.Group {
  const floorGroup = new THREE.Group();
  floorGroup.name = 'holo_floor_reticle';
  floorGroup.position.y = -110;

  // Concentric telemetry rings
  const ringRadii = [55, 110, 175, 250];
  for (let i = 0; i < ringRadii.length; i += 1) {
    const r = ringRadii[i];
    const geo = new THREE.RingGeometry(r - 0.5, r + 0.5, 72);
    const mat = new THREE.MeshBasicMaterial({
      color: i === 1 ? 0x38bdf8 : 0x1e3a5f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: i === 1 ? 0.24 : 0.16,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    floorGroup.add(mesh);
  }

  // Subtle polar radial spokes
  const spokePoints: THREE.Vector3[] = [];
  const spokeCount = 8;
  for (let i = 0; i < spokeCount; i += 1) {
    const angle = (i / spokeCount) * Math.PI * 2;
    spokePoints.push(
      new THREE.Vector3(Math.cos(angle) * 55, 0.2, Math.sin(angle) * 55),
      new THREE.Vector3(Math.cos(angle) * 250, 0.2, Math.sin(angle) * 250)
    );
  }
  const spokeGeo = new THREE.BufferGeometry().setFromPoints(spokePoints);
  const spokeMat = new THREE.LineBasicMaterial({
    color: 0x1e3a5f,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  const spokes = new THREE.LineSegments(spokeGeo, spokeMat);
  floorGroup.add(spokes);

  return floorGroup;
}

export interface ForceGraph3DControlsLike {
  enableDamping?: boolean;
  dampingFactor?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  target?: THREE.Vector3;
  update?: () => void;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

export interface ForceGraph3DInstanceLike {
  scene: () => THREE.Scene;
  renderer: () => THREE.WebGLRenderer;
  camera: () => THREE.Camera;
  controls: () => ForceGraph3DControlsLike;
  zoomToFit?: (durationMs?: number, padding?: number) => void;
  cameraPosition?: (
    pos: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number },
    ms?: number
  ) => void;
  pauseAnimation?: () => void;
  resumeAnimation?: () => void;
  d3Force?: (name: string) => { distance?: (fn: number) => void; strength?: (v: number) => void } | undefined;
}

/**
 * Configures studio PBR lighting, RoomEnvironment PMREM reflections, ACES tone mapping,
 * atmospheric horizon fog, and the grounded holodeck floor reticle once per 3D mount.
 */
export function configureThreeScene(
  fg: ForceGraph3DInstanceLike,
  isSoftwareGl: boolean
): () => void {
  const scene = fg.scene();
  const renderer = fg.renderer();

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(
    isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  );

  // Subtle horizon fog matched to Obsidian #030712
  scene.fog = new THREE.FogExp2(0x030712, 0.00105);

  // Studio PBR Environment map so metallic trims & clearcoat cores catch realistic highlights
  let envRenderTarget: THREE.WebGLRenderTarget | null = null;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envRenderTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRenderTarget.texture;
    pmrem.dispose();
  } catch {
    // Fallback gracefully if PMREM unavailable
  }

  // Balanced warm/cool 3-point holographic lighting rig (added once)
  const existingRig = scene.getObjectByName('holo_lighting_rig');
  let rigGroup: THREE.Group | null = null;
  if (!existingRig) {
    rigGroup = new THREE.Group();
    rigGroup.name = 'holo_lighting_rig';

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 1.05);
    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.6);
    keyLight.position.set(160, 220, 180);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rimLight.position.set(-180, 90, -160);

    const underFill = new THREE.DirectionalLight(0x6366f1, 0.45);
    underFill.position.set(0, -140, 80);

    rigGroup.add(hemiLight, keyLight, rimLight, underFill);
    scene.add(rigGroup);
  }

  // Add floor reticle once
  let floorReticle: THREE.Group | null = null;
  if (!scene.getObjectByName('holo_floor_reticle')) {
    floorReticle = createHologramFloorReticle();
    scene.add(floorReticle);
  }

  // Spread force layout generously so labels never collide
  const chargeForce = fg.d3Force?.('charge');
  chargeForce?.strength?.(-320);
  const linkForce = fg.d3Force?.('link');
  linkForce?.distance?.(68);

  const controls = fg.controls?.();
  if (controls) {
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.65;
  }

  return () => {
    if (envRenderTarget) {
      envRenderTarget.dispose();
    }
    if (rigGroup) {
      scene.remove(rigGroup);
    }
    if (floorReticle) {
      scene.remove(floorReticle);
    }
  };
}
