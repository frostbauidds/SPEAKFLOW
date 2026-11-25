import type {
  AnatomyAtlas,
  AnatomyCategory,
  AnatomyPin,
  LaidOutAtlasPin,
} from '../types/anatomy';
import { toSnakeCase } from './graphUtils';

export const ANATOMY_CATEGORY_META: Record<
  AnatomyCategory,
  { label: string; color: string; bg: string }
> = {
  chamber: {
    label: 'Chamber',
    color: '#818CF8',
    bg: 'rgba(129, 140, 248, 0.16)',
  },
  vessel: {
    label: 'Vessel',
    color: '#FB7185',
    bg: 'rgba(251, 113, 133, 0.16)',
  },
  valve: {
    label: 'Valve',
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.16)',
  },
  tissue: {
    label: 'Tissue Layer',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.16)',
  },
  neural: {
    label: 'Neural / Control',
    color: '#C084FC',
    bg: 'rgba(192, 132, 252, 0.16)',
  },
  organ: {
    label: 'Structure',
    color: '#34D399',
    bg: 'rgba(52, 211, 153, 0.16)',
  },
  duct: {
    label: 'Duct / Pathway',
    color: '#2DD4BF',
    bg: 'rgba(45, 212, 191, 0.16)',
  },
};

const VALID_CATEGORIES: readonly AnatomyCategory[] = [
  'chamber',
  'vessel',
  'valve',
  'tissue',
  'neural',
  'organ',
  'duct',
] as const;

export function normalizeAnatomyCategory(raw: unknown): AnatomyCategory {
  if (typeof raw !== 'string') return 'organ';
  const s = raw.trim().toLowerCase();
  if ((VALID_CATEGORIES as readonly string[]).includes(s)) {
    return s as AnatomyCategory;
  }
  if (s.includes('atrium') || s.includes('ventricle') || s.includes('chamber')) {
    return 'chamber';
  }
  if (
    s.includes('artery') ||
    s.includes('vein') ||
    s.includes('aorta') ||
    s.includes('cava') ||
    s.includes('vessel') ||
    s.includes('trunk')
  ) {
    return 'vessel';
  }
  if (s.includes('valve') || s.includes('cusp')) return 'valve';
  if (
    s.includes('wall') ||
    s.includes('septum') ||
    s.includes('myocard') ||
    s.includes('cortex') ||
    s.includes('capsule') ||
    s.includes('muscle') ||
    s.includes('apex') ||
    s.includes('layer')
  ) {
    return 'tissue';
  }
  if (
    s.includes('lobe') ||
    s.includes('brain') ||
    s.includes('nerve') ||
    s.includes('pons') ||
    s.includes('medulla') ||
    s.includes('thalam') ||
    s.includes('cerebell') ||
    s.includes('pituitary') ||
    s.includes('node')
  ) {
    return 'neural';
  }
  if (
    s.includes('calyx') ||
    s.includes('pelvis') ||
    s.includes('ureter') ||
    s.includes('tubule') ||
    s.includes('duct') ||
    s.includes('trachea') ||
    s.includes('bronch')
  ) {
    return 'duct';
  }
  return 'organ';
}

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return (min + max) / 2;
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes clean, non-overlapping vertical label positions (`labelY` in 0..100%)
 * for left and right textbook leader-line rails, preserving natural vertical ordering
 * so leader lines stay parallel and never tangle.
 */
export function layoutAtlasPins(
  pins: AnatomyPin[],
  minTop = 7,
  maxBottom = 93
): { left: LaidOutAtlasPin[]; right: LaidOutAtlasPin[] } {
  const spreadSide = (sidePins: AnatomyPin[], startIndex: number): LaidOutAtlasPin[] => {
    const sorted = [...sidePins].sort((a, b) => a.y - b.y);
    const n = sorted.length;
    if (n === 0) return [];

    const span = maxBottom - minTop;
    const minGap = Math.min(13.5, span / Math.max(n, 1));
    const ys = sorted.map((p) => clamp(p.y, minTop, maxBottom));

    // Forward pass: push overlapping labels downward
    for (let i = 1; i < n; i += 1) {
      if (ys[i] - ys[i - 1] < minGap) {
        ys[i] = ys[i - 1] + minGap;
      }
    }

    // Backward pass: keep bottom within bounds and push upward if needed
    if (ys[n - 1] > maxBottom) {
      ys[n - 1] = maxBottom;
      for (let i = n - 2; i >= 0; i -= 1) {
        if (ys[i + 1] - ys[i] < minGap) {
          ys[i] = ys[i + 1] - minGap;
        }
      }
    }

    // Final safety clamp if densely packed
    if (ys[0] < minTop) {
      const step = n > 1 ? span / (n - 1) : 0;
      for (let i = 0; i < n; i += 1) {
        ys[i] = minTop + i * step;
      }
    }

    return sorted.map((pin, idx) => ({
      ...pin,
      labelY: Number(ys[idx].toFixed(2)),
      orderIndex: startIndex + idx,
    }));
  };

  const leftRaw = pins.filter((p) => p.side === 'left');
  const rightRaw = pins.filter((p) => p.side !== 'left');

  const left = spreadSide(leftRaw, 1);
  const right = spreadSide(rightRaw, left.length + 1);
  return { left, right };
}

export interface AnatomyValidationResult {
  ok: boolean;
  atlas?: Omit<AnatomyAtlas, 'id' | 'imageUrl'>;
  error?: string;
}

/**
 * Crash-proof validator for Gemini Vision / Flash anatomical pin JSON output.
 */
export function validateAnatomyPayload(raw: unknown): AnatomyValidationResult {
  try {
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      const trimmed = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(trimmed);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Invalid anatomical response structure.' };
    }

    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.pins) || obj.pins.length === 0) {
      return { ok: false, error: 'No anatomical structures were identified.' };
    }

    const seen = new Set<string>();
    const pins: AnatomyPin[] = [];

    for (const rawPin of obj.pins) {
      if (!rawPin || typeof rawPin !== 'object') continue;
      const p = rawPin as Record<string, unknown>;
      const label =
        typeof p.label === 'string' && p.label.trim()
          ? p.label.trim().slice(0, 64)
          : '';
      if (!label) continue;

      const rawId =
        typeof p.id === 'string' && p.id.trim() ? p.id : label;
      let id = toSnakeCase(rawId);
      if (seen.has(id)) {
        id = `${id}_${pins.length + 1}`;
      }
      seen.add(id);

      const x = clamp(Number(p.x), 6, 94);
      const y = clamp(Number(p.y), 6, 94);
      const side: 'left' | 'right' =
        p.side === 'left' || p.side === 'right'
          ? p.side
          : x < 50
            ? 'left'
            : 'right';

      const description =
        typeof p.description === 'string' && p.description.trim()
          ? p.description.trim()
          : `Anatomical structure: ${label}.`;

      const clinicalNote =
        typeof p.clinicalNote === 'string' && p.clinicalNote.trim()
          ? p.clinicalNote.trim()
          : 'Important landmark for anatomical orientation and clinical assessment.';

      pins.push({
        id,
        label,
        category: normalizeAnatomyCategory(p.category),
        side,
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
        description,
        clinicalNote,
      });
    }

    if (pins.length === 0) {
      return { ok: false, error: 'Could not extract valid anatomical pins.' };
    }

    const title =
      typeof obj.title === 'string' && obj.title.trim()
        ? obj.title.trim().slice(0, 80)
        : '3D Medical Anatomy Atlas';

    const shortName =
      typeof obj.shortName === 'string' && obj.shortName.trim()
        ? obj.shortName.trim().slice(0, 36)
        : title.slice(0, 32);

    const system =
      typeof obj.system === 'string' && obj.system.trim()
        ? obj.system.trim().slice(0, 48)
        : 'Human Anatomy';

    const summary =
      typeof obj.summary === 'string' && obj.summary.trim()
        ? obj.summary.trim()
        : `Annotated ${pins.length} critical anatomical structures for study.`;

    const suggestedPrompts = Array.isArray(obj.suggestedPrompts)
      ? obj.suggestedPrompts
          .filter((s): s is string => typeof s === 'string' && Boolean(s.trim()))
          .map((s) => s.trim().slice(0, 52))
          .slice(0, 3)
      : [
          'Add clinical pathology notes to all parts',
          'Simplify explanations for first-year students',
          'Highlight high-yield exam landmarks',
        ];

    return {
      ok: true,
      atlas: {
        title,
        shortName,
        system,
        summary,
        pins: pins.slice(0, 14),
        suggestedPrompts,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Failed to parse anatomical annotations.',
    };
  }
}
