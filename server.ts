import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  sanitizeGraphForSerialization,
  validateAndNormalizeGraph,
} from './src/utils/graphUtils.ts';
import { validateAnatomyPayload } from './src/utils/anatomyUtils.ts';
import type { ArchitectureGraph } from './src/types/graph.ts';
import type { AnatomyAtlas } from './src/types/anatomy.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const GRAPH_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Short, crisp architecture title (2-6 words).',
    },
    summary: {
      type: Type.STRING,
      description: '1-sentence summary of the incremental edit just performed.',
    },
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: 'Unique snake_case identifier.',
          },
          label: {
            type: Type.STRING,
            description: 'Human-readable display name (2-4 words).',
          },
          type: {
            type: Type.STRING,
            description:
              'Exactly one of: input, compute, storage, ai, hardware, output.',
          },
          description: {
            type: Type.STRING,
            description: 'Concise 1-sentence technical role of this component.',
          },
          isNew: {
            type: Type.BOOLEAN,
            description:
              'True only for nodes newly added or materially modified in this edit; false for unchanged existing nodes.',
          },
        },
        required: ['id', 'label', 'type', 'description', 'isNew'],
      },
    },
    links: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          source: {
            type: Type.STRING,
            description: 'Existing node id where data/signal originates.',
          },
          target: {
            type: Type.STRING,
            description: 'Existing node id where data/signal flows.',
          },
          label: {
            type: Type.STRING,
            description: 'Short protocol, bus, or data flow label (e.g. gRPC, SPI, SSE, SQL).',
          },
        },
        required: ['source', 'target', 'label'],
      },
    },
  },
  required: ['title', 'summary', 'nodes', 'links'],
};

const SYSTEM_INSTRUCTION = `You are a Principal Systems Architect and Medical Anatomy & Physiology Educator powering a live 3D holographic diagram whiteboard.
Your task is to incrementally update a directed 3D/2D node-link diagram based on the user's spoken or typed instruction.

Strict Rules:
1. INCREMENTAL PRESERVATION: Keep ALL existing nodes (with their exact same snake_case IDs) and existing links UNLESS the user explicitly asks to remove, replace, or redesign them from scratch.
2. When the current graph is empty (or when the user asks to create a brand-new subject/organ/system), build a clean, well-structured 6-12 node diagram matching the user's description.
3. Support BOTH Engineering (software architectures, distributed systems, hardware circuits, ML algorithms) AND Medical/Life Sciences (human anatomy, organ systems like heart/lungs/brain/kidney nephron, blood circulation, neural pathways, cellular/biochemical cycles, and pharmacology mechanisms) seamlessly.
4. Set "isNew": true ONLY for newly added or explicitly modified nodes; set "isNew": false for untouched existing nodes.
5. Every node "type" MUST be exactly one of: "input", "compute", "storage", "ai", "hardware", "output".
   - For Medical/Anatomy diagrams, map roles clearly:
     * "input": venous inflow, sensory receptors, afferent pathways, stimuli, drug administration
     * "compute": active chambers (atria/ventricles), processing organs, metabolic/tubular steps, enzymatic stages
     * "storage": capillary/alveolar exchange beds, reservoirs, ion gradients, membranes, vesicle/glycogen stores
     * "ai": electrical/neural control centers, pacemaker nodes (SA/AV), CNS centers, hormone/endocrine regulators
     * "hardware": structural conduits, valves, vessels, bones, barriers, filtration membranes
     * "output": arterial outflow (aorta), efferent effectors, excretion pathways, physiological outputs
6. Every link "source" and "target" MUST reference an existing node "id" present in the returned "nodes" array. Never emit dangling links or duplicate node IDs.
7. Keep node labels crisp (2-4 words), always provide a clear, accurate, informative 1-sentence "description" for every node explaining its exact role or physiological function (never empty or repeating the label), and keep link labels to short protocols, valves, vessels, signals, or pathways (e.g., "Tricuspid Valve", "Oxygenated Blood", "Action Potential", "gRPC", "SPI Bus").
8. Return ONLY valid JSON matching the required schema.`;

const ANATOMY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Clear anatomical diagram title (e.g. "Human Heart — Anterior Cutaway").',
    },
    shortName: {
      type: Type.STRING,
      description: 'Short 2-3 word specimen name for tab buttons.',
    },
    system: {
      type: Type.STRING,
      description: 'Body system name (e.g. "Cardiovascular System", "Nervous System").',
    },
    summary: {
      type: Type.STRING,
      description: '1-sentence educational summary of the anatomical diagram.',
    },
    pins: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Unique snake_case anatomical ID.' },
          label: { type: Type.STRING, description: 'Accurate medical structure name.' },
          category: {
            type: Type.STRING,
            description: 'One of: chamber, vessel, valve, tissue, neural, organ, duct.',
          },
          side: {
            type: Type.STRING,
            description: 'Either "left" or "right" depending on which side of the image the structure sits.',
          },
          x: {
            type: Type.NUMBER,
            description: 'Exact horizontal percentage coordinate (0 to 100) of the structure center on the image.',
          },
          y: {
            type: Type.NUMBER,
            description: 'Exact vertical percentage coordinate (0 to 100) of the structure center on the image.',
          },
          description: {
            type: Type.STRING,
            description: 'Clear 1-2 sentence anatomical and physiological explanation for medical students.',
          },
          clinicalNote: {
            type: Type.STRING,
            description: 'High-yield clinical correlation, pathology, or medical exam pearl for teaching.',
          },
        },
        required: [
          'id',
          'label',
          'category',
          'side',
          'x',
          'y',
          'description',
          'clinicalNote',
        ],
      },
    },
    suggestedPrompts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3 concise study or teaching follow-up prompts (under 42 characters each).',
    },
  },
  required: ['title', 'shortName', 'system', 'summary', 'pins', 'suggestedPrompts'],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/graph/update', async (req, res) => {
    const body = req.body as {
      currentGraph?: ArchitectureGraph;
      instruction?: unknown;
    };

    const instruction =
      typeof body?.instruction === 'string' ? body.instruction.trim() : '';

    if (!instruction) {
      res.status(400).json({ error: 'Instruction is required.' });
      return;
    }

    if (instruction.length > 2000) {
      res
        .status(400)
        .json({ error: 'Instruction is too long (max 2000 characters).' });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const cleanCurrent = sanitizeGraphForSerialization(
      body.currentGraph ?? {
        title: 'New Hologram Whiteboard',
        summary: '',
        nodes: [],
        links: [],
      }
    );

    const userPrompt = `CURRENT ARCHITECTURE GRAPH (JSON):
${JSON.stringify(cleanCurrent, null, 2)}

NEW USER INSTRUCTION:
"${instruction}"

Return the complete updated architecture graph JSON following all incremental rules.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: GRAPH_RESPONSE_SCHEMA,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const rawText = response.text?.trim() ?? '';
      const validation = validateAndNormalizeGraph(rawText, body.currentGraph);

      if (!validation.ok || !validation.graph) {
        res.status(502).json({
          error:
            validation.error ||
            'Model returned an invalid graph payload. Kept previous state.',
        });
        return;
      }

      res.json({
        graph: validation.graph,
        meta: {
          droppedLinks: validation.droppedLinks ?? 0,
          deduplicatedNodes: validation.deduplicatedNodes ?? 0,
        },
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected Gemini API error.';
      console.error('[HoloArch] /api/graph/update error:', message);

      const lower = message.toLowerCase();
      if (lower.includes('429') || lower.includes('resource_exhausted')) {
        res.status(429).json({
          error: 'Rate limit reached on Gemini API. Please retry in a moment.',
        });
        return;
      }
      if (
        lower.includes('403') ||
        lower.includes('permission_denied') ||
        lower.includes('api_key_invalid')
      ) {
        res.status(403).json({
          error:
            'Gemini API key was rejected. Check GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      res.status(502).json({
        error: 'Unable to synthesize architecture update right now. Retrying or try again.',
      });
    }
  });

  // Free-tier Gemini Vision endpoint: auto-detects critical anatomical structures on any uploaded medical image
  app.post('/api/anatomy/annotate', async (req, res) => {
    const body = req.body as { imageDataUrl?: unknown; fileName?: unknown };
    const imageDataUrl =
      typeof body?.imageDataUrl === 'string' ? body.imageDataUrl.trim() : '';
    const fileName =
      typeof body?.fileName === 'string' ? body.fileName.trim() : '';

    const dataUrlMatch = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
      imageDataUrl
    );
    if (!dataUrlMatch) {
      res
        .status(400)
        .json({ error: 'Please upload a valid PNG, JPEG, or WebP medical image.' });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const mimeType = dataUrlMatch[1] === 'image/jpg' ? 'image/jpeg' : dataUrlMatch[1];
    const base64Data = dataUrlMatch[2];

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: `Identify the 8 to 12 most critical anatomical structures visible in this medical illustration${fileName ? ` (filename hint: "${fileName}")` : ''} for medical students and teachers.
For each structure, provide its exact center coordinate (x from 0 to 100 left-to-right, y from 0 to 100 top-to-bottom) on the actual anatomical feature in the image, choose "left" or "right" balanced between both sides, and write a clear physiological explanation plus a high-yield clinical/exam pearl.`,
            },
          ],
        },
        config: {
          systemInstruction:
            'You are a Senior Medical Anatomy Professor creating interactive textbook leader-line diagrams. Return ONLY valid JSON matching the schema with accurate anatomical coordinates (0-100%) on the visible specimen.',
          responseMimeType: 'application/json',
          responseSchema: ANATOMY_RESPONSE_SCHEMA,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const validation = validateAnatomyPayload(response.text ?? '');
      if (!validation.ok || !validation.atlas) {
        res.status(502).json({
          error:
            validation.error ||
            'Could not extract anatomical pins from the uploaded image.',
        });
        return;
      }

      res.json({ atlas: validation.atlas });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected Gemini API error.';
      console.error('[HoloArch] /api/anatomy/annotate error:', message);
      res.status(502).json({
        error: 'Unable to annotate this medical image right now. Please try again.',
      });
    }
  });

  // Free-tier Gemini endpoint: updates/enriches teaching explanations & clinical notes on the active 3D anatomy atlas
  app.post('/api/anatomy/update', async (req, res) => {
    const body = req.body as {
      currentAtlas?: AnatomyAtlas;
      instruction?: unknown;
    };
    const instruction =
      typeof body?.instruction === 'string' ? body.instruction.trim() : '';

    if (!instruction || !body?.currentAtlas) {
      res
        .status(400)
        .json({ error: 'Current anatomy atlas and teaching instruction are required.' });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const cleanAtlas = {
      title: body.currentAtlas.title,
      shortName: body.currentAtlas.shortName,
      system: body.currentAtlas.system,
      summary: body.currentAtlas.summary,
      pins: body.currentAtlas.pins,
    };

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `CURRENT 3D MEDICAL ANATOMY ATLAS (JSON):
${JSON.stringify(cleanAtlas, null, 2)}

TEACHER / STUDENT INSTRUCTION:
"${instruction}"

Preserve accurate (x, y) coordinates for existing anatomical structures unless explicitly asked to remove/focus a subset, and update the explanations, clinical notes, or summary to fulfill the teaching request.`,
        config: {
          systemInstruction:
            'You are a Senior Medical Anatomy & Physiology Professor customizing an interactive 3D anatomical textbook diagram for students and teachers. Preserve exact (x, y) pin coordinates on the specimen image unless asked to filter/focus specific structures. Return ONLY valid JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: ANATOMY_RESPONSE_SCHEMA,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const validation = validateAnatomyPayload(response.text ?? '');
      if (!validation.ok || !validation.atlas) {
        res.status(502).json({
          error:
            validation.error ||
            'Could not apply medical teaching update. Kept previous atlas.',
        });
        return;
      }

      res.json({ atlas: validation.atlas });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected Gemini API error.';
      console.error('[HoloArch] /api/anatomy/update error:', message);
      res.status(502).json({
        error: 'Unable to update anatomy notes right now. Please try again.',
      });
    }
  });

  if (IS_PRODUCTION) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HoloArch] Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[HoloArch] Fatal startup error:', err);
  process.exit(1);
});
