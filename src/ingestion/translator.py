"""
Chinese → English medical translator.
- Primary: Groq / openai/gpt-oss-120b (generous free-tier TPM)
- Fallback: Groq / qwen/qwen3.8-27b (Chinese-native)
- Last resort: Gemini 3.8-flash
- Global rate limiter + exponential backoff + disk cache
"""
import os
import json
import time
import hashlib
import threading
from pathlib import Path
from collections import deque
from functools import lru_cache
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

class TranslationFailedError(Exception):
    """Raised when every translation provider fails."""
    pass

load_dotenv()

GROQ_KEY = os.getenv("GROQ_API_KEY")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

CACHE_PATH = Path("./data/processed/translation_cache.jsonl")
CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)

# Cap input length to avoid huge-token calls (chars, not tokens)
MAX_INPUT_CHARS = 8000

# Rate limiter: max 15 requests per minute (well under Groq's free tier)
RATE_LIMIT_MAX = 15
RATE_LIMIT_WINDOW = 60  # seconds

SYSTEM_PROMPT = """You are a professional medical translator.
Translate the following Chinese clinical case into English.
Rules:
- Use standard English medical terminology (e.g., "hypertension", not "high blood pressure").
- Preserve ALL dates, medication names, dosages, lab values, numerical values EXACTLY.
- Preserve the markdown structure (## headings, - bullet points) of the original.
- Output ONLY the translated English text. No preamble, no explanations.
"""

# ─── Rate limiter (sliding window) ───────────────────────
_rate_lock = threading.Lock()
_recent_calls: deque = deque()


def _wait_for_rate_limit():
    """Blocks until we're allowed to make another call."""
    with _rate_lock:
        now = time.time()
        # Drop calls outside the window
        while _recent_calls and now - _recent_calls[0] > RATE_LIMIT_WINDOW:
            _recent_calls.popleft()
        if len(_recent_calls) >= RATE_LIMIT_MAX:
            sleep_for = RATE_LIMIT_WINDOW - (now - _recent_calls[0]) + 0.5
            if sleep_for > 0:
                print(f"[translator] rate limiter: sleeping {sleep_for:.1f}s")
                time.sleep(sleep_for)
        _recent_calls.append(time.time())


# ─── Disk cache ──────────────────────────────────────────
_CACHE: dict | None = None


def _load_cache_from_disk() -> dict:
    cache = {}
    if CACHE_PATH.exists():
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    rec = json.loads(line)
                    cache[rec["hash"]] = rec["translation"]
                except Exception:
                    pass
    return cache


def _get_cache() -> dict:
    global _CACHE
    if _CACHE is None:
        _CACHE = _load_cache_from_disk()
        print(f"[translator] loaded {len(_CACHE)} cached translations")
    return _CACHE


def _save_cache_entry(h: str, translation: str):
    _get_cache()[h] = translation
    with open(CACHE_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps({"hash": h, "translation": translation}, ensure_ascii=False) + "\n")


# ─── LLM chains ──────────────────────────────────────────
def _make_chain(llm):
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{chinese_text}"),
    ])
    return prompt | llm | StrOutputParser()


@lru_cache(maxsize=1)
def _get_primary_chain():
    """Groq openai/gpt-oss-120b — generous free-tier budget."""
    llm = ChatGroq(
        model="openai/gpt-oss-120b",
        groq_api_key=GROQ_KEY,
        temperature=0.0,
        max_tokens=8000,
    )
    return _make_chain(llm)


@lru_cache(maxsize=1)
def _get_secondary_chain():
    """Groq Qwen — Chinese-native, but tight TPM. Used as second attempt."""
    llm = ChatGroq(
        model="qwen/qwen3.8-27b",
        groq_api_key=GROQ_KEY,
        temperature=0.0,
        max_tokens=8000,
    )
    return _make_chain(llm)


@lru_cache(maxsize=1)
def _get_gemini_chain():
    """Gemini 3.8-flash — last resort, tiny daily quota."""
    llm = ChatGoogleGenerativeAI(
        model="gemini-3.8-flash",
        google_api_key=GEMINI_KEY,
        temperature=0.0,
    )
    return _make_chain(llm)


# ─── Helpers ─────────────────────────────────────────────
def is_chinese(text: str) -> bool:
    if not text:
        return False
    return any('\u4e00' <= ch <= '\u9fff' for ch in text)


def _invoke_with_retry(chain, text: str, max_attempts: int = 3, label: str = "LLM"):
    """
    Tries up to `max_attempts` times with exponential backoff.
    Returns translation string or None on total failure.
    """
    for attempt in range(max_attempts):
        _wait_for_rate_limit()
        try:
            return chain.invoke({"chinese_text": text})
        except Exception as e:
            err = str(e)
            is_rate_limit = any(k in err for k in ["429", "503", "RESOURCE_EXHAUSTED", "UNAVAILABLE", "rate"])
            wait = (2 ** attempt) * 3 + 1  # 4s, 7s, 13s
            if is_rate_limit:
                print(f"[{label}] rate-limited, sleeping {wait}s (attempt {attempt + 1}/{max_attempts})")
            else:
                print(f"[{label}] error: {err[:150]}")
            if attempt < max_attempts - 1:
                time.sleep(wait)
    return None


# ─── Public API ──────────────────────────────────────────
def translate_to_english(text: str) -> str:
    if not text or not text.strip():
        return ""
    if not is_chinese(text):
        return text

    # Truncate overly long inputs
    truncated = text[:MAX_INPUT_CHARS]
    if len(text) > MAX_INPUT_CHARS:
        print(f"[translator] truncating {len(text)} → {MAX_INPUT_CHARS} chars")

    h = hashlib.sha256(truncated.encode("utf-8")).hexdigest()

    cached = _get_cache().get(h)
    if cached:
        return cached

    # 1) Primary: Groq gpt-oss-120b
    result = _invoke_with_retry(_get_primary_chain(), truncated, max_attempts=3, label="gpt-oss-120b")

    # 2) Secondary: Groq Qwen
    if not result:
        print("[translator] gpt-oss-120b failed → trying Qwen...")
        result = _invoke_with_retry(_get_secondary_chain(), truncated, max_attempts=2, label="qwen3.8-27b")

    # 3) Last resort: Gemini
    if not result:
        print("[translator] Qwen failed → trying Gemini...")
        result = _invoke_with_retry(_get_gemini_chain(), truncated, max_attempts=1, label="gemini-3.8")

    if not result:
        raise TranslationFailedError(f"All providers failed for hash {h[:8]}")

    _save_cache_entry(h, result)
    return result