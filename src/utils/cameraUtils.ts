export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraPose {
  position: Vec3;
  lookAt: Vec3;
}

export interface CameraTransitionStep {
  position: Vec3;
  target: Vec3;
  arrived: boolean;
}

/**
 * Computes an angled 3/4 orbital focus camera position and lookAt target
 * for a given 3D node coordinate, safely handling nodes near or at the origin.
 */
export function computeNodeFocusPose(target: Vec3, distance = 115): CameraPose {
  const x = Number.isFinite(target.x) ? target.x : 0;
  const y = Number.isFinite(target.y) ? target.y : 0;
  const z = Number.isFinite(target.z) ? target.z : 0;

  const hyp = Math.hypot(x, y, z);
  if (hyp < 1e-3) {
    return {
      position: { x: 28, y: 24, z: distance },
      lookAt: { x: 0, y: 0, z: 0 },
    };
  }

  const distRatio = 1 + distance / hyp;
  return {
    position: {
      x: x * distRatio + 28,
      y: y * distRatio + 24,
      z: z * distRatio + 68,
    },
    lookAt: { x, y, z },
  };
}

/**
 * Frame-rate-independent exponential damping interpolation.
 */
export function dampValue(
  current: number,
  target: number,
  lambda: number,
  dt: number
): number {
  const clampedDt = Math.max(0, Math.min(dt, 0.05));
  const factor = 1 - Math.exp(-lambda * clampedDt);
  return current + (target - current) * factor;
}

/**
 * Advances a smooth camera position & lookAt target transition by `dt` seconds
 * using exponential damping, snapping cleanly once within `epsilon` world units.
 */
export function stepCameraTransition(
  currentPos: Vec3,
  currentTarget: Vec3,
  goalPos: Vec3,
  goalTarget: Vec3,
  dt: number,
  lambda = 7.5,
  epsilon = 0.25
): CameraTransitionStep {
  const nextPos: Vec3 = {
    x: dampValue(currentPos.x, goalPos.x, lambda, dt),
    y: dampValue(currentPos.y, goalPos.y, lambda, dt),
    z: dampValue(currentPos.z, goalPos.z, lambda, dt),
  };
  const nextTarget: Vec3 = {
    x: dampValue(currentTarget.x, goalTarget.x, lambda, dt),
    y: dampValue(currentTarget.y, goalTarget.y, lambda, dt),
    z: dampValue(currentTarget.z, goalTarget.z, lambda, dt),
  };

  const posDist = Math.hypot(
    goalPos.x - nextPos.x,
    goalPos.y - nextPos.y,
    goalPos.z - nextPos.z
  );
  const tgtDist = Math.hypot(
    goalTarget.x - nextTarget.x,
    goalTarget.y - nextTarget.y,
    goalTarget.z - nextTarget.z
  );

  if (posDist <= epsilon && tgtDist <= epsilon) {
    return {
      position: { ...goalPos },
      target: { ...goalTarget },
      arrived: true,
    };
  }

  return {
    position: nextPos,
    target: nextTarget,
    arrived: false,
  };
}

export interface CalloutPosition {
  left: number;
  top: number;
  placement: 'above' | 'below';
  pointerOffsetX: number;
}

/**
 * Computes a clamped viewport-relative position for a node callout card
 * anchored to `(anchorX, anchorY)`, preferring placement above the node
 * and flipping below if near the top edge, while staying clear of the bottom HUD.
 */
export function computeCalloutPosition(
  anchorX: number,
  anchorY: number,
  viewportWidth: number,
  viewportHeight: number,
  cardWidth = 280,
  cardHeight = 128,
  bottomSafeMargin = 165
): CalloutPosition {
  const edgePad = 14;
  const verticalGap = 24;

  const safeWidth = Math.max(cardWidth + edgePad * 2, viewportWidth);
  const safeHeight = Math.max(cardHeight + edgePad * 2, viewportHeight);

  const clampedAnchorX = Number.isFinite(anchorX) ? anchorX : safeWidth / 2;
  const clampedAnchorY = Number.isFinite(anchorY) ? anchorY : safeHeight / 2;

  const minLeft = edgePad;
  const maxLeft = Math.max(edgePad, safeWidth - cardWidth - edgePad);
  const left = Math.max(
    minLeft,
    Math.min(maxLeft, clampedAnchorX - cardWidth / 2)
  );

  const aboveTop = clampedAnchorY - cardHeight - verticalGap;
  const belowTop = clampedAnchorY + verticalGap;
  const maxTop = Math.max(edgePad, safeHeight - cardHeight - bottomSafeMargin);

  let placement: 'above' | 'below' = 'above';
  let top = aboveTop;

  if (aboveTop < edgePad) {
    placement = 'below';
    top = Math.min(maxTop, Math.max(edgePad, belowTop));
  } else if (aboveTop > maxTop) {
    top = maxTop;
  }

  const pointerPad = 18;
  const pointerOffsetX = Math.max(
    pointerPad,
    Math.min(cardWidth - pointerPad, clampedAnchorX - left)
  );

  return {
    left: Math.round(left),
    top: Math.round(top),
    placement,
    pointerOffsetX: Math.round(pointerOffsetX),
  };
}

