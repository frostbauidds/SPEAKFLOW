import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCalloutPosition,
  computeNodeFocusPose,
  dampValue,
  stepCameraTransition,
} from './cameraUtils.ts';

describe('cameraUtils', () => {
  it('computes a valid angled focus pose for a node at the origin', () => {
    const pose = computeNodeFocusPose({ x: 0, y: 0, z: 0 }, 115);
    assert.deepEqual(pose.lookAt, { x: 0, y: 0, z: 0 });
    assert.equal(pose.position.z, 115);
    assert.ok(Number.isFinite(pose.position.x));
    assert.ok(Number.isFinite(pose.position.y));
  });

  it('computes a finite focus pose for arbitrary 3D node coordinates', () => {
    const pose = computeNodeFocusPose({ x: 30, y: -20, z: 40 }, 100);
    assert.deepEqual(pose.lookAt, { x: 30, y: -20, z: 40 });
    const dist = Math.hypot(
      pose.position.x - pose.lookAt.x,
      pose.position.y - pose.lookAt.y,
      pose.position.z - pose.lookAt.z
    );
    assert.ok(dist > 80 && dist < 250);
  });

  it('sanitizes non-finite target coordinates safely', () => {
    const pose = computeNodeFocusPose({ x: Number.NaN, y: Infinity, z: -Infinity });
    assert.deepEqual(pose.lookAt, { x: 0, y: 0, z: 0 });
    assert.ok(Number.isFinite(pose.position.x));
    assert.ok(Number.isFinite(pose.position.y));
    assert.ok(Number.isFinite(pose.position.z));
  });

  it('clamps large frame dt spikes in dampValue to stay stable', () => {
    const stepped = dampValue(0, 100, 7.5, 2.0);
    assert.ok(stepped > 0 && stepped < 40);
  });

  it('converges smoothly and marks arrived once within epsilon', () => {
    let pos = { x: 0, y: 0, z: 300 };
    let target = { x: 0, y: 0, z: 0 };
    const goalPos = { x: 40, y: 20, z: 120 };
    const goalTarget = { x: 10, y: -5, z: 5 };

    let arrived = false;
    for (let i = 0; i < 120; i += 1) {
      const step = stepCameraTransition(pos, target, goalPos, goalTarget, 1 / 60);
      pos = step.position;
      target = step.target;
      if (step.arrived) {
        arrived = true;
        break;
      }
    }

    assert.equal(arrived, true);
    assert.deepEqual(pos, goalPos);
    assert.deepEqual(target, goalTarget);
  });

  it('places node callout centered above the node when room is available', () => {
    const pos = computeCalloutPosition(700, 400, 1440, 840, 280, 128, 165);
    assert.equal(pos.placement, 'above');
    assert.equal(pos.left, 560);
    assert.equal(pos.top, 248);
    assert.equal(pos.pointerOffsetX, 140);
  });

  it('flips node callout below when node is near the top edge and clamps horizontally', () => {
    const pos = computeCalloutPosition(40, 60, 1440, 840, 280, 128, 165);
    assert.equal(pos.placement, 'below');
    assert.equal(pos.left, 14);
    assert.equal(pos.top, 84);
    assert.equal(pos.pointerOffsetX, 26);
  });

  it('keeps node callout clear of the bottom HUD safe margin', () => {
    const pos = computeCalloutPosition(720, 810, 1440, 840, 280, 128, 165);
    assert.ok(pos.top + 128 <= 840 - 165);
  });
});
