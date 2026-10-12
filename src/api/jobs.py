"""
In-memory background runner for long agentic analyses.
The LangGraph workflow is streamed node by node, so the frontend can show a
real reasoning trace instead of a blind 3-5 minute wait.
Jobs live in memory: restarting the API clears them.
"""
import threading
import time
import uuid
from typing import Any, Callable, Dict, Optional, Tuple

from langgraph.graph import END

from src.graph.workflow import route_after_critic
from src.utils.logger import get_logger

logger = get_logger(__name__)

MAX_STORED_JOBS = 50
_jobs: Dict[str, Dict[str, Any]] = {}
_lock = threading.Lock()


def _create_job(objective: str, case_id: Optional[str], max_iterations: int) -> str:
    job_id = uuid.uuid4().hex[:12]
    with _lock:
        _jobs[job_id] = {
            "job_id": job_id,
            "status": "running",
            "current_stage": "historian",
            "events": [],
            "result": None,
            "error": None,
            "objective": objective,
            "case_id": case_id,
            "max_iterations": max_iterations,
            "started_at": time.time(),
            "finished_at": None,
        }
        overflow = len(_jobs) - MAX_STORED_JOBS
        if overflow > 0:
            finished = sorted(
                (j for j in _jobs.values() if j["status"] != "running"),
                key=lambda j: j["started_at"],
            )
            for old in finished[:overflow]:
                _jobs.pop(old["job_id"], None)
    return job_id


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        snapshot = dict(job)
        snapshot["events"] = list(job["events"])
        end = job["finished_at"] or time.time()
        snapshot["elapsed_seconds"] = round(end - job["started_at"], 1)
        return snapshot


def _describe(node: str, update: Dict[str, Any]) -> Tuple[str, str, Dict[str, Any]]:
    if node == "historian":
        chunks = update.get("retrieved_chunks", [])
        timeline = update.get("clinical_timeline", "")
        return (
            "Historian built the clinical timeline",
            f"{len(chunks)} excerpts retrieved, {len(timeline)} characters of timeline",
            {"chunks": len(chunks)},
        )
    if node == "diagnostician":
        hyps = update.get("hypotheses", [])
        return (
            "Diagnostician proposed hypotheses",
            f"{len(hyps)} differential diagnoses ranked by confidence",
            {"hypotheses": [{"diagnosis": h["diagnosis"], "confidence": h["confidence"]} for h in hyps]},
        )
    if node == "critic":
        approved = bool(update.get("critic_approved"))
        issues = list(update.get("critic_issues", []))
        target = update.get("revision_target", "none")
        if approved and not issues:
            title = "Critic approved the hypotheses"
        elif approved:
            title = "Iteration limit reached, accepted with open concerns"
        elif update.get("should_revise"):
            title = f"Critic requested a revision from the {target}"
        else:
            title = "Critic could not approve the hypotheses"
        return (
            title,
            f"Review round {update.get('iteration', '?')}: {len(issues)} issue(s) raised",
            {
                "approved": approved,
                "issues": issues,
                "feedback": update.get("critic_feedback", ""),
                "revision_target": target,
                "iteration": update.get("iteration"),
            },
        )
    return (node, "", {})


def _next_stage(node: str, state: Dict[str, Any]) -> Optional[str]:
    if node == "historian":
        return "diagnostician"
    if node == "diagnostician":
        return "critic"
    if node == "critic":
        nxt = route_after_critic(state)
        return None if nxt == END else nxt
    return None


def _run(job_id: str, graph, initial_state: Dict[str, Any], build_result: Callable[[Dict[str, Any], float], Dict[str, Any]]):
    start = time.time()
    state: Dict[str, Any] = dict(initial_state)
    try:
        for chunk in graph.stream(initial_state, stream_mode="updates"):
            for node, update in chunk.items():
                if not isinstance(update, dict):
                    continue
                state.update(update)
                title, detail, data = _describe(node, update)
                nxt = _next_stage(node, state)
                with _lock:
                    job = _jobs[job_id]
                    job["events"].append({
                        "id": len(job["events"]) + 1,
                        "t": round(time.time() - start, 1),
                        "agent": node,
                        "title": title,
                        "detail": detail,
                        "data": data,
                    })
                    job["current_stage"] = nxt
        result = build_result(state, time.time() - start)
        with _lock:
            job = _jobs[job_id]
            job["status"] = "completed"
            job["result"] = result
            job["current_stage"] = None
            job["finished_at"] = time.time()
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        with _lock:
            job = _jobs[job_id]
            job["status"] = "failed"
            job["error"] = str(e)
            job["current_stage"] = None
            job["finished_at"] = time.time()


def start_job(graph, objective: str, case_id: Optional[str], max_iterations: int,
              build_result: Callable[[Dict[str, Any], float], Dict[str, Any]]) -> str:
    job_id = _create_job(objective, case_id, max_iterations)
    initial_state = {
        "objective": objective,
        "case_id": case_id,
        "iteration": 0,
        "max_iterations": max_iterations,
    }
    threading.Thread(
        target=_run, args=(job_id, graph, initial_state, build_result), daemon=True
    ).start()
    return job_id