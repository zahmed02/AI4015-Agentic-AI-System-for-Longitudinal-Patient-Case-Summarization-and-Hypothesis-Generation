"""
Schema-aware loader for MedChain with resume + auto-stop on API exhaustion.

Includes a verified Chinese → English specialty mapping derived from
frequency analysis of the '科室' tag in merged_cases.json (169 unique values).
Any specialty not present in the map falls back to the raw Chinese value.
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


# ─────────────────────────────────────────────────────────────────────
# Chinese → English specialty mapping
# Source: frequency analysis of `tags.科室` values in
#         data/raw/MedChain/merged_cases.json (12,163 cases, 169 unique).
# Counts in comments reflect the number of cases tagged with each value.
# Unmapped values fall back to the raw Chinese string.
# ─────────────────────────────────────────────────────────────────────
SPECIALTY_MAP: Dict[str, str] = {
    # Top 20 (all appear 300+ times)
    "内科": "Internal Medicine",                         # 5265
    "外科": "Surgery",                                    # 2954
    "神经内科": "Neurology",                               # 935
    "心血管内科": "Cardiology",                             # 897
    "妇产科": "Obstetrics and Gynecology",                 # 849
    "呼吸科": "Pulmonology",                               # 800
    "消化内科": "Gastroenterology",                        # 763
    "骨科": "Orthopedics",                                 # 758
    "中医科": "Traditional Chinese Medicine",              # 601
    "儿科": "Pediatrics",                                  # 511
    "神经外科": "Neurosurgery",                            # 498
    "肿瘤科": "Oncology",                                  # 460
    "皮肤性病科": "Dermatology and Venereology",           # 458
    "内分泌科": "Endocrinology",                           # 422
    "产科": "Obstetrics",                                  # 406
    "普外科": "General Surgery",                           # 389
    "耳鼻咽喉科": "Otorhinolaryngology",                    # 370
    "肿瘤内科": "Medical Oncology",                        # 362
    "皮肤科": "Dermatology",                               # 357
    "泌尿外科": "Urology",                                 # 322

    # Mid-frequency (100-320)
    "肾脏内科": "Nephrology",                              # 317
    "妇科": "Gynecology",                                  # 302
    "血液科": "Hematology",                                # 301
    "麻醉疼痛科": "Anesthesiology and Pain Medicine",      # 294
    "精神科": "Psychiatry",                                # 272
    "急诊科": "Emergency Medicine",                        # 266
    "肝病科": "Hepatology",                                # 221
    "普通内科": "General Internal Medicine",               # 207
    "中医内科": "TCM Internal Medicine",                    # 191
    "康复科": "Rehabilitation Medicine",                    # 163
    "口腔科": "Dentistry",                                 # 141
    "医学影像科": "Medical Imaging",                        # 134
    "眼科": "Ophthalmology",                               # 130
    "小儿内科": "Pediatric Internal Medicine",             # 130
    "感染科": "Infectious Disease",                        # 124
    "全科": "General Practice",                            # 116
    "肛肠外科": "Colorectal Surgery",                       # 113
    "免疫科": "Immunology",                                # 103

    # Lower frequency (10-99)
    "性病科": "Venereology",                               # 99
    "小儿呼吸科": "Pediatric Pulmonology",                  # 98
    "妇科肿瘤": "Gynecologic Oncology",                    # 85
    "肿瘤外科": "Surgical Oncology",                       # 75
    "胃肠外科": "Gastrointestinal Surgery",                # 73
    "中医消化科": "TCM Gastroenterology",                  # 69
    "创伤骨科": "Orthopedic Trauma",                       # 68
    "风湿科": "Rheumatology",                              # 67
    "肝胆外科": "Hepatobiliary Surgery",                   # 66
    "整形科": "Plastic Surgery",                           # 63
    "关节骨科": "Joint Orthopedics",                       # 62
    "心胸外科": "Cardiothoracic Surgery",                  # 56
    "脊柱外科": "Spine Surgery",                           # 53
    "颌面外科": "Maxillofacial Surgery",                   # 48
    "小儿消化科": "Pediatric Gastroenterology",            # 44
    "角膜科": "Cornea",                                    # 43
    "超声科": "Ultrasound",                                # 42
    "中医神经内科": "TCM Neurology",                       # 41
    "CT室": "CT Imaging",                                  # 36
    "中医呼吸科": "TCM Pulmonology",                       # 34
    "中西医结合科": "Integrated Chinese and Western Medicine",  # 32
    "过敏反应科": "Allergy and Immunology",                 # 31
    "口腔粘膜科": "Oral Mucosa",                           # 29
    "传染科": "Infectious Disease",                        # 29
    "心理科": "Psychology",                                # 28
    "小儿感染科": "Pediatric Infectious Disease",           # 28
    "结核病科": "Tuberculosis",                            # 27
    "胸外科": "Thoracic Surgery",                          # 27
    "新生儿科": "Neonatology",                             # 26
    "中医妇产科": "TCM Obstetrics and Gynecology",          # 24
    "检验科": "Laboratory Medicine",                       # 24
    "小儿外科": "Pediatric Surgery",                       # 24
    "中医皮肤科": "TCM Dermatology",                       # 23
    "小儿心内科": "Pediatric Cardiology",                  # 22
    "牙体牙髓科": "Endodontics",                           # 22
    "放射科": "Radiology",                                 # 21
    "小儿内分泌科": "Pediatric Endocrinology",              # 19
    "小儿血液科": "Pediatric Hematology",                  # 19
    "中医外科": "TCM Surgery",                             # 18
    "小儿皮肤科": "Pediatric Dermatology",                 # 18
    "眼视光学": "Optometry",                               # 18
    "高危产科": "High-Risk Obstetrics",                    # 18
    "眼底": "Retina",                                      # 18
    "中医儿科": "TCM Pediatrics",                          # 17
    "针灸科": "Acupuncture",                               # 17
    "中医心内科": "TCM Cardiology",                        # 17
    "血液检验": "Hematology Laboratory",                    # 17
    "小儿神经内科": "Pediatric Neurology",                  # 17
    "妇科内分泌": "Gynecologic Endocrinology",             # 17
    "MRI室": "MRI Imaging",                                # 17
    "中医骨伤科": "TCM Orthopedics and Traumatology",      # 16
    "中医内分泌": "TCM Endocrinology",                     # 16
    "外伤科": "Traumatology",                              # 16
    "眼眶及肿瘤": "Orbit and Tumor",                        # 16
    "药剂科": "Pharmacy",                                  # 15
    "小儿肾内科": "Pediatric Nephrology",                  # 15
    "牙周科": "Periodontics",                              # 15
    "肿瘤妇科": "Gynecologic Oncology",                    # 15
    "烧伤科": "Burn Surgery",                              # 15
    "青光眼": "Glaucoma",                                  # 14
    "骨肿瘤科": "Orthopedic Oncology",                     # 14
    "血管外科": "Vascular Surgery",                        # 14
    "护理科": "Nursing",                                   # 13
    "心脏外科": "Cardiac Surgery",                         # 13
    "中医肿瘤科": "TCM Oncology",                          # 12
    "西药房": "Western Pharmacy",                          # 12
    "X线室": "X-ray Imaging",                              # 12
    "计划生育科": "Family Planning",                       # 12
    "手外科": "Hand Surgery",                              # 12
    "老年病科": "Geriatrics",                              # 11
    "口腔修复科": "Prosthodontics",                        # 11
    "中医老年病科": "TCM Geriatrics",                      # 11
    "眼外伤": "Ocular Trauma",                             # 11
    "中医肾脏内科": "TCM Nephrology",                      # 10
    "乳腺外科": "Breast Surgery",                          # 10

    # Rare (1-9)
    "小儿免疫科": "Pediatric Immunology",                  # 9
    "中医男科": "TCM Andrology",                           # 9
    "中医五官科": "TCM ENT",                               # 9
    "小儿骨科": "Pediatric Orthopedics",                   # 9
    "中医肛肠科": "TCM Colorectal Surgery",                # 8
    "中医免疫内科": "TCM Immunology",                      # 8
    "胰腺外科": "Pancreatic Surgery",                      # 8
    "外科护理": "Surgical Nursing",                        # 8
    "放疗科": "Radiation Oncology",                        # 8
    "中医肝病科": "TCM Hepatology",                        # 7
    "小儿精神科": "Pediatric Psychiatry",                  # 7
    "小儿耳鼻喉": "Pediatric ENT",                         # 7
    "中医精神科": "TCM Psychiatry",                        # 7
    "白内障": "Cataract",                                  # 7
    "微创外科": "Minimally Invasive Surgery",              # 5
    "小儿泌尿科": "Pediatric Urology",                     # 5
    "产前检查科": "Prenatal Care",                         # 5
    "种植科": "Implantology",                              # 5
    "小儿急诊科": "Pediatric Emergency Medicine",          # 4
    "儿童口腔科": "Pediatric Dentistry",                   # 4
    "甲状腺外科": "Thyroid Surgery",                       # 4
    "干部诊疗科": "Cadre Healthcare",                      # 4
    "正畸科": "Orthodontics",                              # 4
    "基础护理": "Basic Nursing",                           # 4
    "艾滋病科": "HIV/AIDS Care",                           # 3
    "临床检验室": "Clinical Laboratory",                    # 3
    "小儿眼科": "Pediatric Ophthalmology",                 # 3
    "生殖中心": "Reproductive Medicine",                   # 3
    "小儿神经外科": "Pediatric Neurosurgery",              # 3
    "小儿心外科": "Pediatric Cardiac Surgery",             # 3
    "营养科": "Nutrition",                                 # 3
    "小儿整形科": "Pediatric Plastic Surgery",             # 2
    "彩超科": "Color Doppler Ultrasound",                  # 2
    "核医学科": "Nuclear Medicine",                        # 2
    "口腔急诊科": "Oral Emergency",                        # 2
    "体液检验": "Body Fluid Laboratory",                    # 2
    "中医按摩科": "TCM Massage",                           # 2
    "内科护理": "Internal Medicine Nursing",               # 1
    "口腔预防科": "Preventive Dentistry",                  # 1
    "儿童保健科": "Child Health",                          # 1
    "皮肤美容": "Cosmetic Dermatology",                    # 1
    "中医血液科": "TCM Hematology",                        # 1
    "调剂科": "Dispensing",                                # 1
    "儿童康复科": "Pediatric Rehabilitation",              # 1
    "妇泌尿科": "Urogynecology",                           # 1
    "器官移植": "Organ Transplantation",                    # 1
    "B超科": "B-Ultrasound",                               # 1
    "推拿科": "Tui Na Massage",                            # 1
    "中医感染内科": "TCM Infectious Disease",              # 1
    "生化室": "Biochemistry Laboratory",                   # 1
    "中药房": "Chinese Pharmacy",                          # 1
    "病理科": "Pathology",                                 # 1
    "心超科": "Echocardiography",                          # 1
    "药理实验室": "Pharmacology Laboratory",                # 1
    "激光室": "Laser Therapy",                             # 1
    "理疗科": "Physiotherapy",                             # 1
}


def _translate_specialty(raw: str) -> str:
    """
    Maps a raw Chinese specialty string to English.
    Falls back to the original string if not in the verified map.
    """
    if not raw:
        return "unknown"
    return SPECIALTY_MAP.get(raw, raw)


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
    """
    Extracts the primary specialty from the case record and maps to English.
    Handles both list and string forms of the 科室 tag.
    """
    tags = record.get("tags", {})
    if isinstance(tags, dict):
        dept = tags.get("科室") or tags.get("department")
        if isinstance(dept, list) and dept:
            return _translate_specialty(str(dept[0]))
        if isinstance(dept, str):
            return _translate_specialty(dept)
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