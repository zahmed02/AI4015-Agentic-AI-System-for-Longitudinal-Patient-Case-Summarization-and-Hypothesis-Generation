"""
Prints the compiled graph as ASCII art.
Usage:
    python scripts/render_graph.py
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.graph.workflow import get_compiled_graph


def main():
    app = get_compiled_graph()
    print("=" * 70)
    print("  ChronoMed LangGraph Structure")
    print("=" * 70)
    try:
        print(app.get_graph().draw_ascii())
    except Exception as e:
        print(f"ASCII render not available: {e}")
        print("\nFallback: node and edge listing")
        graph = app.get_graph()
        print("\nNodes:")
        for n in graph.nodes:
            print(f"  - {n}")
        print("\nEdges:")
        for e in graph.edges:
            print(f"  {e.source} -> {e.target}")


if __name__ == "__main__":
    main()