import { sampleDiagram, shapes, type DiagramEdge, type DiagramJSON, type DiagramNode, type Shape } from "@/lib/diagram";

const VALID_SHAPES = new Set<string>(shapes);
const VALID_DIRS = new Set(["forward", "backward", "both", "none"]);
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

const DIAGRAM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["nodes", "edges"],
  properties: {
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "shape", "label", "x", "y", "width", "height"],
        properties: {
          id: { type: "string" },
          shape: { type: "string", enum: [...shapes].sort() },
          label: { type: "string" },
          x: { type: "number", minimum: 0, maximum: 1000 },
          y: { type: "number", minimum: 0, maximum: 1000 },
          width: { type: "number", minimum: 1, maximum: 1000 },
          height: { type: "number", minimum: 1, maximum: 1000 },
        },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source", "target", "label", "direction"],
        properties: {
          source: { type: "string" },
          target: { type: "string" },
          label: { type: "string" },
          direction: { type: "string", enum: ["backward", "both", "forward", "none"] },
        },
      },
    },
  },
};

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function normalizeDiagram(raw: Record<string, unknown>): DiagramJSON {
  const rawNodes = Array.isArray(raw.nodes) ? (raw.nodes as unknown[]) : [];
  const seen = new Set<string>();
  const nodes: DiagramNode[] = [];

  for (let i = 0; i < rawNodes.length; i++) {
    const n = rawNodes[i];
    if (typeof n !== "object" || n === null) continue;
    const obj = n as Record<string, unknown>;
    let id = String(obj.id ?? `node_${i + 1}`);
    if (seen.has(id)) id = `${id}_${i + 1}`;
    seen.add(id);
    const rawShape = String(obj.shape ?? "");
    const shape: Shape = VALID_SHAPES.has(rawShape) ? (rawShape as Shape) : "rectangle";
    nodes.push({
      id,
      shape,
      label: String(obj.label ?? id),
      x: clamp(obj.x, 80 + i * 120, 0, 1000),
      y: clamp(obj.y, 120, 0, 1000),
      width: clamp(obj.width, 180, 1, 1000),
      height: clamp(obj.height, 90, 1, 1000),
    });
  }

  if (nodes.length === 0) throw new Error("No valid diagram nodes found.");

  const nodeIds = new Set(nodes.map((n) => n.id));
  const rawEdges = Array.isArray(raw.edges) ? (raw.edges as unknown[]) : [];
  const edges: DiagramEdge[] = [];

  for (const e of rawEdges) {
    if (typeof e !== "object" || e === null) continue;
    const obj = e as Record<string, unknown>;
    const source = String(obj.source ?? "");
    const target = String(obj.target ?? "");
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    const rawDir = String(obj.direction ?? "forward");
    const direction = VALID_DIRS.has(rawDir)
      ? (rawDir as DiagramEdge["direction"])
      : "forward";
    edges.push({ source, target, label: String(obj.label ?? ""), direction });
  }

  return { nodes, edges };
}

function extractOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string") return data.output_text;
  const output = Array.isArray(data.output) ? data.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    const contents = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];
    for (const c of contents) {
      if (typeof c !== "object" || c === null) continue;
      const text = (c as Record<string, unknown>).text;
      if (typeof text === "string") parts.push(text);
    }
  }
  return parts.join("").trim();
}

const SYSTEM_PROMPT_IMAGE =
  "You are an expert diagram parser. Identify every diagram object and " +
  "connection in the image. Return only JSON matching the schema. " +
  "Coordinates must be normalized to a 0-1000 scale based on the image's own " +
  "width/height. Supported shapes: rectangle, diamond, circle, database, cloud, " +
  "document, actor. Choose the closest supported shape for anything else.";

const SYSTEM_PROMPT_TEXT =
  "You are an expert diagram designer. The user will describe a system, process, " +
  "or flow in text. Convert their description into a clear diagram with nodes and " +
  "edges. Lay out nodes so they do not overlap (use the full 0-1000 coordinate space). " +
  "Supported shapes: rectangle, diamond (decisions/branches), circle (start/end), " +
  "database (data stores), cloud (external/internet), document (reports/files), " +
  "actor (users/people). Return only JSON matching the schema.";

async function callOpenAIWithImage(apiKey: string, imageDataUrl: string): Promise<DiagramJSON> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT_IMAGE }] },
        {
          role: "user",
          content: [
            { type: "input_text", text: "Parse this diagram image." },
            { type: "input_image", image_url: imageDataUrl },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "diagram_json", schema: DIAGRAM_SCHEMA, strict: true } },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const outputText = extractOutputText(data);
  if (!outputText) throw new Error("OpenAI returned no structured output.");
  return normalizeDiagram(JSON.parse(outputText) as Record<string, unknown>);
}

async function callOpenAIWithText(apiKey: string, description: string): Promise<DiagramJSON> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT_TEXT }] },
        { role: "user", content: [{ type: "input_text", text: description }] },
      ],
      text: { format: { type: "json_schema", name: "diagram_json", schema: DIAGRAM_SCHEMA, strict: true } },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const outputText = extractOutputText(data);
  if (!outputText) throw new Error("OpenAI returned no structured output.");
  return normalizeDiagram(JSON.parse(outputText) as Record<string, unknown>);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const { demo, image, text } = payload;

    const apiKey = process.env.OPENAI_API_KEY;

    if (demo) {
      const diagram = normalizeDiagram(sampleDiagram as unknown as Record<string, unknown>);
      return Response.json({ diagram, source: `demo:${String(demo)}` });
    }

    if (typeof text === "string" && text.trim()) {
      if (!apiKey) {
        return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
      }
      const diagram = await callOpenAIWithText(apiKey, text.trim());
      return Response.json({ diagram, source: "openai-text" });
    }

    if (typeof image === "string" && image) {
      if (image.length > 18_000_000) {
        return Response.json({ error: "Image too large. Keep it under ~13 MB." }, { status: 413 });
      }
      if (!apiKey) {
        return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
      }
      const diagram = await callOpenAIWithImage(apiKey, image);
      return Response.json({ diagram, source: "openai-image" });
    }

    return Response.json({ error: "Provide either an image data URL or a text description." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
