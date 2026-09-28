"""
Tracks ingestion progress with retry queue.
Atomic writes so Ctrl+C never loses work.
"""
import json
import os
import tempfile
import datetime
from pathlib import Path
from typing import Dict, Any, List
from src.utils.logger import get_logger

logger = get_logger(__name__)

PROGRESS_PATH = Path("./data/processed/ingest_progress.json")


def _default_progress() -> Dict[str, Any]:
    return {
        "next_index": 0,             # next un-attempted index
        "success_count": 0,
        "fail_count": 0,
        "failed_indices": [],        # retry queue
        "started_at": None,
        "last_updated": None,
    }


def load_progress() -> Dict[str, Any]:
    if not PROGRESS_PATH.exists():
        return _default_progress()
    try:
        with open(PROGRESS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        logger.info(
            f"📂 Resumed: next_index={data['next_index']} | "
            f"✅ {data['success_count']} done | "
            f"⚠️ {data['fail_count']} failed"
        )
        return data
    except Exception as e:
        logger.error(f"Failed to load progress: {e}. Starting fresh.")
        return _default_progress()


def save_progress(progress: Dict[str, Any]) -> None:
    PROGRESS_PATH.parent.mkdir(parents=True, exist_ok=True)
    progress["last_updated"] = datetime.datetime.now().isoformat()
    if progress["started_at"] is None:
        progress["started_at"] = progress["last_updated"]

    fd, tmp_path = tempfile.mkstemp(dir=PROGRESS_PATH.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(progress, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, PROGRESS_PATH)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


def mark_success(progress: Dict[str, Any], idx: int) -> None:
    progress["success_count"] += 1
    progress["next_index"] = idx + 1
    # If this was a retry, remove from failed queue
    if idx in progress["failed_indices"]:
        progress["failed_indices"].remove(idx)
    save_progress(progress)


def mark_failure(progress: Dict[str, Any], idx: int) -> None:
    progress["fail_count"] += 1
    progress["next_index"] = idx + 1
    if idx not in progress["failed_indices"]:
        progress["failed_indices"].append(idx)
    save_progress(progress)


def reset_progress() -> None:
    if PROGRESS_PATH.exists():
        PROGRESS_PATH.unlink()
    logger.info("🔄 Progress reset.")