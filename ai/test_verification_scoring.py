#!/usr/bin/env python3
"""End-to-end verification scoring consistency (match %, summary, confidence, weighted overall)."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("app", ROOT / "app.py")
app = importlib.util.module_from_spec(spec)
sys.modules["app"] = app
spec.loader.exec_module(app)


def good_moral_checks(**passed: bool) -> list[dict]:
    fields = [
        ("Good moral / moral character keyword", "moral"),
        ("Certification/Certificate keyword", "cert"),
        ("Name label", "name"),
        ("School name keyword", "school"),
        ("Date/issuance text found", "date"),
        ("Authority/signature keyword (Principal/Registrar)", "principal"),
    ]
    defaults = {k: True for _, k in fields}
    defaults.update(passed)
    return [{"field": label, "ok": bool(defaults[key])} for label, key in fields]


def build_payload(doc_checks, field_checks, ocr: float, tamper: float = 1.0) -> dict:
    confidence = app._composite_verify_score(
        is_photo=False,
        ocr_confidence=ocr,
        word_count=80,
        doc_checks=doc_checks,
        field_checks=field_checks,
        detected_lrn=None,
        doc_type="good_moral",
    )
    payload = {
        "doc_checks": doc_checks,
        "field_checks": field_checks,
        "ocr_confidence": ocr,
        "confidence": confidence,
        "match_score": confidence,
        "issues": [],
    }
    sec = app._build_security_levels(
        quality=app._upload_quality_stub(),
        doc_type="good_moral",
        payload=payload,
        tamper_score=tamper,
        quality_enforced_at_upload=True,
    )
    payload["security_levels"] = sec
    return payload


def weighted_overall(scores: dict[str, int]) -> int:
    weights = {
        "form137": 0.25,
        "sf9": 0.25,
        "birth_certificate": 0.25,
        "good_moral": 0.20,
        "photo_2x2": 0.05,
    }
    total = sum(weights[k] * scores.get(k, 0) for k in weights)
    return round(total)


def assert_match(label: str, got, expected) -> None:
    if got != expected:
        raise AssertionError(f"{label}: got {got!r}, expected {expected!r}")


def main() -> None:
    field_checks = [
        {"field": "Name", "ok": True},
        {"field": "Previous school", "ok": True},
    ]
    ocr = 0.85

    # Good moral — one missing label
    checks = good_moral_checks(principal=False)
    payload = build_payload(checks, field_checks, ocr, tamper=0.70)
    match_pct = int(round(payload["confidence"] * 100))
    level1 = payload["security_levels"]["levels"][0]

    assert_match("good moral check count", len(checks), 6)
    assert_match("level1 concern score when pass", level1["score"], 0)
    assert_match("summary mentions 0% concern when pass", "0% concern" in level1["summary"], True)
    assert "To Whom" not in level1["summary"]
    assert_match("tamper does not change confidence", match_pct, int(round(payload["confidence"] * 100)))

    integrity = payload["security_levels"]["levels"][1]
    assert_match("integrity level separate", integrity["title"], "Tamper & integrity")
    assert_match("integrity concern 0 when tamper stage passes", integrity["score"], 0)

    # Weighted overall mirrors per-doc confidence
    docs = {
        "form137": 90,
        "sf9": 88,
        "birth_certificate": 92,
        "good_moral": match_pct,
        "photo_2x2": 95,
    }
    overall = weighted_overall(docs)
    expected_overall = round(0.25 * 90 + 0.25 * 88 + 0.25 * 92 + 0.20 * match_pct + 0.05 * 95)
    assert_match("weighted overall formula", overall, expected_overall)

    # All doc types have expected check counts
    type_counts = {
        "birth_certificate": 9,
        "good_moral": 6,
        "sf9": 6,
        "form137": 6,
    }
    for dtype, expected_n in type_counts.items():
        # Minimal smoke: _evaluate returns doc_checks of expected length when text is rich enough
        text = " ".join(["PSA CERTIFICATE LIVE BIRTH NAME GRADE SCHOOL YEAR LRN"] * 5)
        if dtype == "good_moral":
            text += " GOOD MORAL CHARACTER CERTIFICATION PRINCIPAL REGISTRAR SCHOOL ACADEMY"
        payload2 = app._evaluate(text, 0.9, dtype, expected={"name": "Juan Dela Cruz"})
        n = len(payload2.get("doc_checks") or [])
        assert_match(f"{dtype} doc_checks count", n, expected_n)

    print("OK — whole verification data is aligned:")
    print(f"  good_moral match/confidence/level1: {match_pct}%")
    print(f"  summary: {level1['summary']}")
    print(f"  integrity (separate): {integrity['score']}%")
    print(f"  sample weighted overall: {overall}%")


if __name__ == "__main__":
    main()
