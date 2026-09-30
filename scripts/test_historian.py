"""
Standalone test for the Historian agent.
Usage:
    python scripts/test_historian.py --case-id 48
    python scripts/test_historian.py --query "chest pain with fever"
"""
import sys
import os
import argparse
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.agents.historian_agent import historian_node


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
    print("  Historian Agent Test")
    print("=" * 70)
    print(f"  Objective: {args.query}")
    print(f"  Case ID:   {args.case_id}")
    print("=" * 70)

    result = historian_node(state)

    print(f"\nRetrieved chunks: {len(result['retrieved_chunks'])}")
    for c in result["retrieved_chunks"][:8]:
        print(f"  - case={c['case_id']} chunk={c['chunk_id']} score={c['score']:.3f}")

    print("\n" + "=" * 70)
    print("  Clinical Timeline")
    print("=" * 70)
    print(result["clinical_timeline"])


if __name__ == "__main__":
    main()