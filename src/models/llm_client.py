"""
Central LLM client factory.
Primary: Gemini. Fallback: Groq.
Reads config.yaml by default; env vars (PRIMARY_LLM / FALLBACK_LLM) override it
so you can swap models for a single run without editing the file.
"""
import os
from functools import lru_cache
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from src.utils.config import get as cfg_get

load_dotenv()

PRIMARY_MODEL = os.getenv("PRIMARY_LLM") or cfg_get("llm.primary_model", "gemini-flash-latest")
FALLBACK_MODEL = os.getenv("FALLBACK_LLM") or cfg_get("llm.fallback_model", "openai/gpt-oss-120b")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")


@lru_cache(maxsize=4)
def get_primary_llm(temperature: float = 0.0):
    return ChatGoogleGenerativeAI(
        model=PRIMARY_MODEL,
        google_api_key=GEMINI_KEY,
        temperature=temperature,
    )


@lru_cache(maxsize=4)
def get_fallback_llm(temperature: float = 0.0):
    return ChatGroq(
        model=FALLBACK_MODEL,
        groq_api_key=GROQ_KEY,
        temperature=temperature,
    )


def get_llm(temperature: float = 0.0):
    """Primary with automatic fallback on rate-limit / server errors."""
    primary = get_primary_llm(temperature=temperature)
    fallback = get_fallback_llm(temperature=temperature)
    return primary.with_fallbacks([fallback])