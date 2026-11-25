import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import ForceGraph2D from 'react-force-graph-2d';
import { type Group, Vector3 } from 'three';
import {
  Boxes,
  Cpu,
  HeartPulse,
  Layers,
  PanelRightOpen,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  ArchitectureGraph,
  ForceGraphLink,
  ForceGraphNode,
  NodePosition3D,
} from '../types/graph';

type GraphViewMode = '3d' | '2d';
import {
  NODE_TYPE_META,
  createForceGraphPayload,
  extractEndpointId,
} from '../utils/graphUtils';
import {
  type ForceGraph3DInstanceLike,
  buildHologramNodeObject,
  buildLinkLabelSprite,
  configureThreeScene,
  detectSoftwareWebGL,
  updateHologramNodeVisualState,
} from '../utils/threeNodes';
import {
  type Vec3,
  computeCalloutPosition,
  computeNodeFocusPose,
  stepCameraTransition,
} from '../utils/cameraUtils';

export interface GraphViewportHandle {
  fitView: () => void;
  focusNode: (nodeId: string) => void;
  setAutoRotate: (enabled: boolean) => void;
}

interface GraphViewportProps {
  graph: ArchitectureGraph;
  viewMode: GraphViewMode;
  selectedNodeId: string | null;
  autoRotate: boolean;
  isInspectorOpen?: boolean;
  onSelectNode: (nodeId: string | null) => void;
  onOpenInspector: () => void;
  onSwitchTo2D: () => void;
  onQuickPrompt: (prompt: string) => void;
  onLoadPreset: (
    presetId: 'rag' | 'drone' | 'fintech' | 'heart' | 'nephron'
  ) => void;
}

interface ForceGraph2DInstanceLike {
  zoomToFit?: (durationMs?: number, padding?: number) => void;
  centerAt?: (x?: number, y?: number, durationMs?: number) => void;
  zoom?: (k?: number, durationMs?: number) => void;
  graph2ScreenCoords?: (x: number, y: number) => { x: number; y: number };
  d3Force?: (
    name: string
  ) => { distance?: (fn: number) => void; strength?: (v: number) => void } | undefined;
}

function drawNodeShape2D(
  ctx: CanvasRenderingContext2D,
  type: ForceGraphNode['type'],
  x: number,
  y: number,
  radius: number
) {
  ctx.beginPath();
  switch (type) {
    case 'input': {
      // Diamond
      ctx.moveTo(x, y - radius * 1.25);
      ctx.lineTo(x + radius * 1.15, y);
      ctx.lineTo(x, y + radius * 1.25);
      ctx.lineTo(x - radius * 1.15, y);
      ctx.closePath();
      break;
    }
    case 'compute': {
      // Hexagon
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + radius * 1.15 * Math.cos(angle);
        const py = y + radius * 1.15 * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'storage': {
      // Rounded Vault Cylinder Profile
      const w = radius * 1.9;
      const h = radius * 1.5;
      ctx.roundRect(x - w / 2, y - h / 2, w, h, 3);
      break;
    }
    case 'ai': {
      // Octagon Neural Core
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI / 4) * i + Math.PI / 8;
        const px = x + radius * 1.2 * Math.cos(angle);
        const py = y + radius * 1.2 * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'hardware': {
      // Chamfered IC Chip Square
      const s = radius * 1.85;
      ctx.roundRect(x - s / 2, y - s / 2, s, s, 2);
      break;
    }
    case 'output': {
      // Directional Emitter Triangle
      ctx.moveTo(x, y - radius * 1.3);
      ctx.lineTo(x + radius * 1.2, y + radius * 0.95);
      ctx.lineTo(x - radius * 1.2, y + radius * 0.95);
      ctx.closePath();
      break;
    }
  }
}

export const GraphViewport = forwardRef<GraphViewportHandle, GraphViewportProps>(
  function GraphViewport(
    {
      graph,
      viewMode,
      selectedNodeId,
      autoRotate,
      isInspectorOpen = false,
      onSelectNode,
      onOpenInspector,
      onSwitchTo2D,
      onQuickPrompt,
      onLoadPreset,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const fg3dRef = useRef<ForceGraph3DInstanceLike | null>(null);
    const fg2dRef = useRef<ForceGraph2DInstanceLike | null>(null);
    const calloutElRef = useRef<HTMLDivElement | null>(null);
    const calloutPointerRef = useRef<HTMLDivElement | null>(null);
    const calloutTrackRafRef = useRef<number | null>(null);
    const nodeGroups3DRef = useRef<Map<string, Group>>(new Map());
    const positionCache3DRef = useRef<Map<string, NodePosition3D>>(new Map());
    const positionCache2DRef = useRef<Map<string, NodePosition3D>>(new Map());
    const swPauseTimerRef = useRef<number | null>(null);
    const cameraAnimRafRef = useRef<number | null>(null);
    const [dimensions, setDimensions] = useState({ width: 1280, height: 760 });
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [webglLost, setWebglLost] = useState(false);

    const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);

    const cancelCameraTransition = useCallback(() => {
      if (cameraAnimRafRef.current !== null) {
        window.cancelAnimationFrame(cameraAnimRafRef.current);
        cameraAnimRafRef.current = null;
      }
    }, []);

    /**
     * Smoothly animates the 3D camera without passing `ms > 0` to three-render-objects.
     * Passing non-zero durations to ForceGraph3D creates internal @tweenjs/tween.js v25
     * tweens whose `_cancelCameraTweens` calls the removed `tween.remove()` method on
     * user mouse/wheel input. This controller damps camera & OrbitControls target cleanly
     * and cancels immediately whenever the user starts orbiting or zooming.
     */
    const animateCamera3D = useCallback(
      (goalPos: Vec3, goalTarget: Vec3, immediate = false) => {
        cancelCameraTransition();
        const fg = fg3dRef.current;
        if (!fg) return;

        if (immediate || isSoftwareGl) {
          fg.cameraPosition?.(goalPos, goalTarget, 0);
          fg.controls?.()?.update?.();
          return;
        }

        const camera = fg.camera?.();
        const controls = fg.controls?.();
        if (!camera) {
          fg.cameraPosition?.(goalPos, goalTarget, 0);
          return;
        }

        let lastTime = performance.now();
        const tick = (now: number) => {
          const dt = Math.max(0.001, (now - lastTime) / 1000);
          lastTime = now;

          const curPos: Vec3 = {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          };
          const curTarget: Vec3 = controls?.target
            ? {
                x: controls.target.x,
                y: controls.target.y,
                z: controls.target.z,
              }
            : { ...goalTarget };

          const step = stepCameraTransition(
            curPos,
            curTarget,
            goalPos,
            goalTarget,
            dt
          );

          camera.position.set(step.position.x, step.position.y, step.position.z);
          if (controls?.target) {
            controls.target.set(step.target.x, step.target.y, step.target.z);
            controls.update?.();
          } else {
            camera.lookAt(step.target.x, step.target.y, step.target.z);
          }

          if (step.arrived) {
            cameraAnimRafRef.current = null;
            return;
          }

          cameraAnimRafRef.current = window.requestAnimationFrame(tick);
        };

        cameraAnimRafRef.current = window.requestAnimationFrame(tick);
      },
      [cancelCameraTransition, isSoftwareGl]
    );

    const fit3DSafely = useCallback(
      (padding = 88, immediate = false) => {
        cancelCameraTransition();
        const fg = fg3dRef.current;
        if (!fg) return;

        if (immediate || isSoftwareGl) {
          fg.zoomToFit?.(0, padding);
          fg.controls?.()?.update?.();
          return;
        }

        const camera = fg.camera?.();
        const controls = fg.controls?.();
        if (!camera || !controls?.target) {
          fg.zoomToFit?.(0, padding);
          return;
        }

        // Capture current pose, compute exact fitted pose with duration=0 (no broken tweens),
        // then restore and smoothly damp toward the computed pose.
        const startPos: Vec3 = {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        };
        const startTarget: Vec3 = {
          x: controls.target.x,
          y: controls.target.y,
          z: controls.target.z,
        };

        fg.zoomToFit?.(0, padding);

        const goalPos: Vec3 = {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        };
        const goalTarget: Vec3 = {
          x: controls.target.x,
          y: controls.target.y,
          z: controls.target.z,
        };

        camera.position.set(startPos.x, startPos.y, startPos.z);
        controls.target.set(startTarget.x, startTarget.y, startTarget.z);
        controls.update?.();

        animateCamera3D(goalPos, goalTarget, false);
      },
      [animateCamera3D, cancelCameraTransition, isSoftwareGl]
    );

    const renderAndPauseSoftware3D = useCallback(
      (shouldFit = true) => {
        if (!isSoftwareGl) return;
        const fg = fg3dRef.current;
        if (!fg) return;
        if (shouldFit) {
          fg.zoomToFit?.(0, 84);
        }
        window.requestAnimationFrame(() => {
          try {
            fg.renderer?.()?.render(fg.scene(), fg.camera());
          } catch {
            // Ignore if unmounted
          }
          fg.pauseAnimation?.();
        });
      },
      [isSoftwareGl]
    );

    const scheduleSoftwarePause = useCallback(
      (delayMs = 550, shouldFit = true) => {
        if (!isSoftwareGl) return;
        if (swPauseTimerRef.current !== null) {
          window.clearTimeout(swPauseTimerRef.current);
        }
        swPauseTimerRef.current = window.setTimeout(() => {
          swPauseTimerRef.current = null;
          renderAndPauseSoftware3D(shouldFit);
        }, delayMs);
      },
      [isSoftwareGl, renderAndPauseSoftware3D]
    );

    useEffect(() => {
      return () => {
        cancelCameraTransition();
        if (calloutTrackRafRef.current !== null) {
          window.cancelAnimationFrame(calloutTrackRafRef.current);
        }
        if (swPauseTimerRef.current !== null) {
          window.clearTimeout(swPauseTimerRef.current);
        }
      };
    }, [cancelCameraTransition]);

    // CRITICAL GUARDRAIL #3: Responsive Canvas via ResizeObserver
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const updateSize = () => {
        const rect = el.getBoundingClientRect();
        const nextW = Math.max(320, Math.floor(rect.width));
        const nextH = Math.max(320, Math.floor(rect.height));
        setDimensions((prev) =>
          prev.width === nextW && prev.height === nextH
            ? prev
            : { width: nextW, height: nextH }
        );
      };

      updateSize();

      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => updateSize());
        observer.observe(el);
        return () => observer.disconnect();
      }

      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }, []);

    // Separate isolated force-graph payloads & spatial caches for 3D and 2D
    const graphData3D = useMemo(
      () => createForceGraphPayload(graph, positionCache3DRef.current),
      [graph]
    );

    const graphData2D = useMemo(
      () => createForceGraphPayload(graph, positionCache2DRef.current),
      [graph]
    );

    // Sync node positions into the corresponding spatial cache whenever nodes settle
    const snapshotPositions = useCallback(
      (nodes: ForceGraphNode[], mode: GraphViewMode) => {
        const cache =
          mode === '3d'
            ? positionCache3DRef.current
            : positionCache2DRef.current;
        for (const node of nodes) {
          if (typeof node.x === 'number' && typeof node.y === 'number') {
            cache.set(node.id, {
              x: node.x,
              y: node.y,
              z: typeof node.z === 'number' ? node.z : 0,
            });
          }
        }
      },
      []
    );

    const frame2DSafely = useCallback(
      (durationMs = 280) => {
        const fg2d = fg2dRef.current;
        if (!fg2d) return;
        // 135px margin keeps all 2D nodes inside viewport edges and clear of top bar & bottom HUD
        fg2d.zoomToFit?.(durationMs, 135);
      },
      []
    );

    // Active node for the on-canvas Title + Description callout (hover previews, click pins)
    const activeCalloutNodeId = hoveredNodeId ?? selectedNodeId;
    const isCalloutPinned = !hoveredNodeId && Boolean(selectedNodeId);

    const activeCalloutNode = useMemo(() => {
      if (!activeCalloutNodeId) return null;
      const liveList =
        viewMode === '3d' ? graphData3D.nodes : graphData2D.nodes;
      return (
        liveList.find((n) => n.id === activeCalloutNodeId) ??
        graph.nodes.find((n) => n.id === activeCalloutNodeId) ??
        null
      );
    }, [activeCalloutNodeId, graph.nodes, graphData2D.nodes, graphData3D.nodes, viewMode]);

    const activeCalloutLinks = useMemo(() => {
      if (!activeCalloutNode) return { incoming: 0, outgoing: 0 };
      let incoming = 0;
      let outgoing = 0;
      for (const link of graph.links) {
        if (link.source === activeCalloutNode.id) outgoing += 1;
        if (link.target === activeCalloutNode.id) incoming += 1;
      }
      return { incoming, outgoing };
    }, [activeCalloutNode, graph.links]);

    const activeCalloutRef = useRef<{
      node: ForceGraphNode | null;
      viewMode: GraphViewMode;
      width: number;
      height: number;
      rightInset: number;
    }>({
      node: null,
      viewMode,
      width: dimensions.width,
      height: dimensions.height,
      rightInset: isInspectorOpen ? 360 : 0,
    });

    activeCalloutRef.current = {
      node: activeCalloutNode,
      viewMode,
      width: dimensions.width,
      height: dimensions.height,
      rightInset: isInspectorOpen ? 360 : 0,
    };

    const updateCalloutScreenPosition = useCallback(() => {
      const el = calloutElRef.current;
      const {
        node,
        viewMode: mode,
        width,
        height,
        rightInset,
      } = activeCalloutRef.current;
      if (!el || !node) return;

      let anchorX: number | null = null;
      let anchorY: number | null = null;

      if (mode === '3d') {
        const fg = fg3dRef.current;
        const camera = fg?.camera?.();
        if (camera) {
          const cached = positionCache3DRef.current.get(node.id);
          const wx = typeof node.x === 'number' ? node.x : (cached?.x ?? 0);
          const wy = typeof node.y === 'number' ? node.y : (cached?.y ?? 0);
          const wz = typeof node.z === 'number' ? node.z : (cached?.z ?? 0);
          const projected = new Vector3(wx, wy + 12, wz).project(camera);
          if (projected.z <= 1) {
            anchorX = (projected.x * 0.5 + 0.5) * width;
            anchorY = (-projected.y * 0.5 + 0.5) * height;
          }
        }
      } else {
        const fg2d = fg2dRef.current;
        const cached = positionCache2DRef.current.get(node.id);
        const wx = typeof node.x === 'number' ? node.x : (cached?.x ?? 0);
        const wy = typeof node.y === 'number' ? node.y : (cached?.y ?? 0);
        const screen = fg2d?.graph2ScreenCoords?.(wx, wy);
        if (screen && Number.isFinite(screen.x) && Number.isFinite(screen.y)) {
          anchorX = screen.x;
          anchorY = screen.y;
        }
      }

      if (anchorX === null || anchorY === null) {
        el.style.opacity = '0';
        return;
      }

      const cardWidth = el.offsetWidth || 284;
      const cardHeight = el.offsetHeight || 128;
      const usableWidth = Math.max(cardWidth + 28, width - rightInset);
      const pos = computeCalloutPosition(
        anchorX,
        anchorY,
        usableWidth,
        height,
        cardWidth,
        cardHeight,
        165
      );

      el.style.transform = `translate3d(${pos.left}px, ${pos.top}px, 0)`;
      el.style.opacity = '1';

      const pointerEl = calloutPointerRef.current;
      if (pointerEl) {
        pointerEl.style.left = `${pos.pointerOffsetX - 6}px`;
        if (pos.placement === 'above') {
          pointerEl.style.top = '';
          pointerEl.style.bottom = '-6px';
          pointerEl.style.transform = 'rotate(45deg)';
          pointerEl.style.borderTop = 'none';
          pointerEl.style.borderLeft = 'none';
          pointerEl.style.borderRight = '1px solid rgba(56, 189, 248, 0.45)';
          pointerEl.style.borderBottom = '1px solid rgba(56, 189, 248, 0.45)';
        } else {
          pointerEl.style.bottom = '';
          pointerEl.style.top = '-6px';
          pointerEl.style.transform = 'rotate(45deg)';
          pointerEl.style.borderBottom = 'none';
          pointerEl.style.borderRight = 'none';
          pointerEl.style.borderTop = '1px solid rgba(56, 189, 248, 0.45)';
          pointerEl.style.borderLeft = '1px solid rgba(56, 189, 248, 0.45)';
        }
      }
    }, []);

    // Track callout smoothly for a brief window during camera animations (e.g. 2D centerAt/zoom)
    const trackCalloutTemporarily = useCallback(
      (durationMs = 620) => {
        if (calloutTrackRafRef.current !== null) {
          window.cancelAnimationFrame(calloutTrackRafRef.current);
          calloutTrackRafRef.current = null;
        }
        const endAt = performance.now() + durationMs;
        const step = () => {
          updateCalloutScreenPosition();
          if (performance.now() < endAt && activeCalloutRef.current.node) {
            calloutTrackRafRef.current = window.requestAnimationFrame(step);
          } else {
            calloutTrackRafRef.current = null;
          }
        };
        calloutTrackRafRef.current = window.requestAnimationFrame(step);
      },
      [updateCalloutScreenPosition]
    );

    // Clear stale hover state when switching 3D/2D modes
    useEffect(() => {
      setHoveredNodeId(null);
    }, [viewMode]);

    // Sync callout position whenever active node, mode, graph, inspector, or dimensions change
    useEffect(() => {
      if (!activeCalloutNode) return;
      updateCalloutScreenPosition();
      const raf = window.requestAnimationFrame(() => {
        updateCalloutScreenPosition();
      });
      return () => window.cancelAnimationFrame(raf);
    }, [
      activeCalloutNode,
      viewMode,
      dimensions.width,
      dimensions.height,
      isInspectorOpen,
      graph,
      updateCalloutScreenPosition,
    ]);

    // Configure Three.js studio lighting, RoomEnvironment, fog, floor reticle & context-loss listener once per 3D lifecycle
    const hasNodes = graph.nodes.length > 0;
    useEffect(() => {
      if (!hasNodes) return;
      const fg = fg3dRef.current;
      if (!fg) return;

      const cleanupScene = configureThreeScene(fg, isSoftwareGl);

      const canvas = fg.renderer?.()?.domElement;
      const handleContextLost = (e: Event) => {
        e.preventDefault();
        setWebglLost(true);
      };
      const handleContextRestored = () => {
        setWebglLost(false);
      };

      if (canvas) {
        canvas.addEventListener('webglcontextlost', handleContextLost, false);
        canvas.addEventListener(
          'webglcontextrestored',
          handleContextRestored,
          false
        );
      }

      const controls = fg.controls?.();
      controls?.addEventListener?.('start', cancelCameraTransition);
      controls?.addEventListener?.('change', updateCalloutScreenPosition);

      const fitTimer = window.setTimeout(() => {
        fit3DSafely(88, isSoftwareGl);
        if (isSoftwareGl) {
          renderAndPauseSoftware3D();
        }
        updateCalloutScreenPosition();
      }, 260);

      return () => {
        window.clearTimeout(fitTimer);
        cancelCameraTransition();
        controls?.removeEventListener?.('start', cancelCameraTransition);
        controls?.removeEventListener?.('change', updateCalloutScreenPosition);
        cleanupScene();
        if (canvas) {
          canvas.removeEventListener('webglcontextlost', handleContextLost);
          canvas.removeEventListener(
            'webglcontextrestored',
            handleContextRestored
          );
        }
      };
    }, [
      cancelCameraTransition,
      fit3DSafely,
      hasNodes,
      isSoftwareGl,
      renderAndPauseSoftware3D,
      updateCalloutScreenPosition,
    ]);

    // Pause hidden 3D animation when in 2D mode; redraw cleanly when switching back to 3D or resizing
    useEffect(() => {
      const fg = fg3dRef.current;
      if (!fg) return;
      if (viewMode === '2d') {
        cancelCameraTransition();
        fg.pauseAnimation?.();
      } else if (hasNodes) {
        fg.resumeAnimation?.();
        if (isSoftwareGl) {
          scheduleSoftwarePause(350);
        }
      }
    }, [
      cancelCameraTransition,
      viewMode,
      hasNodes,
      dimensions.width,
      dimensions.height,
      isSoftwareGl,
      scheduleSoftwarePause,
    ]);

    // Configure 2D force spacing and framing
    useEffect(() => {
      if (viewMode !== '2d' || !hasNodes) return;
      const fg2d = fg2dRef.current;
      if (!fg2d) return;
      fg2d.d3Force?.('charge')?.strength?.(-340);
      fg2d.d3Force?.('link')?.distance?.(78);
      const fitTimer = window.setTimeout(() => {
        frame2DSafely(280);
      }, 320);
      return () => window.clearTimeout(fitTimer);
    }, [viewMode, hasNodes, graph, frame2DSafely]);

    // Redraw cleanly on graph or selection updates in 3D
    useEffect(() => {
      if (viewMode === '3d' && fg3dRef.current && hasNodes) {
        fg3dRef.current.resumeAnimation?.();
        if (isSoftwareGl) {
          scheduleSoftwarePause(450, !selectedNodeId);
        }
      }
    }, [graphData3D, viewMode, selectedNodeId, hasNodes, isSoftwareGl, scheduleSoftwarePause]);

    // Sync auto-rotate flag on 3D OrbitControls (disabled on software WebGL)
    useEffect(() => {
      if (viewMode !== '3d' || !fg3dRef.current) return;
      const controls = fg3dRef.current.controls?.();
      if (controls) {
        controls.autoRotate = !isSoftwareGl && autoRotate;
      }
      if (!isSoftwareGl && autoRotate) {
        fg3dRef.current.resumeAnimation?.();
      }
    }, [autoRotate, viewMode, isSoftwareGl]);

    // Imperative camera controls exposed to TopBar & Voice Commands
    useImperativeHandle(
      ref,
      () => ({
        fitView: () => {
          if (viewMode === '3d' && fg3dRef.current) {
            fg3dRef.current.resumeAnimation?.();
            fit3DSafely(88, isSoftwareGl);
            scheduleSoftwarePause(280);
          } else if (viewMode === '2d' && fg2dRef.current) {
            frame2DSafely(320);
          }
        },
        focusNode: (nodeId: string) => {
          const activeNodes = viewMode === '3d' ? graphData3D.nodes : graphData2D.nodes;
          const target = activeNodes.find((n) => n.id === nodeId);
          if (!target) return;
          const x = target.x ?? 0;
          const y = target.y ?? 0;
          const z = target.z ?? 0;

          if (viewMode === '3d' && fg3dRef.current) {
            fg3dRef.current.resumeAnimation?.();
            const pose = computeNodeFocusPose({ x, y, z }, 115);
            animateCamera3D(pose.position, pose.lookAt, isSoftwareGl);
            trackCalloutTemporarily(isSoftwareGl ? 180 : 680);
            scheduleSoftwarePause(420, false);
          } else if (viewMode === '2d' && fg2dRef.current) {
            fg2dRef.current.centerAt?.(x, y, 550);
            fg2dRef.current.zoom?.(2.4, 550);
            trackCalloutTemporarily(650);
          }
        },
        setAutoRotate: (enabled: boolean) => {
          if (viewMode === '3d' && fg3dRef.current) {
            const controls = fg3dRef.current.controls?.();
            if (controls) {
              controls.autoRotate = !isSoftwareGl && enabled;
            }
          }
        },
      }),
      [
        animateCamera3D,
        fit3DSafely,
        frame2DSafely,
        graphData2D.nodes,
        graphData3D.nodes,
        isSoftwareGl,
        scheduleSoftwarePause,
        trackCalloutTemporarily,
        viewMode,
      ]
    );

    const handle3DNodeThreeObject = useCallback((rawNode: object) => {
      const node = rawNode as ForceGraphNode;
      const group = buildHologramNodeObject(node, false, false);
      nodeGroups3DRef.current.set(node.id, group);
      return group;
    }, []);

    // Update 3D selection & hover focus reticles in place without recreating node meshes
    useEffect(() => {
      for (const [id, group] of nodeGroups3DRef.current.entries()) {
        updateHologramNodeVisualState(
          group,
          id === selectedNodeId,
          id === hoveredNodeId
        );
      }
      if (isSoftwareGl && viewMode === '3d' && fg3dRef.current) {
        try {
          fg3dRef.current
            .renderer?.()
            ?.render(fg3dRef.current.scene(), fg3dRef.current.camera());
        } catch {
          // Ignore if unmounted
        }
      }
    }, [selectedNodeId, hoveredNodeId, isSoftwareGl, viewMode, graphData3D]);

    const handle3DLinkLabelObject = useCallback((rawLink: object) => {
      return buildLinkLabelSprite(rawLink as ForceGraphLink);
    }, []);

    const handle3DLinkPositionUpdate = useCallback(
      (
        sprite: unknown,
        coords: {
          start: { x: number; y: number; z: number };
          end: { x: number; y: number; z: number };
        }
      ) => {
        const obj = sprite as {
          position?: { set: (x: number, y: number, z: number) => void };
        };
        if (!obj?.position) return false;
        const midX = (coords.start.x + coords.end.x) / 2;
        const midY = (coords.start.y + coords.end.y) / 2 + 3.2;
        const midZ = (coords.start.z + coords.end.z) / 2;
        obj.position.set(midX, midY, midZ);
        return false;
      },
      []
    );

    const handle2DNodeCanvasObject = useCallback(
      (rawNode: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const node = rawNode as ForceGraphNode;
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const meta = NODE_TYPE_META[node.type] ?? NODE_TYPE_META.compute;
        const isSelected = node.id === selectedNodeId;
        const isHovered = node.id === hoveredNodeId;
        const radius = isSelected ? 9.5 : 8;

        // Subtle outer glow halo for new or selected nodes
        if (node.isNew || isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
          ctx.strokeStyle = node.isNew
            ? 'rgba(245, 158, 11, 0.92)'
            : 'rgba(56, 189, 248, 0.92)';
          ctx.lineWidth = (isSelected ? 2 : 1.5) / Math.max(globalScale * 0.7, 0.8);
          ctx.stroke();
        }

        // Outer precision ring
        ctx.beginPath();
        ctx.arc(x, y, radius + 2.2, 0, Math.PI * 2);
        ctx.strokeStyle = meta.dimColor;
        ctx.lineWidth = 1.1 / Math.max(globalScale * 0.7, 0.8);
        ctx.stroke();

        // Main architectural node geometry
        drawNodeShape2D(ctx, node.type, x, y, radius);
        ctx.fillStyle = '#0B1324';
        ctx.fill();
        ctx.lineWidth = 1.8 / Math.max(globalScale * 0.7, 0.8);
        ctx.strokeStyle = meta.color;
        ctx.stroke();

        // Inner core accent dot
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = meta.color;
        ctx.fill();

        // Crisp readable label below node
        const fontSize = Math.max(7.5, Math.min(11, 10.5 / Math.sqrt(globalScale)));
        ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
        const label = node.label || node.id;
        const textWidth = ctx.measureText(label).width;
        const padX = 4.5;
        const padY = 2;
        const boxY = y + radius + 4.5;

        ctx.fillStyle = isSelected
          ? 'rgba(14, 165, 233, 0.30)'
          : 'rgba(3, 7, 18, 0.88)';
        ctx.beginPath();
        ctx.roundRect(
          x - textWidth / 2 - padX,
          boxY,
          textWidth + padX * 2,
          fontSize + padY * 2,
          3.5
        );
        ctx.fill();

        ctx.strokeStyle = node.isNew
          ? 'rgba(245, 158, 11, 0.7)'
          : isSelected
            ? 'rgba(56, 189, 248, 0.85)'
            : 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 0.75 / Math.max(globalScale * 0.65, 0.7);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(label, x, boxY + padY);
      },
      [selectedNodeId, hoveredNodeId]
    );

    const handle2DLinkCanvasObject = useCallback(
      (rawLink: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const link = rawLink as ForceGraphLink;
        if (!link.label) return;
        const src = link.source as ForceGraphNode;
        const tgt = link.target as ForceGraphNode;
        if (
          typeof src?.x !== 'number' ||
          typeof src?.y !== 'number' ||
          typeof tgt?.x !== 'number' ||
          typeof tgt?.y !== 'number'
        ) {
          return;
        }

        const midX = (src.x + tgt.x) / 2;
        const midY = (src.y + tgt.y) / 2;
        const fontSize = Math.max(6.5, Math.min(8.8, 8 / Math.sqrt(globalScale)));
        ctx.font = `500 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
        const w = ctx.measureText(link.label).width;
        const padX = 3.2;
        const padY = 1.4;

        ctx.fillStyle = 'rgba(3, 7, 18, 0.88)';
        ctx.beginPath();
        ctx.roundRect(
          midX - w / 2 - padX,
          midY - fontSize / 2 - padY,
          w + padX * 2,
          fontSize + padY * 2,
          2.5
        );
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(link.label, midX, midY);
      },
      []
    );

    const handleEngineStop3D = useCallback(() => {
      snapshotPositions(graphData3D.nodes, '3d');
      renderAndPauseSoftware3D();
      updateCalloutScreenPosition();
    }, [
      graphData3D.nodes,
      renderAndPauseSoftware3D,
      snapshotPositions,
      updateCalloutScreenPosition,
    ]);

    const handlePointerInteract3D = useCallback(() => {
      if (isSoftwareGl && viewMode === '3d' && fg3dRef.current) {
        fg3dRef.current.resumeAnimation?.();
        scheduleSoftwarePause(750, false);
      }
    }, [isSoftwareGl, scheduleSoftwarePause, viewMode]);

    const isEmpty = !hasNodes;

    return (
      <div
        ref={containerRef}
        data-testid="graph-viewport"
        data-view-mode={viewMode}
        data-node-count={graph.nodes.length}
        data-link-count={graph.links.length}
        onPointerDown={handlePointerInteract3D}
        onWheel={handlePointerInteract3D}
        className="relative w-full h-full overflow-hidden bg-[#030712]"
        style={{
          backgroundImage:
            viewMode === '2d'
              ? 'radial-gradient(rgba(56, 189, 248, 0.14) 1px, transparent 1px)'
              : 'radial-gradient(circle at 50% 42%, rgba(14, 165, 233, 0.09) 0%, rgba(3, 7, 18, 0) 64%)',
          backgroundSize: viewMode === '2d' ? '28px 28px' : '100% 100%',
        }}
      >
        {isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 pb-36 z-10">
            <div className="max-w-xl w-full text-center space-y-6">
              <div className="mx-auto w-14 h-14 rounded-2xl border border-sky-400/30 bg-sky-950/35 flex items-center justify-center text-sky-400">
                <Boxes className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h2 className="font-[var(--font-display)] text-2xl sm:text-3xl font-semibold tracking-tight text-slate-100">
                  Hologram Canvas Ready
                </h2>
                <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto leading-relaxed">
                  Speak out loud or type any medical anatomy, organ pathway, or
                  engineering system below to project interactive nodes into 3D
                  space.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onLoadPreset('heart')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-500/15 border border-rose-400/40 text-sm font-medium text-rose-200 hover:bg-rose-500/25 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <HeartPulse className="w-4 h-4 text-rose-400" />
                  Load Human Heart (3D)
                </button>
                <button
                  type="button"
                  onClick={() => onLoadPreset('rag')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500/15 border border-sky-400/35 text-sm font-medium text-sky-200 hover:bg-sky-500/25 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  Load RAG Search Pipeline
                </button>
                <button
                  type="button"
                  onClick={() => onLoadPreset('drone')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900/80 border border-slate-700/80 text-sm font-medium text-slate-200 hover:border-sky-400/40 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Cpu className="w-4 h-4 text-amber-400" />
                  Load Autonomous Drone
                </button>
                <button
                  type="button"
                  onClick={() => onLoadPreset('fintech')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900/80 border border-slate-700/80 text-sm font-medium text-slate-200 hover:border-sky-400/40 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Load FinTech Ledger
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <p className="text-xs text-slate-500 mb-2.5">
                  Or describe a new medical or engineering diagram with Gemini Flash
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    'Map the human respiratory system from trachea and bronchi to alveolar gas exchange',
                    'Build a live multiplayer game backend with WebSockets, matchmaker, and Redis',
                    'Trace a spinal reflex arc from skin pain receptor to motor neuron and muscle',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => onQuickPrompt(prompt)}
                      className="text-xs text-slate-300 bg-slate-900/75 border border-slate-800 hover:border-sky-500/40 hover:text-sky-200 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Keep 3D WebGL mounted across 3D/2D switches to avoid WebGL context leaks */}
            {webglLost && viewMode === '3d' ? (
              <div className="absolute inset-0 flex items-center justify-center p-6 z-10">
                <div className="max-w-md w-full rounded-xl border border-amber-500/30 bg-[#081020] p-6 text-center space-y-4">
                  <h2 className="font-[var(--font-display)] text-lg font-semibold text-amber-200">
                    WebGL 3D Context Interrupted
                  </h2>
                  <p className="text-sm text-slate-400">
                    Your browser paused hardware 3D acceleration. Switch to the 2D
                    Schematic renderer to continue editing without losing your
                    diagram.
                  </p>
                  <button
                    type="button"
                    onClick={onSwitchTo2D}
                    className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-semibold text-sm hover:bg-sky-400 transition-colors cursor-pointer"
                  >
                    Switch to 2D Schematic
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={
                  viewMode === '3d'
                    ? 'absolute inset-0'
                    : 'absolute inset-0 opacity-0 pointer-events-none'
                }
                aria-hidden={viewMode !== '3d'}
              >
                <ForceGraph3D
                  ref={fg3dRef as never}
                  controlType="orbit"
                  width={dimensions.width}
                  height={dimensions.height}
                  graphData={graphData3D}
                  backgroundColor="rgba(0,0,0,0)"
                  rendererConfig={{
                    antialias: !isSoftwareGl,
                    powerPreference: 'high-performance',
                    alpha: true,
                    preserveDrawingBuffer: isSoftwareGl,
                  }}
                  showNavInfo={false}
                  warmupTicks={isSoftwareGl ? 55 : 15}
                  cooldownTicks={isSoftwareGl ? 15 : 120}
                  nodeId="id"
                  nodeThreeObject={handle3DNodeThreeObject}
                  nodeThreeObjectExtend={false}
                  linkColor={(rawLink: object) => {
                    const l = rawLink as ForceGraphLink;
                    const srcId = extractEndpointId(l.source);
                    const tgtId = extractEndpointId(l.target);
                    if (
                      selectedNodeId &&
                      (srcId === selectedNodeId || tgtId === selectedNodeId)
                    ) {
                      return 'rgba(56, 189, 248, 0.92)';
                    }
                    return 'rgba(148, 163, 184, 0.42)';
                  }}
                  linkWidth={(rawLink: object) => {
                    const l = rawLink as ForceGraphLink;
                    const srcId = extractEndpointId(l.source);
                    const tgtId = extractEndpointId(l.target);
                    return selectedNodeId &&
                      (srcId === selectedNodeId || tgtId === selectedNodeId)
                      ? 2.2
                      : 1.2;
                  }}
                  linkOpacity={0.72}
                  linkDirectionalArrowLength={4.2}
                  linkDirectionalArrowRelPos={0.86}
                  linkDirectionalArrowColor={() => '#38BDF8'}
                  linkDirectionalParticles={isSoftwareGl ? 0 : 2}
                  linkDirectionalParticleWidth={2.0}
                  linkDirectionalParticleSpeed={0.005}
                  linkDirectionalParticleColor={() => '#38BDF8'}
                  linkThreeObjectExtend={true}
                  linkThreeObject={handle3DLinkLabelObject}
                  linkPositionUpdate={handle3DLinkPositionUpdate}
                  onNodeClick={(rawNode: object) => {
                    const n = rawNode as ForceGraphNode;
                    onSelectNode(n.id);
                  }}
                  onNodeHover={(rawNode: object | null) => {
                    const n = rawNode as ForceGraphNode | null;
                    setHoveredNodeId(n?.id ?? null);
                    if (containerRef.current) {
                      containerRef.current.style.cursor = n ? 'pointer' : 'grab';
                    }
                  }}
                  onBackgroundClick={() => onSelectNode(null)}
                  onEngineStop={handleEngineStop3D}
                />
              </div>
            )}

            {viewMode === '2d' && (
              <div className="absolute inset-0">
                <ForceGraph2D
                  ref={fg2dRef as never}
                  width={dimensions.width}
                  height={dimensions.height}
                  graphData={graphData2D}
                  backgroundColor="rgba(0,0,0,0)"
                  warmupTicks={40}
                  cooldownTicks={60}
                  nodeId="id"
                  nodeRelSize={10}
                  nodeCanvasObject={handle2DNodeCanvasObject}
                  nodeCanvasObjectMode={() => 'replace'}
                  linkColor={(rawLink: object) => {
                    const l = rawLink as ForceGraphLink;
                    const srcId = extractEndpointId(l.source);
                    const tgtId = extractEndpointId(l.target);
                    if (
                      selectedNodeId &&
                      (srcId === selectedNodeId || tgtId === selectedNodeId)
                    ) {
                      return 'rgba(56, 189, 248, 0.92)';
                    }
                    return 'rgba(148, 163, 184, 0.38)';
                  }}
                  linkWidth={(rawLink: object) => {
                    const l = rawLink as ForceGraphLink;
                    const srcId = extractEndpointId(l.source);
                    const tgtId = extractEndpointId(l.target);
                    return selectedNodeId &&
                      (srcId === selectedNodeId || tgtId === selectedNodeId)
                      ? 2.2
                      : 1.3;
                  }}
                  linkDirectionalArrowLength={5.5}
                  linkDirectionalArrowRelPos={0.85}
                  linkDirectionalArrowColor={() => '#38BDF8'}
                  linkDirectionalParticles={2}
                  linkDirectionalParticleWidth={2.5}
                  linkDirectionalParticleSpeed={0.005}
                  linkDirectionalParticleColor={() => '#38BDF8'}
                  linkCanvasObjectMode={() => 'after'}
                  linkCanvasObject={handle2DLinkCanvasObject}
                  onNodeClick={(rawNode: object) => {
                    const n = rawNode as ForceGraphNode;
                    onSelectNode(n.id);
                  }}
                  onNodeHover={(rawNode: object | null) => {
                    const n = rawNode as ForceGraphNode | null;
                    setHoveredNodeId(n?.id ?? null);
                    if (containerRef.current) {
                      containerRef.current.style.cursor = n ? 'pointer' : 'grab';
                    }
                  }}
                  onBackgroundClick={() => onSelectNode(null)}
                  onZoom={updateCalloutScreenPosition}
                  onNodeDrag={updateCalloutScreenPosition}
                  onEngineStop={() => {
                    snapshotPositions(graphData2D.nodes, '2d');
                    frame2DSafely(240);
                    trackCalloutTemporarily(320);
                  }}
                />
              </div>
            )}

            {/* Anchored On-Node Holographic Title & Description Callout (Both 3D & 2D, Hover & Click) */}
            {activeCalloutNode && (
              <div
                ref={calloutElRef}
                data-testid="node-callout"
                data-node-id={activeCalloutNode.id}
                data-pinned={isCalloutPinned ? 'true' : 'false'}
                className={`absolute top-0 left-0 z-20 w-[284px] max-w-[calc(100vw-28px)] rounded-xl border bg-[#060E1F]/95 shadow-[0_14px_38px_rgba(0,0,0,0.72)] transition-opacity duration-150 ${
                  isCalloutPinned
                    ? 'pointer-events-auto border-sky-400/55'
                    : 'pointer-events-none border-sky-400/40'
                }`}
                style={{ opacity: 0, willChange: 'transform' }}
              >
                {/* Connector Pointer */}
                <div
                  ref={calloutPointerRef}
                  aria-hidden="true"
                  className="absolute w-3 h-3 bg-[#060E1F]"
                />

                <div className="p-3.5 space-y-2">
                  {/* Category + Pin/Dismiss Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            (
                              NODE_TYPE_META[activeCalloutNode.type] ??
                              NODE_TYPE_META.compute
                            ).color,
                          boxShadow: `0 0 8px ${
                            (
                              NODE_TYPE_META[activeCalloutNode.type] ??
                              NODE_TYPE_META.compute
                            ).color
                          }`,
                        }}
                      />
                      <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-wider text-sky-300/90 truncate">
                        {
                          (
                            NODE_TYPE_META[activeCalloutNode.type] ??
                            NODE_TYPE_META.compute
                          ).label
                        }
                      </span>
                      {activeCalloutNode.isNew && (
                        <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 shrink-0">
                          New
                        </span>
                      )}
                    </div>

                    {isCalloutPinned && (
                      <button
                        type="button"
                        onClick={() => onSelectNode(null)}
                        aria-label="Close node description"
                        className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Node Title */}
                  <h3 className="font-[var(--font-display)] text-sm font-semibold text-slate-50 leading-snug tracking-tight">
                    {activeCalloutNode.label || activeCalloutNode.id}
                  </h3>

                  {/* Node Description */}
                  <p className="text-xs leading-relaxed text-slate-300">
                    {activeCalloutNode.description?.trim() ||
                      'Architecture component in the current system blueprint.'}
                  </p>

                  {/* Footer Metadata / Action */}
                  <div className="pt-2 border-t border-slate-800/85 flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-[var(--font-mono)] text-slate-400">
                      {activeCalloutLinks.incoming} in · {activeCalloutLinks.outgoing} out
                    </span>
                    {isCalloutPinned ? (
                      <button
                        type="button"
                        onClick={onOpenInspector}
                        className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 font-medium transition-colors cursor-pointer"
                      >
                        <PanelRightOpen className="w-3 h-3" />
                        Inspect
                      </button>
                    ) : (
                      <span className="text-slate-500">Click node to pin</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);
