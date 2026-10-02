"""
ChronoMed CLI runner.
Runs the full agentic workflow and prints a clean clinical report.

Usage:
    python scripts/run_agent.py --case-id 48
    python scripts/run_agent.py --query "hepatitis B with jaundice"
    python scripts/run_agent.py --case-id 10 --max-iterations 4
"""
import sys
import os
import argparse
import time
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.graph.workflow import get_compiled_graph


LINE = "=" * 74
SUB = "-" * 74


def _compute_status(state):
    """Returns a clean termination reason."""
    approved = state.get("critic_approved", False)
    iteration = state.get("iteration", 0)
    max_iter = state.get("max_iterations", 3)

    if approved and iteration < max_iter:
        return "APPROVED"
    if approved and iteration >= max_iter:
        return "MAX_ITERATIONS_REACHED"
    return "NOT_CONVERGED"


def _print_header(objective, case_id, max_iterations):
    print(LINE)
    print("  ChronoMed Agentic Reasoning Session")
    print(LINE)
    print(f"  Objective:       {objective}")
    print(f"  Case ID:         {case_id or '(global search)'}")
    print(f"  Max iterations:  {max_iterations}")
    print(LINE)


def _print_pipeline_progress(stage_name, extra=None):
    line = f"  [stage] {stage_name}"
    if extra:
        line += f"  ({extra})"
    print(line)


def _print_report(state, elapsed_seconds):
    status = _compute_status(state)
    timeline = state.get("clinical_timeline", "")
    hypotheses = state.get("hypotheses", [])
    chunks = state.get("retrieved_chunks", [])
    issues = state.get("critic_issues", [])
    feedback = state.get("critic_feedback", "")
    iteration = state.get("iteration", 0)

    print("\n" + LINE)
    print("  Final Report")
    print(LINE)
    print(f"  Status:              {status}")
    print(f"  Iterations used:     {iteration}")
    print(f"  Chunks retrieved:    {len(chunks)}")
    print(f"  Timeline length:     {len(timeline)} chars")
    print(f"  Total runtime:       {elapsed_seconds:.1f}s")

    print("\n" + SUB)
    print("  Clinical Timeline")
    print(SUB)
    print(timeline if timeline else "(no timeline produced)")

    print("\n" + SUB)
    print("  Differential Diagnoses")
    print(SUB)
    if not hypotheses:
        print("  (no hypotheses produced)")
    for i, h in enumerate(hypotheses, 1):
        print(f"\n  {i}. {h['diagnosis']}")
        print(f"     Confidence: {h['confidence']:.2f}")
        print(f"     Reasoning:  {h['reasoning']}")
        if h["citations"]:
            print(f"     Citations:  {', '.join(h['citations'])}")
        if h["evidence"]:
            print("     Evidence:")
            for e in h["evidence"]:
                print(f"       - {e}")

    if issues:
        print("\n" + SUB)
        print("  Critic Issues")
        print(SUB)
        for issue in issues:
            print(f"  - {issue}")

    if feedback:
        print("\n" + SUB)
        print("  Critic Feedback")
        print(SUB)
        print(f"  {feedback}")

    print("\n" + LINE)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", default="chest pain with fever")
    ap.add_argument("--case-id", default=None)
    ap.add_argument("--max-iterations", type=int, default=3)
    args = ap.parse_args()

    _print_header(args.query, args.case_id, args.max_iterations)

    app = get_compiled_graph()
    initial_state = {
        "objective": args.query,
        "case_id": args.case_id,
        "iteration": 0,
        "max_iterations": args.max_iterations,
    }

    print("\nRunning pipeline:")
    _print_pipeline_progress("historian")
    _print_pipeline_progress("diagnostician")
    _print_pipeline_progress("critic")

    start = time.time()
    try:
        final_state = app.invoke(initial_state)
    except Exception as e:
        print(f"\nPipeline error: {e}")
        return
    elapsed = time.time() - start

    _print_report(final_state, elapsed)


if __name__ == "__main__":
    main()