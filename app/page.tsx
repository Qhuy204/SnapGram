"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Braces,
  Check,
  ChevronRight,
  CloudUpload,
  CreditCard,
  Download,
  FileImage,
  LayoutDashboard,
  LogIn,
  Play,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  WandSparkles
} from "lucide-react";
import {
  sampleDiagram,
  shapes,
  type DiagramJSON,
  type DiagramNode,
  type Shape
} from "@/lib/diagram";

type ParseResponse = {
  diagram: DiagramJSON;
  source?: string;
  warning?: string;
};

type StepKey = "idle" | "capture" | "vision" | "graph" | "ready";

const stepOrder: StepKey[] = ["capture", "vision", "graph", "ready"];

const stepLabels: Record<StepKey, string> = {
  idle: "Ready",
  capture: "Capture",
  vision: "Understand",
  graph: "Build graph",
  ready: "Editable"
};

const shapeTone: Record<Shape, string> = {
  rectangle: "#007AFF",
  diamond: "#FF9F0A",
  circle: "#34C759",
  database: "#5856D6",
  cloud: "#5AC8FA",
  document: "#AF52DE",
  actor: "#FF3B30"
};

const examples = [
  {
    id: "pipeline",
    title: "Product pipeline",
    detail: "Decision-heavy diagram ready for Draw.io."
  },
  {
    id: "system",
    title: "System map",
    detail: "Services, storage, arrows, and labels."
  },
  {
    id: "whiteboard",
    title: "Whiteboard capture",
    detail: "Meeting sketch normalized into clean nodes."
  }
];

const metrics = [
  ["3 min", "average redraw saved"],
  ["7", "MVP shape types"],
  [".drawio", "export format"]
];

const featureBlocks = [
  {
    icon: FileImage,
    title: "Image to structure",
    detail: "Upload a diagram photo and SnapGram returns normalized nodes, labels, and arrows."
  },
  {
    icon: Braces,
    title: "JSON first",
    detail: "Every result is validated before it becomes editable canvas state or Draw.io XML."
  },
  {
    icon: WandSparkles,
    title: "Clean repair loop",
    detail: "Adjust labels, shapes, and layout in place before exporting the final file."
  },
  {
    icon: ShieldCheck,
    title: "Controlled export",
    detail: "Python owns the Draw.io conversion so the model never writes free-form XML."
  }
];

const plans = [
  {
    name: "Starter",
    price: "$12",
    note: "for solo builders",
    items: ["60 diagrams / month", "PNG and JPG upload", "Draw.io export", "Basic history"]
  },
  {
    name: "Pro",
    price: "$29",
    note: "for product teams",
    featured: true,
    items: ["400 diagrams / month", "Team workspace", "AI edit queue", "Priority processing"]
  },
  {
    name: "Studio",
    price: "$79",
    note: "for agencies",
    items: ["Unlimited examples", "Shared templates", "Admin controls", "SAML ready"]
  }
];

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getNodeCenter(node: DiagramNode) {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2
  };
}

function splitLabel(label: string) {
  const words = label.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 18 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 3);
}

function NodeShape({
  node,
  selected,
  onSelect
}: {
  node: DiagramNode;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = shapeTone[node.shape];
  const labelLines = splitLabel(node.label);
  const center = getNodeCenter(node);
  const common = {
    fill: "rgba(255,255,255,0.84)",
    stroke: selected ? "#007AFF" : "rgba(60,60,67,0.24)",
    strokeWidth: selected ? 4 : 2
  };

  return (
    <g className="diagram-node" onClick={onSelect} tabIndex={0} role="button">
      {node.shape === "rectangle" && (
        <rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={24}
          {...common}
        />
      )}
      {node.shape === "diamond" && (
        <polygon
          points={`${center.x},${node.y} ${node.x + node.width},${center.y} ${center.x},${
            node.y + node.height
          } ${node.x},${center.y}`}
          {...common}
        />
      )}
      {node.shape === "circle" && (
        <ellipse
          cx={center.x}
          cy={center.y}
          rx={node.width / 2}
          ry={node.height / 2}
          {...common}
        />
      )}
      {node.shape === "database" && (
        <>
          <path
            d={`M ${node.x} ${node.y + 22} C ${node.x} ${node.y - 6} ${
              node.x + node.width
            } ${node.y - 6} ${node.x + node.width} ${node.y + 22} V ${
              node.y + node.height - 22
            } C ${node.x + node.width} ${node.y + node.height + 8} ${node.x} ${
              node.y + node.height + 8
            } ${node.x} ${node.y + node.height - 22} Z`}
            {...common}
          />
          <ellipse
            cx={center.x}
            cy={node.y + 22}
            rx={node.width / 2}
            ry={22}
            fill="rgba(0,122,255,0.08)"
            stroke="rgba(60,60,67,0.22)"
            strokeWidth={2}
          />
        </>
      )}
      {node.shape === "cloud" && (
        <path
          d={`M ${node.x + 30} ${node.y + node.height * 0.62}
          C ${node.x + 12} ${node.y + node.height * 0.58}, ${node.x + 8} ${
            node.y + node.height * 0.25
          }, ${node.x + 44} ${node.y + node.height * 0.29}
          C ${node.x + 58} ${node.y - 2}, ${node.x + 118} ${
            node.y - 2
          }, ${node.x + 132} ${node.y + node.height * 0.3}
          C ${node.x + node.width - 10} ${node.y + node.height * 0.28}, ${
            node.x + node.width - 2
          } ${node.y + node.height * 0.69}, ${node.x + node.width - 42} ${
            node.y + node.height * 0.72
          }
          Z`}
          {...common}
        />
      )}
      {node.shape === "document" && (
        <path
          d={`M ${node.x} ${node.y} H ${node.x + node.width - 34} L ${
            node.x + node.width
          } ${node.y + 34} V ${node.y + node.height} H ${node.x} Z`}
          {...common}
        />
      )}
      {node.shape === "actor" && (
        <>
          <circle cx={center.x} cy={node.y + 24} r={20} {...common} />
          <path
            d={`M ${center.x} ${node.y + 44} V ${node.y + 82} M ${
              center.x - 34
            } ${node.y + 58} H ${center.x + 34} M ${center.x} ${
              node.y + 82
            } L ${center.x - 28} ${node.y + node.height} M ${center.x} ${
              node.y + 82
            } L ${center.x + 28} ${node.y + node.height}`}
            fill="none"
            stroke={selected ? "#007AFF" : "rgba(60,60,67,0.35)"}
            strokeLinecap="round"
            strokeWidth={4}
          />
        </>
      )}
      <rect
        x={node.x + 12}
        y={node.y + 10}
        width={8}
        height={Math.max(node.height - 20, 10)}
        rx={8}
        fill={tone}
        opacity="0.88"
      />
      <text
        x={center.x + 8}
        y={center.y - (labelLines.length - 1) * 10}
        textAnchor="middle"
        className="node-label"
      >
        {labelLines.map((line, index) => (
          <tspan key={line} x={center.x + 8} dy={index === 0 ? 0 : 21}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function DiagramCanvas({
  diagram,
  selectedNodeId,
  setSelectedNodeId,
  compact = false
}: {
  diagram: DiagramJSON;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string) => void;
  compact?: boolean;
}) {
  const nodesById = useMemo(
    () => new Map(diagram.nodes.map((node) => [node.id, node])),
    [diagram.nodes]
  );

  return (
    <svg
      className={classNames("diagram-svg", compact && "diagram-svg-compact")}
      viewBox="0 0 1000 620"
      role="img"
      aria-label="SnapGram diagram preview"
    >
      <defs>
        <marker
          id="arrow-forward"
          markerHeight="10"
          markerWidth="10"
          orient="auto"
          refX="9"
          refY="3"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#1C1C1E" opacity="0.55" />
        </marker>
        <marker
          id="arrow-back"
          markerHeight="10"
          markerWidth="10"
          orient="auto-start-reverse"
          refX="1"
          refY="3"
        >
          <path d="M9,0 L9,6 L0,3 z" fill="#1C1C1E" opacity="0.55" />
        </marker>
      </defs>
      <g className="grid-lines">
        {Array.from({ length: 10 }).map((_, index) => (
          <line key={`v-${index}`} x1={index * 100} y1="0" x2={index * 100} y2="620" />
        ))}
        {Array.from({ length: 7 }).map((_, index) => (
          <line key={`h-${index}`} x1="0" y1={index * 100} x2="1000" y2={index * 100} />
        ))}
      </g>
      <g>
        {diagram.edges.map((edge, index) => {
          const source = nodesById.get(edge.source);
          const target = nodesById.get(edge.target);

          if (!source || !target) {
            return null;
          }

          const start = getNodeCenter(source);
          const end = getNodeCenter(target);
          const markerEnd =
            edge.direction === "forward" || edge.direction === "both"
              ? "url(#arrow-forward)"
              : undefined;
          const markerStart =
            edge.direction === "backward" || edge.direction === "both"
              ? "url(#arrow-back)"
              : undefined;

          return (
            <g key={`${edge.source}-${edge.target}-${index}`} className="diagram-edge">
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                markerEnd={markerEnd}
                markerStart={markerStart}
              />
              {edge.label && (
                <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 10}>
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}
      </g>
      <g>
        {diagram.nodes.map((node) => (
          <NodeShape
            key={node.id}
            node={node}
            selected={node.id === selectedNodeId}
            onSelect={() => setSelectedNodeId(node.id)}
          />
        ))}
      </g>
    </svg>
  );
}

export default function Home() {
  const [diagram, setDiagram] = useState<DiagramJSON>(sampleDiagram);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    sampleDiagram.nodes[0]?.id ?? null
  );
  const [step, setStep] = useState<StepKey>("idle");
  const [imageName, setImageName] = useState("No file selected");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("local sample");
  const [navSolid, setNavSolid] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedNode = diagram.nodes.find((node) => node.id === selectedNodeId) ?? null;

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith("image/")
      );

      if (file) {
        void handleFile(file);
      }
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function focusWorkspace() {
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
  }

  async function runParse(payload: { image?: string; demo?: string; fileName?: string }) {
    setError(null);
    setStep("capture");
    await new Promise((resolve) => setTimeout(resolve, 320));
    setStep("vision");

    try {
      const response = await fetch("/api/parse-diagram", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = (await response.json()) as ParseResponse & {
        error?: string;
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(result.detail ?? result.error ?? "Parse request failed.");
      }

      setStep("graph");
      await new Promise((resolve) => setTimeout(resolve, 260));
      setDiagram(result.diagram);
      setSelectedNodeId(result.diagram.nodes[0]?.id ?? null);
      setSource(result.source ?? "python backend");
      setStep("ready");
    } catch (parseError) {
      const message =
        parseError instanceof Error ? parseError.message : "Parse request failed.";
      setError(`${message} Showing the built-in sample until the backend is running.`);
      setDiagram(sampleDiagram);
      setSelectedNodeId(sampleDiagram.nodes[0]?.id ?? null);
      setSource("local fallback");
      setStep("ready");
    }
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Choose a PNG or JPG diagram image.");
      return;
    }

    setImageName(file.name);
    const image = await fileToDataUrl(file);
    await runParse({ image, fileName: file.name });
  }

  async function handleExample(exampleId: string) {
    setImageName(`${exampleId}.png`);
    await runParse({ demo: exampleId, fileName: `${exampleId}.png` });
    focusWorkspace();
  }

  function updateSelectedNode(partial: Partial<DiagramNode>) {
    if (!selectedNode) {
      return;
    }

    setDiagram((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === selectedNode.id ? { ...node, ...partial } : node
      )
    }));
  }

  async function exportDrawio() {
    setError(null);

    try {
      const response = await fetch("/api/export-drawio", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(diagram)
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail ?? payload.error ?? "Export request failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "SnapGram.drawio";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      const message =
        exportError instanceof Error ? exportError.message : "Export request failed.";
      setError(message);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      void handleFile(file);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  }

  return (
    <main className="site-shell">
      <header className={classNames("topbar", navSolid && "topbar-solid")}>
        <a className="brand" href="#home" aria-label="SnapGram home">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>
            <strong>SnapGram</strong>
            <small>Diagram AI workspace</small>
          </span>
        </a>
        <nav className="nav-links" aria-label="Primary">
          <a href="#product">Product</a>
          <a href="#workflow">Workflow</a>
          <a href="#users">Users</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="nav-actions">
          <button className="ghost-button nav-login" type="button">
            <LogIn size={18} />
            Sign in
          </button>
          <button
            className="primary-action"
            type="button"
            onClick={() => {
              focusWorkspace();
              inputRef.current?.click();
            }}
          >
            <Sparkles size={18} />
            Start free
          </button>
        </div>
      </header>

      <section id="home" className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">SaaS for diagram recovery</p>
          <h1>Turn any diagram screenshot into an editable Draw.io file.</h1>
          <p>
            SnapGram reads flowcharts, architecture maps, and whiteboard captures,
            then gives your team a clean graph to review, adjust, and export.
          </p>
          <div className="hero-actions">
            <button
              className="primary-action large"
              type="button"
              onClick={() => {
                focusWorkspace();
                inputRef.current?.click();
              }}
            >
              <CloudUpload size={20} />
              Upload diagram
            </button>
            <button className="ghost-button large" type="button" onClick={focusWorkspace}>
              <Play size={19} />
              View workspace
            </button>
          </div>
        </div>

        <div className="hero-console" aria-label="SnapGram product preview">
          <div className="console-topline">
            <div className="window-controls" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span>snapgram.app/workspace</span>
            <BadgeCheck size={18} />
          </div>
          <div className="console-grid">
            <div className="console-capture">
              <span className="mini-icon">
                <FileImage size={18} />
              </span>
              <strong>flowchart-photo.jpg</strong>
              <small>5 nodes detected</small>
              <button type="button" onClick={() => void handleExample("pipeline")}>
                Run example
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="console-preview">
              <DiagramCanvas
                diagram={diagram}
                selectedNodeId={selectedNodeId}
                setSelectedNodeId={setSelectedNodeId}
                compact
              />
            </div>
            <div className="console-status">
              <span className="mini-icon green">
                <Check size={18} />
              </span>
              <strong>Ready for Draw.io</strong>
              <small>Validated JSON, editable geometry, XML export.</small>
            </div>
          </div>
          <div className="metric-strip">
            {metrics.map(([value, label]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="product" className="logo-band">
        <span>Built for product, platform, and consulting teams</span>
        <strong>Linear</strong>
        <strong>Vercel</strong>
        <strong>Notion</strong>
        <strong>Figma</strong>
      </section>

      <section id="workspace" className="workspace-section">
        <div className="section-intro">
          <p className="eyebrow">Product</p>
          <h2>One workspace for capture, repair, and export.</h2>
          <p>
            The SaaS surface stays quiet and focused: upload on the left, live graph in
            the center, node details on the right.
          </p>
        </div>

        <div className="app-shell" aria-label="SnapGram workspace">
          <aside className="side-panel">
            <section className="panel-section">
              <div className="section-heading">
                <span>Capture</span>
                <small>PNG or JPG</small>
              </div>
              <label
                className="dropzone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleInputChange}
                />
                <span className="upload-disc">
                  <CloudUpload size={24} />
                </span>
                <strong>Drop a diagram image</strong>
                <small>Paste from clipboard or browse a file.</small>
              </label>
              <div className="file-pill">
                <span>{imageName}</span>
              </div>
            </section>

            <section className="panel-section">
              <div className="section-heading">
                <span>Examples</span>
                <small>Demo data</small>
              </div>
              <div className="example-list">
                {examples.map((example) => (
                  <button
                    key={example.id}
                    className="example-button"
                    type="button"
                    onClick={() => void handleExample(example.id)}
                  >
                    <span>{example.title}</span>
                    <small>{example.detail}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel-section">
              <div className="section-heading">
                <span>Pipeline</span>
                <small>{source}</small>
              </div>
              <ol className="steps">
                {stepOrder.map((key, index) => {
                  const currentIndex = stepOrder.indexOf(step);
                  const done = currentIndex > index || step === "ready";
                  const active = step === key;

                  return (
                    <li key={key} className={classNames(done && "done", active && "active")}>
                      <span>{index + 1}</span>
                      {stepLabels[key]}
                    </li>
                  );
                })}
              </ol>
            </section>
          </aside>

          <section className="canvas-panel">
            <div className="canvas-toolbar">
              <div>
                <p className="eyebrow">Live graph</p>
                <h3>{diagram.nodes.length} nodes mapped from image</h3>
              </div>
              <div className="toolbar-actions">
                <button className="ghost-button" type="button" onClick={() => setDiagram(sampleDiagram)}>
                  Reset
                </button>
                <button className="primary-action" type="button" onClick={() => void exportDrawio()}>
                  <Download size={18} />
                  Export
                </button>
              </div>
            </div>

            {error && <div className="status-message">{error}</div>}

            <div className="canvas-stage">
              {step !== "idle" && step !== "ready" && (
                <div className="canvas-loading" aria-live="polite" aria-label="Processing">
                  <div className="loading-ring" />
                  <p>
                    {step === "capture"
                      ? "Reading image..."
                      : step === "vision"
                        ? "Understanding diagram..."
                        : "Building graph..."}
                  </p>
                </div>
              )}
              <DiagramCanvas
                diagram={diagram}
                selectedNodeId={selectedNodeId}
                setSelectedNodeId={setSelectedNodeId}
              />
            </div>
          </section>

          <aside className="inspector-panel">
            <section className="panel-section">
              <div className="section-heading">
                <span>Inspector</span>
                <small>{selectedNode?.id ?? "No node"}</small>
              </div>

              {selectedNode ? (
                <div className="form-stack">
                  <label>
                    Label
                    <input
                      value={selectedNode.label}
                      onChange={(event) => updateSelectedNode({ label: event.target.value })}
                    />
                  </label>
                  <label>
                    Shape
                    <select
                      value={selectedNode.shape}
                      onChange={(event) =>
                        updateSelectedNode({ shape: event.target.value as Shape })
                      }
                    >
                      {shapes.map((shape) => (
                        <option key={shape} value={shape}>
                          {shape}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="field-grid">
                    <label>
                      X
                      <input
                        type="number"
                        value={selectedNode.x}
                        onChange={(event) =>
                          updateSelectedNode({ x: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Y
                      <input
                        type="number"
                        value={selectedNode.y}
                        onChange={(event) =>
                          updateSelectedNode({ y: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label>
                      W
                      <input
                        type="number"
                        value={selectedNode.width}
                        onChange={(event) =>
                          updateSelectedNode({ width: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label>
                      H
                      <input
                        type="number"
                        value={selectedNode.height}
                        onChange={(event) =>
                          updateSelectedNode({ height: Number(event.target.value) })
                        }
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <p className="muted">Select a node on the canvas.</p>
              )}
            </section>

            <section className="panel-section json-section">
              <div className="section-heading">
                <span>Diagram JSON</span>
                <Braces size={18} />
              </div>
              <pre>{JSON.stringify(diagram, null, 2)}</pre>
            </section>
          </aside>
        </div>
      </section>

      <section id="workflow" className="feature-section">
        <div className="section-intro">
          <p className="eyebrow">Workflow</p>
          <h2>Designed like a SaaS, built like a diagram tool.</h2>
        </div>
        <div className="feature-grid">
          {featureBlocks.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="feature-card">
                <span className="feature-icon">
                  <Icon size={21} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.detail}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="users" className="user-section">
        <div className="section-intro">
          <p className="eyebrow">Users</p>
          <h2>Personal workspace, team control, shared exports.</h2>
          <p>
            SnapGram can feel individual on day one and still have the account
            surfaces a SaaS team expects.
          </p>
        </div>
        <div className="user-grid">
          <article className="account-panel">
            <div className="account-header">
              <span className="avatar">
                <UserRound size={24} />
              </span>
              <div>
                <strong>Quang Huy</strong>
                <small>Pro workspace</small>
              </div>
              <span className="plan-badge">Active</span>
            </div>
            <div className="usage-meter">
              <span style={{ width: "68%" }} />
            </div>
            <div className="account-stats">
              <div>
                <strong>272</strong>
                <small>diagrams parsed</small>
              </div>
              <div>
                <strong>18</strong>
                <small>exports this week</small>
              </div>
            </div>
          </article>

          <article className="team-panel">
            <div className="panel-title-row">
              <span className="feature-icon">
                <UsersRound size={21} />
              </span>
              <h3>Team seats</h3>
            </div>
            <ul className="check-list">
              <li>
                <Check size={17} />
                Invite reviewers before export
              </li>
              <li>
                <Check size={17} />
                Keep every diagram source and JSON revision
              </li>
              <li>
                <Check size={17} />
                Manage billing and workspace roles
              </li>
            </ul>
          </article>

          <article className="notification-panel">
            <div className="panel-title-row">
              <span className="feature-icon amber">
                <Bell size={21} />
              </span>
              <h3>Review queue</h3>
            </div>
            <div className="queue-item">
              <LayoutDashboard size={18} />
              <span>Architecture map needs label review</span>
            </div>
            <div className="queue-item">
              <CreditCard size={18} />
              <span>Plan renews after 9 days</span>
            </div>
          </article>
        </div>
      </section>

      <section id="pricing" className="pricing-section">
        <div className="section-intro">
          <p className="eyebrow">Pricing</p>
          <h2>Plans for solo recovery and team diagram ops.</h2>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <article key={plan.name} className={classNames("pricing-card", plan.featured && "featured")}>
              {plan.featured && <span className="popular-badge">Most popular</span>}
              <h3>{plan.name}</h3>
              <p>{plan.note}</p>
              <div className="price-row">
                <strong>{plan.price}</strong>
                <span>/ month</span>
              </div>
              <ul>
                {plan.items.map((item) => (
                  <li key={item}>
                    <Check size={17} />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                className={classNames(plan.featured ? "primary-action" : "ghost-button", "plan-button")}
                type="button"
                onClick={focusWorkspace}
              >
                Choose {plan.name}
                <ArrowRight size={17} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <strong>SnapGram</strong>
          <p>Diagram screenshots into editable Draw.io files.</p>
        </div>
        <nav aria-label="Footer">
          <a href="#product">Product</a>
          <a href="#users">Users</a>
          <a href="#pricing">Pricing</a>
        </nav>
      </footer>
    </main>
  );
}
