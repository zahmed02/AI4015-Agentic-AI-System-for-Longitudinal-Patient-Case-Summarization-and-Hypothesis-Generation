"""
Helpers for normalizing LLM responses across providers.
Groq openai/gpt-oss-120b returns content as a list of content blocks,
while Gemini returns a plain string. This module normalizes both.
"""


def extract_text(content) -> str:
    """Returns plain text from any LLM response content shape."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                if "text" in block:
                    parts.append(str(block["text"]))
        return "".join(parts)
    return str(content)