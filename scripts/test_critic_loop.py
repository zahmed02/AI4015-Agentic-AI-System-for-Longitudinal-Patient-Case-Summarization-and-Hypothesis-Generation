"""
Full loop test: Historian, then Diagnostician and Critic iterating.
Shows how hypotheses change across revision rounds.
"""
import sys
import os
import argparse
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.agents.historian_agent import historian_node
from src.agents.diagnostician_agent import diagnostician_node
from src.agents.critic_agent import critic_node


def _print_hypotheses(hypotheses, label):
    print(f"\n  {label}")
    for i, h in enumerate(hypotheses, 1):
        print(f"    {i}. {h['diagnosis']} (confidence {h['confidence']:.2f})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", default="chest pain with fever")
    ap.add_argument("--case-id", default=None)
    ap.add_argument("--max-iterations", type=int, default=3)
    args = ap.parse_args()

    state = {
        "objective": args.query,
        "case_id": args.case_id,
        "iteration": 0,
        "max_iterations": args.max_iterations,
    }

    print("=" * 70)
    print("  Full Agentic Loop Test")
    print("=" * 70)
    print(f"  Objective:      {args.query}")
    print(f"  Case ID:        {args.case_id}")
    print(f"  Max iterations: {args.max_iterations}")
    print("=" * 70)

    print("\n[Historian]")
    print("-" * 70)
    state.update(historian_node(state))
    print(f"  Chunks retrieved: {len(state.get('retrieved_chunks', []))}")
    print(f"  Timeline length:  {len(state.get('clinical_timeline', ''))} chars")

    while True:
        current_iter = state.get("iteration", 0) + 1
        print(f"\n[Iteration {current_iter}] Diagnostician")
        print("-" * 70)
        state.update(diagnostician_node(state))
        _print_hypotheses(state.get("hypotheses", []), "Hypotheses:")

        print(f"\n[Iteration {current_iter}] Critic")
        print("-" * 70)
        state.update(critic_node(state))

        approved = state.get("critic_approved")
        target = state.get("revision_target")
        print(f"  Approved:        {approved}")
        print(f"  Revision target: {target}")
        print(f"  Iteration count: {state.get('iteration')}")
        print("  Issues:")
        for issue in state.get("critic_issues", []):
            print(f"    - {issue}")
        print(f"  Feedback: {state.get('critic_feedback')}")

        if approved:
            print("\nApproved. Loop complete.")
            break
        if state.get("iteration", 0) >= args.max_iterations:
            print(f"\nMax iterations ({args.max_iterations}) reached. Stopping.")
            break
        if not state.get("should_revise"):
            print("\nCritic did not approve but did not request a revision. Stopping.")
            break

        # Clear the previous critic verdict before the next Diagnostician pass,
        # but keep critic_feedback and critic_issues so the Diagnostician can use them.
        state.pop("critic_approved", None)
        state.pop("should_revise", None)
        state.pop("revision_target", None)

    print("\n" + "=" * 70)
    print("  Final Hypotheses")
    print("=" * 70)
    for i, h in enumerate(state.get("hypotheses", []), 1):
        print(f"  {i}. {h['diagnosis']} (confidence {h['confidence']:.2f})")
        print(f"     Reasoning: {h['reasoning']}")


if __name__ == "__main__":
    main()