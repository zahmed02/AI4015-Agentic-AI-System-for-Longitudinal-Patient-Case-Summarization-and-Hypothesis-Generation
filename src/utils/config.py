"""
Loads config.yaml once and exposes it as a cached singleton.
This is the single source of truth for non-secret settings.
API keys stay in .env — never put secrets in config.yaml.
"""
import os
import yaml
from functools import lru_cache
from pathlib import Path

CONFIG_PATH = Path(os.getenv("CONFIG_PATH", "./config.yaml"))


@lru_cache(maxsize=1)
def get_config() -> dict:
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"config.yaml not found at {CONFIG_PATH.resolve()}")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get(path: str, default=None):
    """
    Dotted-path getter, e.g. get('llm.primary_model').
    Falls back to `default` if the key is missing.
    """
    node = get_config()
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return default
        node = node[part]
    return node