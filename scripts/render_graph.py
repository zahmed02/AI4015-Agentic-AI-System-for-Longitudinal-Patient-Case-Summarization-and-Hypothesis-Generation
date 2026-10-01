"""
Renders the compiled LangGraph workflow in three forms:
1. ASCII art to the terminal (uses grandalf)
2. PNG image saved to docs/graph.png (uses mermaid.ink API)
3. Raw Mermaid definition saved to docs/graph.mmd for manual rendering

Usage:
    python scripts/render_graph.py
"""
import sys
import os
import base64
from pathlib import Path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.graph.workflow import get_compiled_graph


DOCS_DIR = Path("docs")


def render_ascii(app):
    print("=" * 70)
    print("  ASCII Graph")
    print("=" * 70)
    try:
        print(app.get_graph().draw_ascii())
    except Exception as e:
        print(f"ASCII render failed: {e}")
        graph = app.get_graph()
        print("\nNodes:")
        for n in graph.nodes:
            print(f"  - {n}")
        print("\nEdges:")
        for e in graph.edges:
            print(f"  {e.source} -> {e.target}")


def save_mermaid_source(app):
    DOCS_DIR.mkdir(exist_ok=True)
    mermaid = app.get_graph().draw_mermaid()
    out_path = DOCS_DIR / "graph.mmd"
    out_path.write_text(mermaid, encoding="utf-8")
    print(f"\nMermaid source saved to: {out_path}")
    return mermaid


def save_png(app):
    DOCS_DIR.mkdir(exist_ok=True)
    out_path = DOCS_DIR / "graph.png"
    try:
        png_bytes = app.get_graph().draw_mermaid_png()
        if not png_bytes:
            raise ValueError("draw_mermaid_png returned empty bytes")
        out_path.write_bytes(png_bytes)
        print(f"PNG image saved to:      {out_path}")
    except Exception as e:
        print(f"PNG render failed: {e}")
        print("Fallback: paste the Mermaid source into https://mermaid.live to export a PNG manually.")


def main():
    app = get_compiled_graph()
    render_ascii(app)
    save_mermaid_source(app)
    save_png(app)


if __name__ == "__main__":
    main()