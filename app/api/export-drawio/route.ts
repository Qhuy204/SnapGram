import type { DiagramEdge, DiagramJSON, DiagramNode, Shape } from "@/lib/diagram";
import { shapes } from "@/lib/diagram";

const VALID_SHAPES = new Set<string>(shapes);
const VALID_DIRS = new Set(["forward", "backward", "both", "none"]);

function escX(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SHAPE_STYLE: Record<Shape, string> = {
  rectangle:
    "whiteSpace=wrap;html=1;strokeColor=#3C3C43;fillColor=#FFFFFF;fontColor=#1C1C1E;rounded=1;arcSize=18;",
  diamond:
    "whiteSpace=wrap;html=1;strokeColor=#3C3C43;fillColor=#FFFFFF;fontColor=#1C1C1E;shape=rhombus;rounded=0;",
  circle:
    "whiteSpace=wrap;html=1;strokeColor=#3C3C43;fillColor=#FFFFFF;fontColor=#1C1C1E;ellipse;",
  database:
    "whiteSpace=wrap;html=1;strokeColor=#3C3C43;fillColor=#FFFFFF;fontColor=#1C1C1E;shape=cylinder3d;boundedLbl=1;backgroundOutline=1;size=15;",
  cloud:
    "whiteSpace=wrap;html=1;strokeColor=#3C3C43;fillColor=#FFFFFF;fontColor=#1C1C1E;shape=cloud;",
  document:
    "whiteSpace=wrap;html=1;strokeColor=#3C3C43;fillColor=#FFFFFF;fontColor=#1C1C1E;shape=document;boundedLbl=1;",
  actor:
    "whiteSpace=wrap;html=1;strokeColor=#3C3C43;fillColor=#FFFFFF;fontColor=#1C1C1E;shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;",
};

function edgeStyle(direction: DiagramEdge["direction"]): string {
  const start = direction === "backward" || direction === "both" ? "block" : "none";
  const end = direction === "forward" || direction === "both" ? "block" : "none";
  return (
    "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;" +
    `html=1;strokeColor=#3C3C43;startArrow=${start};endArrow=${end};`
  );
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function normalizeNode(raw: Record<string, unknown>, index: number): DiagramNode | null {
  if (typeof raw !== "object" || raw === null) return null;
  let id = String(raw.id ?? `node_${index + 1}`);
  if (!id) id = `node_${index + 1}`;
  const rawShape = String(raw.shape ?? "");
  const shape: Shape = VALID_SHAPES.has(rawShape) ? (rawShape as Shape) : "rectangle";
  return {
    id,
    shape,
    label: String(raw.label ?? id),
    x: clamp(raw.x, 80 + index * 120, 0, 1000),
    y: clamp(raw.y, 120, 0, 1000),
    width: clamp(raw.width, 180, 1, 1000),
    height: clamp(raw.height, 90, 1, 1000),
  };
}

function diagramToDrawio(input: unknown): string {
  const raw = input as Record<string, unknown>;
  const rawNodes = Array.isArray(raw.nodes) ? (raw.nodes as unknown[]) : [];

  const seenIds = new Set<string>();
  const nodes: DiagramNode[] = [];
  for (let i = 0; i < rawNodes.length; i++) {
    const node = normalizeNode(rawNodes[i] as Record<string, unknown>, i);
    if (!node) continue;
    if (seenIds.has(node.id)) node.id = `${node.id}_${i + 1}`;
    seenIds.add(node.id);
    nodes.push(node);
  }

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

  const cells: string[] = ['<mxCell id="0" />', '<mxCell id="1" parent="0" />'];

  for (const node of nodes) {
    const style = escX(SHAPE_STYLE[node.shape] ?? SHAPE_STYLE.rectangle);
    cells.push(
      `<mxCell id="${escX(node.id)}" value="${escX(node.label)}" style="${style}" vertex="1" parent="1">` +
        `<mxGeometry x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" as="geometry" />` +
        `</mxCell>`
    );
  }

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const style = escX(edgeStyle(edge.direction));
    cells.push(
      `<mxCell id="edge_${i + 1}" value="${escX(edge.label)}" style="${style}" ` +
        `edge="1" parent="1" source="${escX(edge.source)}" target="${escX(edge.target)}">` +
        `<mxGeometry relative="1" as="geometry" /></mxCell>`
    );
  }

  const model =
    `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" ` +
    `tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" ` +
    `pageWidth="1100" pageHeight="850" math="0" shadow="0">` +
    `<root>${cells.join("")}</root></mxGraphModel>`;

  const ts = Math.floor(Date.now() / 1000);
  return (
    `<mxfile host="app.diagrams.net" modified="${ts}" agent="SnapGram" version="24.0.0">` +
    `<diagram id="snapgram" name="SnapGram">${model}</diagram></mxfile>`
  );
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as DiagramJSON;
    const xml = diagramToDrawio(payload);
    const bytes = new TextEncoder().encode(xml);

    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "content-disposition": 'attachment; filename="SnapGram.drawio"',
        "content-length": String(bytes.byteLength),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
