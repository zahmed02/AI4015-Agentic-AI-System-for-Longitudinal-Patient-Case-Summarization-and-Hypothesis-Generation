"""
Lightweight web search tool — no API key required (DuckDuckGo HTML endpoint).
Intended for the Diagnostician/MCP layer to pull general medical reference
context (e.g., "latest guideline for X"), NOT for retrieving patient data —
patient data always comes from the vector store / knowledge graph.
"""
from typing import List, Dict
import re

try:
    import requests
except ImportError:
    requests = None

from src.utils.logger import get_logger

logger = get_logger(__name__)

_RESULT_PATTERN = re.compile(
    r'<a rel="nofollow" class="result__a" href="([^"]+)">(.*?)</a>.*?'
    r'<a class="result__snippet"[^>]*>(.*?)</a>',
    re.DOTALL,
)


def _strip_tags(html: str) -> str:
    return re.sub(r"<.*?>", "", html).strip()


def web_search(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    if requests is None:
        return []
    try:
        resp = requests.post(
            "https://html.duckduckgo.com/html/",
            data={"q": query},
            headers={"User-Agent": "Mozilla/5.0 (ChronoMed research tool)"},
            timeout=8,
        )
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"web_search failed for {query!r}: {e}")
        return []

    results = []
    for match in _RESULT_PATTERN.finditer(resp.text):
        url, title_html, snippet_html = match.groups()
        results.append({
            "title": _strip_tags(title_html),
            "url": url,
            "snippet": _strip_tags(snippet_html),
        })
        if len(results) >= max_results:
            break
    return results


def web_search_tool(query: str) -> str:
    """Entry point used by the agents / MCP server."""
    results = web_search(query)
    if not results:
        return f"No web results found for: {query}"
    lines = [f"- {r['title']}: {r['snippet']} ({r['url']})" for r in results]
    return "\n".join(lines)