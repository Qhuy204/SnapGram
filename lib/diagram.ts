export type Shape =
  | "rectangle"
  | "diamond"
  | "circle"
  | "database"
  | "cloud"
  | "document"
  | "actor";

export type DiagramNode = {
  id: string;
  shape: Shape;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DiagramEdge = {
  source: string;
  target: string;
  label: string;
  direction: "forward" | "backward" | "both" | "none";
};

export type DiagramJSON = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

export const shapes: Shape[] = [
  "rectangle",
  "diamond",
  "circle",
  "database",
  "cloud",
  "document",
  "actor"
];

export const sampleDiagram: DiagramJSON = {
  nodes: [
    {
      id: "capture",
      shape: "rectangle",
      label: "Upload image",
      x: 70,
      y: 120,
      width: 180,
      height: 82
    },
    {
      id: "vision",
      shape: "rectangle",
      label: "OpenAI vision parse",
      x: 330,
      y: 120,
      width: 220,
      height: 82
    },
    {
      id: "valid",
      shape: "diamond",
      label: "Schema valid?",
      x: 650,
      y: 100,
      width: 170,
      height: 128
    },
    {
      id: "preview",
      shape: "document",
      label: "React preview",
      x: 365,
      y: 330,
      width: 190,
      height: 96
    },
    {
      id: "export",
      shape: "database",
      label: "Draw.io XML",
      x: 680,
      y: 330,
      width: 190,
      height: 110
    }
  ],
  edges: [
    {
      source: "capture",
      target: "vision",
      label: "image",
      direction: "forward"
    },
    {
      source: "vision",
      target: "valid",
      label: "JSON",
      direction: "forward"
    },
    {
      source: "valid",
      target: "preview",
      label: "yes",
      direction: "forward"
    },
    {
      source: "preview",
      target: "export",
      label: "edited graph",
      direction: "forward"
    }
  ]
};
