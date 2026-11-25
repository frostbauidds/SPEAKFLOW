import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutAtlasPins,
  normalizeAnatomyCategory,
  validateAnatomyPayload,
} from './anatomyUtils.ts';
import { ANATOMY_ATLASES } from '../data/anatomyAtlases.ts';
import type { AnatomyPin } from '../types/anatomy.ts';

describe('anatomyUtils', () => {
  it('separates overlapping pins on the same rail without crossing order', () => {
    const crowdedPins: AnatomyPin[] = [
      {
        id: 'p1',
        label: 'Part A',
        category: 'vessel',
        side: 'left',
        x: 30,
        y: 45,
        description: 'A',
        clinicalNote: 'Note A',
      },
      {
        id: 'p2',
        label: 'Part B',
        category: 'chamber',
        side: 'left',
        x: 32,
        y: 47,
        description: 'B',
        clinicalNote: 'Note B',
      },
      {
        id: 'p3',
        label: 'Part C',
        category: 'valve',
        side: 'left',
        x: 35,
        y: 48,
        description: 'C',
        clinicalNote: 'Note C',
      },
    ];

    const { left, right } = layoutAtlasPins(crowdedPins);
    assert.equal(right.length, 0);
    assert.equal(left.length, 3);
    assert.ok(left[1].labelY - left[0].labelY >= 12);
    assert.ok(left[2].labelY - left[1].labelY >= 12);
    assert.equal(left[0].id, 'p1');
    assert.equal(left[2].id, 'p3');
  });

  it('validates and clamps Gemini anatomical annotation payloads safely', () => {
    const raw = JSON.stringify({
      title: 'Heart Cutaway',
      system: 'Cardiovascular',
      summary: 'Annotated critical heart parts.',
      pins: [
        {
          id: 'Aortic Arch',
          label: 'Aortic Arch',
          category: 'artery',
          x: 105,
          y: -5,
          description: 'Main systemic arterial arch.',
          clinicalNote: 'Coarctation narrows the arch distal to the left subclavian.',
        },
        {
          id: 'Aortic Arch',
          label: 'Duplicate Label',
          category: 'valve',
          x: 35,
          y: 50,
          description: 'Second pin.',
          clinicalNote: 'Clinical note.',
        },
      ],
    });

    const res = validateAnatomyPayload(raw);
    assert.equal(res.ok, true);
    assert.ok(res.atlas);
    assert.equal(res.atlas.pins.length, 2);
    assert.equal(res.atlas.pins[0].category, 'vessel');
    assert.equal(res.atlas.pins[0].x, 94);
    assert.equal(res.atlas.pins[0].y, 6);
    assert.equal(res.atlas.pins[0].side, 'right');
    assert.notEqual(res.atlas.pins[0].id, res.atlas.pins[1].id);
  });

  it('normalizes medical category synonyms accurately', () => {
    assert.equal(normalizeAnatomyCategory('Ventricular Chamber'), 'chamber');
    assert.equal(normalizeAnatomyCategory('Mitral Valve'), 'valve');
    assert.equal(normalizeAnatomyCategory('Cerebral Lobe'), 'neural');
    assert.equal(normalizeAnatomyCategory('Ureter Duct'), 'duct');
  });

  it('ensures all built-in 3D medical atlases have balanced, well-documented pins', () => {
    assert.ok(ANATOMY_ATLASES.length >= 3);
    for (const atlas of ANATOMY_ATLASES) {
      assert.ok(atlas.pins.length >= 10);
      const laidOut = layoutAtlasPins(atlas.pins);
      assert.ok(laidOut.left.length >= 4);
      assert.ok(laidOut.right.length >= 4);
      for (const pin of atlas.pins) {
        assert.ok(pin.x >= 5 && pin.x <= 95);
        assert.ok(pin.y >= 5 && pin.y <= 95);
        assert.ok(pin.description.length > 25);
        assert.ok(pin.clinicalNote.length > 20);
      }
    }
  });
});
