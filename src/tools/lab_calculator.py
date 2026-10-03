"""
Lab-value interpretation tool.
Scans free text for common lab mentions and flags abnormal values against
standard adult reference ranges. Also provides a few direct calculators
(anion gap, BMI, eGFR) for use by agents or the MCP server.

This is deterministic and rule-based on purpose — lab interpretation is
exactly the kind of thing you do NOT want an LLM free-associating about.
"""
import re
from typing import Dict, List, Optional

# (low, high, unit) — adult reference ranges, intentionally conservative/general
REFERENCE_RANGES: Dict[str, tuple] = {
    "alt":         (7, 56, "U/L"),
    "ast":         (10, 40, "U/L"),
    "total bilirubin": (0.1, 1.2, "mg/dL"),
    "creatinine":  (0.6, 1.3, "mg/dL"),
    "wbc":         (4.0, 11.0, "x10^9/L"),
    "hemoglobin":  (12.0, 17.5, "g/dL"),
    "platelets":   (150, 450, "x10^9/L"),
    "glucose":     (70, 100, "mg/dL"),
    "sodium":      (135, 145, "mmol/L"),
    "potassium":   (3.5, 5.0, "mmol/L"),
    "albumin":     (3.4, 5.4, "g/dL"),
}

_LAB_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in REFERENCE_RANGES) + r")\b"
    r"[^\d\-]{0,15}([\d]+\.?[\d]*)",
    flags=re.IGNORECASE,
)


def flag_abnormal_labs(text: str) -> List[Dict]:
    """
    Scans text for 'LabName: value' style mentions and flags anything outside
    the normal range. Returns a list of {lab, value, unit, status, range}.
    """
    findings = []
    for match in _LAB_PATTERN.finditer(text):
        lab_raw, value_raw = match.group(1).lower(), match.group(2)
        try:
            value = float(value_raw)
        except ValueError:
            continue
        low, high, unit = REFERENCE_RANGES[lab_raw]
        if value < low:
            status = "LOW"
        elif value > high:
            status = "HIGH"
        else:
            status = "normal"
        findings.append({
            "lab": lab_raw,
            "value": value,
            "unit": unit,
            "status": status,
            "reference_range": f"{low}-{high} {unit}",
        })
    return findings


def anion_gap(sodium: float, chloride: float, bicarbonate: float) -> float:
    """AG = Na - (Cl + HCO3). Normal: 8-16 mmol/L."""
    return round(sodium - (chloride + bicarbonate), 1)


def bmi(weight_kg: float, height_m: float) -> Optional[float]:
    if not height_m:
        return None
    return round(weight_kg / (height_m ** 2), 1)


def egfr_ckd_epi(creatinine_mg_dl: float, age: int, is_female: bool) -> float:
    """Simplified 2021 CKD-EPI creatinine equation (race-free version)."""
    kappa = 0.7 if is_female else 0.9
    alpha = -0.241 if is_female else -0.302
    sex_factor = 1.012 if is_female else 1.0
    min_term = min(creatinine_mg_dl / kappa, 1) ** alpha
    max_term = max(creatinine_mg_dl / kappa, 1) ** -1.200
    egfr = 142 * min_term * max_term * (0.9938 ** age) * sex_factor
    return round(egfr, 1)


def lab_calculator_tool(text: str) -> str:
    """
    Entry point used by the agents / MCP server.
    Returns a human-readable summary of any abnormal labs found in `text`.
    """
    findings = flag_abnormal_labs(text)
    abnormal = [f for f in findings if f["status"] != "normal"]
    if not abnormal:
        return "No abnormal lab values detected in the provided text." if findings else \
               "No recognized lab values found in the provided text."
    lines = [
        f"- {f['lab'].upper()}: {f['value']} {f['unit']} ({f['status']}, "
        f"reference {f['reference_range']})"
        for f in abnormal
    ]
    return "Flagged abnormal labs:\n" + "\n".join(lines)