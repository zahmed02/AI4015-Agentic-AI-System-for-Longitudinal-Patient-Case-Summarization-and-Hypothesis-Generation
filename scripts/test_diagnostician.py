"""
Standalone test for the Diagnostician agent.
Runs Historian first, then Diagnostician, and prints both outputs.
"""
import sys
import os
import argparse
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.agents.historian_agent import historian_node
from src.agents.diagnostician_agent import diagnostician_node


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", default="chest pain with fever")
    ap.add_argument("--case-id", default=None)
    args = ap.parse_args()

    state = {
        "objective": args.query,
        "case_id": args.case_id,
    }

    print("=" * 70)
    print("  Diagnostician Agent Test")
    print("=" * 70)
    print(f"  Objective: {args.query}")
    print(f"  Case ID:   {args.case_id}")
    print("=" * 70)

    # Stage 1: Historian
    print("\n[1/2] Historian")
    print("-" * 70)
    state.update(historian_node(state))
    timeline = state.get("clinical_timeline", "")
    print(f"  Chunks retrieved: {len(state.get('retrieved_chunks', []))}")
    print(f"  Timeline length:  {len(timeline)} chars")
    print()
    print(timeline)

    # Stage 2: Diagnostician
    print("\n[2/2] Diagnostician")
    print("-" * 70)
    state.update(diagnostician_node(state))
    hypotheses = state.get("hypotheses", [])
    print(f"  Hypotheses produced: {len(hypotheses)}")

    for i, h in enumerate(hypotheses, 1):
        print(f"\n  Hypothesis {i}")
        print(f"    Diagnosis:  {h['diagnosis']}")
        print(f"    Confidence: {h['confidence']:.2f}")
        print(f"    Reasoning:  {h['reasoning']}")
        print(f"    Citations:  {', '.join(h['citations']) if h['citations'] else '(none)'}")
        print(f"    Evidence:")
        for e in h["evidence"]:
            print(f"      - {e}")


if __name__ == "__main__":
    main()