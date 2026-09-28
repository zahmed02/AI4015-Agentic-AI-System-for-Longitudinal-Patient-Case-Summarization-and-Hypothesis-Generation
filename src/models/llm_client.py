"""
Central LLM client factory.
Provides Gemini as primary, Groq as fallback.
"""
import os
from functools import lru_cache
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq

load_dotenv()

PRIMARY_MODEL = os.getenv("PRIMARY_LLM", "gemini-3.8-flash")
FALLBACK_MODEL = os.getenv("FALLBACK_LLM", "openai/gpt-oss-120b")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")


@lru_cache(maxsize=1)
def get_primary_llm(temperature: float = 0.0):
    """Gemini — used by default for all agents."""
    return ChatGoogleGenerativeAI(
        model=PRIMARY_MODEL,
        google_api_key=GEMINI_KEY,
        temperature=temperature,
    )


@lru_cache(maxsize=1)
def get_fallback_llm(temperature: float = 0.0):
    """Groq — used when Gemini hits rate limits."""
    return ChatGroq(
        model=FALLBACK_MODEL,
        groq_api_key=GROQ_KEY,
        temperature=temperature,
    )


def get_llm(temperature: float = 0.0):
    """Returns the primary LLM with fallback wired in."""
    primary = get_primary_llm(temperature=temperature)
    fallback = get_fallback_llm(temperature=temperature)
    # LangChain's with_fallbacks handles rate-limit / server errors automatically
    return primary.with_fallbacks([fallback])