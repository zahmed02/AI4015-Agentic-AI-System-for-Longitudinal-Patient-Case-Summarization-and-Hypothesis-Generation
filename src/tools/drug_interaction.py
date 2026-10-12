"""
Drug-drug interaction checker.
Uses a small curated table of well-established, high-severity interactions
(fast, offline, deterministic). The NIH RxNav interaction API that this module
used to fall back to was discontinued by the NLM in January 2024, so the table
is the only source. A pair that is NOT in the table is not proof that the
combination is safe.

NOTE: this is a decision-support aid, not a substitute for a pharmacist or
a full interaction database (e.g., Micromedex/Lexicomp).
"""
from typing import Dict, List
import itertools

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


def check_interaction(drug_a: str, drug_b: str) -> Dict:
    key = frozenset({drug_a.lower().strip(), drug_b.lower().strip()})
    result = KNOWN_INTERACTIONS.get(key)
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
        "source": "curated table",
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
            f"No interaction found in the curated table ({len(KNOWN_INTERACTIONS)} well-known pairs) "
            f"among: {', '.join(medication_list)}. This does not mean the combination is safe. "
            "Not a substitute for pharmacist review."
        )

    lines = [
        f"- {r['drug_a']} + {r['drug_b']} [{r['severity'].upper()}]: {r['description']}"
        for r in flagged
    ]
    return "Potential interactions found:\n" + "\n".join(lines) + \
        "\n\nDecision support only, not a substitute for pharmacist review."