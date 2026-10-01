"""
Test the compiled LangGraph workflow end to end.
Usage:
    python scripts/test_workflow.py --case-id 48
    python scripts/test_workflow.py --query "hepatitis B with jaundice"
    python scripts/test_workflow.py --case-id 10 --max-iterations 4
"""
import sys
import os
import argparse
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.graph.workflow import get_compiled_graph


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", default="chest pain with fever")
    ap.add_argument("--case-id", default=None)
    ap.add_argument("--max-iterations", type=int, default=3)
    args = ap.parse_args()

    app = get_compiled_graph()

    initial_state = {
        "objective": args.query,
        "case_id": args.case_id,
        "iteration": 0,
        "max_iterations": args.max_iterations,
    }

    print("=" * 70)
    print("  LangGraph Workflow Test")
    print("=" * 70)
    print(f"  Objective:      {args.query}")
    print(f"  Case ID:        {args.case_id}")
    print(f"  Max iterations: {args.max_iterations}")
    print("=" * 70)

    final_state = app.invoke(initial_state)

    print("\n" + "=" * 70)
    print("  Final State Summary")
    print("=" * 70)
    print(f"  Iterations used:  {final_state.get('iteration')}")
    print(f"  Chunks retrieved: {len(final_state.get('retrieved_chunks', []))}")
    print(f"  Timeline length:  {len(final_state.get('clinical_timeline', ''))} chars")
    print(f"  Approved:         {final_state.get('critic_approved')}")
    print(f"  Critic issues:    {len(final_state.get('critic_issues', []))}")

    print("\n  Final Hypotheses:")
    for i, h in enumerate(final_state.get("hypotheses", []), 1):
        print(f"    {i}. {h['diagnosis']} (confidence {h['confidence']:.2f})")
        print(f"       {h['reasoning']}")

    if final_state.get("critic_feedback"):
        print(f"\n  Critic Feedback: {final_state.get('critic_feedback')}")


if __name__ == "__main__":
    main()