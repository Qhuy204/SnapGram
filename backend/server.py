from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


HOST = os.environ.get("SNAPGRAM_BACKEND_HOST", "127.0.0.1")
PORT = int(os.environ.get("SNAPGRAM_BACKEND_PORT", "8000"))
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")

SHAPES = {"rectangle", "diamond", "circle", "database", "cloud", "document", "actor"}
DIRECTIONS = {"forward", "backward", "both", "none"}

SAMPLE_DIAGRAM: dict[str, Any] = {
    "nodes": [
        {
            "id": "capture",
            "shape": "rectangle",
            "label": "Upload image",
            "x": 70,
            "y": 120,
            "width": 180,
            "height": 82,
        },
        {
            "id": "vision",
            "shape": "rectangle",
            "label": "OpenAI vision parse",
            "x": 330,
            "y": 120,
            "width": 220,
            "height": 82,
        },
        {
            "id": "valid",
            "shape": "diamond",
            "label": "Schema valid?",
            "x": 650,
            "y": 100,
            "width": 170,
            "height": 128,
        },
        {
            "id": "preview",
            "shape": "document",
            "label": "React preview",
            "x": 365,
            "y": 330,
            "width": 190,
            "height": 96,
        },
        {
            "id": "export",
            "shape": "database",
            "label": "Draw.io XML",
            "x": 680,
            "y": 330,
            "width": 190,
            "height": 110,
        },
    ],
    "edges": [
        {"source": "capture", "target": "vision", "label": "image", "direction": "forward"},
        {"source": "vision", "target": "valid", "label": "JSON", "direction": "forward"},
        {"source": "valid", "target": "preview", "label": "yes", "direction": "forward"},
        {
            "source": "preview",
            "target": "export",
            "label": "edited graph",
            "direction": "forward",
        },
    ],
}

DIAGRAM_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["nodes", "edges"],
    "properties": {
        "nodes": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "shape", "label", "x", "y", "width", "height"],
                "properties": {
                    "id": {"type": "string"},
                    "shape": {"type": "string", "enum": sorted(SHAPES)},
                    "label": {"type": "string"},
                    "x": {"type": "number", "minimum": 0, "maximum": 1000},
                    "y": {"type": "number", "minimum": 0, "maximum": 1000},
                    "width": {"type": "number", "minimum": 1, "maximum": 1000},
                    "height": {"type": "number", "minimum": 1, "maximum": 1000},
                },
            },
        },
        "edges": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["source", "target", "label", "direction"],
                "properties": {
                    "source": {"type": "string"},
                    "target": {"type": "string"},
                    "label": {"type": "string"},
                    "direction": {
                        "type": "string",
                        "enum": sorted(DIRECTIONS),
                    },
                },
            },
        },
    },
}


def send_json(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(body)))
    handler.send_header("access-control-allow-origin", "*")
    handler.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
    handler.send_header("access-control-allow-headers", "content-type,authorization")
    handler.end_headers()
    handler.wfile.write(body)


def read_json(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("content-length", "0"))
    if length > 18_000_000:
        raise ValueError("Request is too large. Keep the image under 18 MB.")
    raw = handler.rfile.read(length)
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def clamp_number(value: Any, fallback: float, minimum: float, maximum: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return min(max(number, minimum), maximum)


def normalize_diagram(diagram: dict[str, Any]) -> dict[str, Any]:
    nodes: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, raw in enumerate(diagram.get("nodes", [])):
        if not isinstance(raw, dict):
            continue
        node_id = str(raw.get("id") or f"node_{index + 1}")
        if node_id in seen:
            node_id = f"{node_id}_{index + 1}"
        seen.add(node_id)
        shape = str(raw.get("shape") or "rectangle")
        if shape not in SHAPES:
            shape = "rectangle"
        nodes.append(
            {
                "id": node_id,
                "shape": shape,
                "label": str(raw.get("label") or node_id),
                "x": clamp_number(raw.get("x"), 80 + index * 120, 0, 1000),
                "y": clamp_number(raw.get("y"), 120, 0, 1000),
                "width": clamp_number(raw.get("width"), 180, 1, 1000),
                "height": clamp_number(raw.get("height"), 90, 1, 1000),
            }
        )

    node_ids = {node["id"] for node in nodes}
    edges: list[dict[str, Any]] = []
    for raw in diagram.get("edges", []):
        if not isinstance(raw, dict):
            continue
        source = str(raw.get("source") or "")
        target = str(raw.get("target") or "")
        if source not in node_ids or target not in node_ids:
            continue
        direction = str(raw.get("direction") or "forward")
        if direction not in DIRECTIONS:
            direction = "forward"
        edges.append(
            {
                "source": source,
                "target": target,
                "label": str(raw.get("label") or ""),
                "direction": direction,
            }
        )

    if not nodes:
        raise ValueError("No valid diagram nodes were found.")

    return {"nodes": nodes, "edges": edges}


def extract_output_text(response: dict[str, Any]) -> str:
    if isinstance(response.get("output_text"), str):
        return response["output_text"]

    fragments: list[str] = []
    for item in response.get("output", []):
        if not isinstance(item, dict):
            continue
        for content in item.get("content", []):
            if not isinstance(content, dict):
                continue
            text = content.get("text")
            if isinstance(text, str):
                fragments.append(text)
    return "\n".join(fragments).strip()


def call_openai_parse(image_data_url: str) -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return normalize_diagram(SAMPLE_DIAGRAM)

    prompt = (
        "You are an expert diagram parser. Identify every diagram object and "
        "connection in the image. Return only JSON matching the schema. "
        "Coordinates must be normalized to a 0-1000 scale. Supported shapes are "
        "rectangle, diamond, circle, database, cloud, document, actor."
    )
    payload = {
        "model": OPENAI_MODEL,
        "input": [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": prompt}],
            },
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": "Parse this diagram image."},
                    {"type": "input_image", "image_url": image_data_url},
                ],
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "diagram_json",
                "schema": DIAGRAM_SCHEMA,
                "strict": True,
            }
        },
    }

    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "authorization": f"Bearer {api_key}",
            "content-type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI request failed: {detail}") from error

    parsed = json.loads(raw)
    output_text = extract_output_text(parsed)
    if not output_text:
        raise RuntimeError("OpenAI returned no structured output.")
    return normalize_diagram(json.loads(output_text))


def style_for_shape(shape: str) -> str:
    base = (
        "whiteSpace=wrap;html=1;strokeColor=#3C3C43;fillColor=#FFFFFF;"
        "fontColor=#1C1C1E;rounded=1;arcSize=18;"
    )
    return {
        "rectangle": base,
        "diamond": base + "shape=rhombus;rounded=0;",
        "circle": base + "ellipse;shape=ellipse;",
        "database": base + "shape=cylinder3d;boundedLbl=1;backgroundOutline=1;size=15;",
        "cloud": base + "shape=cloud;",
        "document": base + "shape=document;boundedLbl=1;",
        "actor": base + "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;",
    }.get(shape, base)


def edge_style(direction: str) -> str:
    start = "none"
    end = "none"
    if direction in {"forward", "both"}:
        end = "block"
    if direction in {"backward", "both"}:
        start = "block"
    return (
        "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;"
        f"html=1;strokeColor=#3C3C43;startArrow={start};endArrow={end};"
    )


def diagram_to_drawio(diagram: dict[str, Any]) -> str:
    data = normalize_diagram(diagram)
    cells = [
        '<mxCell id="0" />',
        '<mxCell id="1" parent="0" />',
    ]

    for node in data["nodes"]:
        cell = (
            f'<mxCell id="{escape(node["id"], quote=True)}" '
            f'value="{escape(node["label"], quote=True)}" '
            f'style="{escape(style_for_shape(node["shape"]), quote=True)}" '
            'vertex="1" parent="1">'
            f'<mxGeometry x="{node["x"]}" y="{node["y"]}" '
            f'width="{node["width"]}" height="{node["height"]}" as="geometry" />'
            "</mxCell>"
        )
        cells.append(cell)

    for index, edge in enumerate(data["edges"]):
        cell = (
            f'<mxCell id="edge_{index + 1}" '
            f'value="{escape(edge["label"], quote=True)}" '
            f'style="{escape(edge_style(edge["direction"]), quote=True)}" '
            f'edge="1" parent="1" source="{escape(edge["source"], quote=True)}" '
            f'target="{escape(edge["target"], quote=True)}">'
            '<mxGeometry relative="1" as="geometry" />'
            "</mxCell>"
        )
        cells.append(cell)

    model = (
        '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" '
        'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
        'pageWidth="1100" pageHeight="850" math="0" shadow="0">'
        "<root>"
        + "".join(cells)
        + "</root></mxGraphModel>"
    )
    return (
        f'<mxfile host="app.diagrams.net" modified="{int(time.time())}" '
        'agent="SnapGram" version="24.0.0">'
        f'<diagram id="snapgram" name="SnapGram">{model}</diagram></mxfile>'
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stdout.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
        self.send_header("access-control-allow-headers", "content-type,authorization")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/health":
            send_json(self, 200, {"ok": True, "service": "snapgram-python"})
            return
        send_json(self, 404, {"error": "Not found"})

    def do_POST(self) -> None:
        try:
            payload = read_json(self)
            if self.path == "/api/parse-diagram":
                demo = payload.get("demo")
                image = payload.get("image")
                if demo:
                    diagram = normalize_diagram(SAMPLE_DIAGRAM)
                    send_json(self, 200, {"diagram": diagram, "source": f"demo:{demo}"})
                    return
                if not image:
                    send_json(self, 400, {"error": "Missing image data URL."})
                    return
                diagram = call_openai_parse(str(image))
                send_json(self, 200, {"diagram": diagram, "source": "openai"})
                return

            if self.path == "/api/export-drawio":
                xml = diagram_to_drawio(payload).encode("utf-8")
                self.send_response(200)
                self.send_header("content-type", "application/xml; charset=utf-8")
                self.send_header(
                    "content-disposition", 'attachment; filename="SnapGram.drawio"'
                )
                self.send_header("content-length", str(len(xml)))
                self.send_header("access-control-allow-origin", "*")
                self.end_headers()
                self.wfile.write(xml)
                return

            send_json(self, 404, {"error": "Not found"})
        except Exception as error:  # Keep API errors readable in the MVP.
            send_json(self, 500, {"error": str(error)})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"SnapGram Python backend running at http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
