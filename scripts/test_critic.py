"""
Standalone test for the Critic agent.
Runs Historian, Diagnostician, then Critic and prints the full chain.
"""
import sys
import os
import argparse
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.agents.historian_agent import historian_node
from src.agents.diagnostician_agent import diagnostician_node
from src.agents.critic_agent import critic_node


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", default="chest pain with fever")
    ap.add_argument("--case-id", default=None)
    args = ap.parse_args()

    state = {
        "objective": args.query,
        "case_id": args.case_id,
        "iteration": 0,
        "max_iterations": 3,
    }

    print("=" * 70)
    print("  Critic Agent Test")
    print("=" * 70)
    print(f"  Objective: {args.query}")
    print(f"  Case ID:   {args.case_id}")
    print("=" * 70)

    print("\n[1/3] Historian")
    print("-" * 70)
    state.update(historian_node(state))
    print(f"  Chunks retrieved: {len(state.get('retrieved_chunks', []))}")
    print(f"  Timeline length:  {len(state.get('clinical_timeline', ''))} chars")

    print("\n[2/3] Diagnostician")
    print("-" * 70)
    state.update(diagnostician_node(state))
    hypotheses = state.get("hypotheses", [])
    print(f"  Hypotheses: {len(hypotheses)}")
    for i, h in enumerate(hypotheses, 1):
        print(f"    {i}. {h['diagnosis']} (confidence {h['confidence']:.2f})")

    print("\n[3/3] Critic")
    print("-" * 70)
    state.update(critic_node(state))
    print(f"  Approved:        {state.get('critic_approved')}")
    print(f"  Should revise:   {state.get('should_revise')}")
    print(f"  Revision target: {state.get('revision_target')}")
    print(f"  Iteration:       {state.get('iteration')}")
    print(f"\n  Issues:")
    for issue in state.get("critic_issues", []):
        print(f"    - {issue}")
    print(f"\n  Feedback: {state.get('critic_feedback')}")


if __name__ == "__main__":
    main()