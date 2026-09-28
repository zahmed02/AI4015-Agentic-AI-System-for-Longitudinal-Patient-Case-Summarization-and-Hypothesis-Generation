"""
Schema-aware loader for MedChain with resume + auto-stop on API exhaustion.
"""
import os
import json
import time
from typing import List, Dict, Any, Optional, Callable
from langchain_core.documents import Document
from src.ingestion.translator import translate_to_english, is_chinese, TranslationFailedError
from src.ingestion.progress_tracker import (
    load_progress, save_progress, mark_success, mark_failure, reset_progress, _default_progress,
)
from src.utils.logger import get_logger

logger = get_logger(__name__)

MERGED_CASES_FILE = "merged_cases.json"
INTER_CASE_DELAY = 0.5
CONSECUTIVE_FAILURE_LIMIT = 3   # Stop after this many failures in a row


def _flatten_to_text(obj: Any) -> str:
    lines = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, (dict, list)):
                lines.append(f"\n## {k}")
                lines.append(_flatten_to_text(v))
            else:
                lines.append(f"{k}: {v}")
    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, (dict, list)):
                lines.append(_flatten_to_text(item))
            else:
                lines.append(f"- {item}")
    elif obj is not None:
        lines.append(str(obj))
    return "\n".join(lines)


def _extract_specialty(record: dict) -> str:
    tags = record.get("tags", {})
    if isinstance(tags, dict):
        dept = tags.get("科室") or tags.get("department")
        if isinstance(dept, list) and dept:
            return str(dept[0])
        if isinstance(dept, str):
            return dept
    return "unknown"


def _record_to_document(title: str, record: dict, idx: int) -> Document:
    body = _flatten_to_text(record)
    raw_text = f"# {title}\n{body}"
    english_text = translate_to_english(raw_text) if is_chinese(raw_text) else raw_text
    case_id = title.split("_", 1)[0] if "_" in title else f"case_{idx}"
    metadata = {
        "case_id": case_id,
        "title": title,
        "specialty": _extract_specialty(record),
        "source_language": "zh",
        "original_text": raw_text,
    }
    return Document(page_content=english_text, metadata=metadata)


def load_medchain(
    raw_dir: str = "./data/raw/MedChain",
    limit: Optional[int] = None,
    delay: float = INTER_CASE_DELAY,
    resume: bool = True,
    reset: bool = False,
    retry_failed: bool = True,
    stop_after_consecutive_failures: int = CONSECUTIVE_FAILURE_LIMIT,
    on_progress: Optional[Callable[[int, int, int, int], None]] = None,
) -> List[Document]:
    """
    Loads MedChain cases with resume + retry queue.

    Args:
        limit: process at most N NEW cases (relative to resume point).
               None = no limit, run until done or API limit hit.
        resume: continue from saved progress.
        reset: wipe progress first.
        retry_failed: attempt previously-failed cases first.
        stop_after_consecutive_failures: after this many in a row, assume
               API is exhausted and stop cleanly.
        on_progress: callback(idx, done_count, fail_count, remaining)
    """
    path = os.path.join(raw_dir, MERGED_CASES_FILE)
    if not os.path.exists(path):
        logger.error(f"Missing file: {path}")
        return []

    if reset:
        reset_progress()

    logger.info(f"Loading {path}")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    total = len(data)
    logger.info(f"Found {total} cases in {MERGED_CASES_FILE}")

    items = list(data.items())

    progress = load_progress() if resume else _default_progress()
    start_idx = progress["next_index"]

    if start_idx >= total:
        logger.info(f"✅ All {total} cases already processed.")
        return []

    # Build the processing order
    end_idx = total if limit is None else min(start_idx + limit, total)
    new_range = list(range(start_idx, end_idx))

    if retry_failed and progress["failed_indices"]:
        retry_list = [i for i in progress["failed_indices"] if i < end_idx]
        logger.info(f"🔁 Pre-pending {len(retry_list)} previously failed cases for retry")
        processing_order = retry_list + [i for i in new_range if i not in retry_list]
    else:
        processing_order = new_range

    logger.info(
        f"▶️  Processing {len(processing_order)} cases "
        f"(indices {processing_order[0]}..{processing_order[-1]})"
    )

    docs: List[Document] = []
    consecutive_failures = 0
    start_time = time.time()

    try:
        for step, i in enumerate(processing_order):
            title, rec = items[i]
            try:
                t0 = time.time()
                doc = _record_to_document(title, rec, i)
                docs.append(doc)
                mark_success(progress, i)
                consecutive_failures = 0
                elapsed = time.time() - t0
                logger.info(
                    f"[{step + 1}/{len(processing_order)}] "
                    f"idx={i} {title[:45]} ({elapsed:.1f}s) "
                    f"✅={progress['success_count']} ⚠️={progress['fail_count']}"
                )

                if on_progress:
                    on_progress(i, progress["success_count"], progress["fail_count"],
                                total - progress["next_index"])

            except TranslationFailedError as e:
                logger.warning(f"❌ idx={i} translation failed: {e}")
                mark_failure(progress, i)
                consecutive_failures += 1

                if consecutive_failures >= stop_after_consecutive_failures:
                    logger.warning(
                        f"⛔ {consecutive_failures} consecutive failures — "
                        f"likely API rate limit. Stopping cleanly.\n"
                        f"   Progress saved at index {progress['next_index']}. "
                        f"Rerun later to resume."
                    )
                    break

            except KeyboardInterrupt:
                logger.warning(f"\n⏸️  Interrupted at idx={i}. Progress saved.")
                save_progress(progress)
                raise

            except Exception as e:
                logger.error(f"❌ idx={i} unexpected error: {e}")
                mark_failure(progress, i)
                consecutive_failures += 1
                if consecutive_failures >= stop_after_consecutive_failures:
                    logger.warning("⛔ Too many consecutive errors. Stopping.")
                    break

            if delay and step < len(processing_order) - 1:
                time.sleep(delay)

    finally:
        save_progress(progress)

    total_time = time.time() - start_time
    logger.info(f"\n📊 Session complete in {total_time:.1f}s")
    logger.info(f"   ✅ Success: {progress['success_count']}")
    logger.info(f"   ⚠️  Failed:  {progress['fail_count']}  {progress['failed_indices'][-5:] if progress['failed_indices'] else ''}")
    logger.info(f"   ▶️  Next resume point: index {progress['next_index']}")

    return docs


if __name__ == "__main__":
    docs = load_medchain(limit=3)
    for d in docs:
        print("─" * 70)
        print("CASE:", d.metadata["case_id"], "|", d.metadata["specialty"])
        print(d.page_content[:400], "...")