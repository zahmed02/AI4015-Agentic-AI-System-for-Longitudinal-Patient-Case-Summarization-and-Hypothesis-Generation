"""
Drug-drug interaction checker.
Primary source: a small curated table of well-established, high-severity
interactions (fast, offline, deterministic). Falls back to the NIH RxNav
public API (no API key required) for anything not in the local table.

NOTE: this is a decision-support aid, not a substitute for a pharmacist or
a full interaction database (e.g., Micromedex/Lexicomp) — say so in output.
"""
from typing import List, Dict
import itertools

try:
    import requests
except ImportError:
    requests = None

from src.utils.logger import get_logger

logger = get_logger(__name__)

# (drug_a, drug_b) -> (severity, description). Stored lowercase, order-independent.
KNOWN_INTERACTIONS: Dict[frozenset, Dict[str, str]] = {
    frozenset({"warfarin", "aspirin"}): {
        "severity": "major",
        "description": "Increased bleeding risk from combined anticoagulant/antiplatelet effect.",
    },
    frozenset({"warfarin", "nsaid"}): {
        "severity": "major",
        "description": "NSAIDs increase bleeding risk and can displace warfarin from protein binding.",
    },
    frozenset({"ace inhibitor", "potassium"}): {
        "severity": "moderate",
        "description": "Risk of hyperkalemia with combined ACE inhibitor and potassium supplementation.",
    },
    frozenset({"nitroglycerin", "sildenafil"}): {
        "severity": "contraindicated",
        "description": "Severe, potentially fatal hypotension from combined nitrate/PDE5-inhibitor vasodilation.",
    },
    frozenset({"metformin", "contrast dye"}): {
        "severity": "major",
        "description": "Risk of lactic acidosis in the setting of contrast-induced nephropathy.",
    },
    frozenset({"ssri", "maoi"}): {
        "severity": "contraindicated",
        "description": "Risk of serotonin syndrome.",
    },
    frozenset({"methotrexate", "nsaid"}): {
        "severity": "major",
        "description": "NSAIDs reduce methotrexate renal clearance, increasing toxicity risk.",
    },
}


def _check_local_table(drug_a: str, drug_b: str):
    key = frozenset({drug_a.lower().strip(), drug_b.lower().strip()})
    return KNOWN_INTERACTIONS.get(key)


def _check_rxnav(drug_a: str, drug_b: str):
    """Best-effort lookup against NIH RxNav (public, no API key). Fails soft."""
    if requests is None:
        return None
    try:
        # Resolve names to RxCUIs first
        rxcuis = []
        for name in (drug_a, drug_b):
            resp = requests.get(
                "https://rxnav.nlm.nih.gov/REST/rxcui.json",
                params={"name": name}, timeout=5,
            )
            ids = resp.json().get("idGroup", {}).get("rxnormId", [])
            if not ids:
                return None
            rxcuis.append(ids[0])

        resp = requests.get(
            "https://rxnav.nlm.nih.gov/REST/interaction/list.json",
            params={"rxcuis": "+".join(rxcuis)}, timeout=5,
        )
        groups = resp.json().get("fullInteractionTypeGroup", [])
        if not groups:
            return None
        pair = groups[0]["fullInteractionType"][0]["interactionPair"][0]
        return {"severity": "unknown (RxNav)", "description": pair.get("description", "")}
    except Exception as e:
        logger.warning(f"RxNav lookup failed for ({drug_a}, {drug_b}): {e}")
        return None


def check_interaction(drug_a: str, drug_b: str) -> Dict:
    result = _check_local_table(drug_a, drug_b)
    source = "local"
    if result is None:
        result = _check_rxnav(drug_a, drug_b)
        source = "rxnav"
    if result is None:
        return {
            "drug_a": drug_a, "drug_b": drug_b,
            "interaction_found": False,
            "source": "none",
        }
    return {
        "drug_a": drug_a, "drug_b": drug_b,
        "interaction_found": True,
        "severity": result["severity"],
        "description": result["description"],
        "source": source,
    }


def drug_interaction_tool(medication_list: List[str]) -> str:
    """
    Entry point used by the agents / MCP server.
    Checks every pairwise combination in `medication_list`.
    """
    if len(medication_list) < 2:
        return "Need at least two medications to check for interactions."

    results = [check_interaction(a, b) for a, b in itertools.combinations(medication_list, 2)]
    flagged = [r for r in results if r["interaction_found"]]

    if not flagged:
        return (
            f"No known interactions found among: {', '.join(medication_list)}. "
            "This checks a curated table plus NIH RxNav — not a substitute for pharmacist review."
        )

    lines = [
        f"- {r['drug_a']} + {r['drug_b']} [{r['severity'].upper()}]: {r['description']}"
        for r in flagged
    ]
    return "Potential interactions found:\n" + "\n".join(lines) + \
        "\n\nThis is decision support, not a substitute for pharmacist review."