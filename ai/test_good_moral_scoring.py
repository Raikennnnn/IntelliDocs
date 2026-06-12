#!/usr/bin/env python3
"""Verify good-moral Level 2 score matches doc_checks and summary text."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("app", ROOT / "app.py")
app = importlib.util.module_from_spec(spec)
sys.modules["app"] = app
spec.loader.exec_module(app)


def l2_from_checks(doc_checks: list[dict], field_checks: list[dict], ocr: float) -> int:
    confidence = app._composite_verify_score(
        is_photo=False,
        ocr_confidence=ocr,
        word_count=50,
        doc_checks=doc_checks,
        field_checks=field_checks,
        detected_lrn=None,
        doc_type="good_moral",
    )
    return int(round(confidence * 100))


def summary_for(
    doc_checks: list[dict],
    field_checks: list[dict],
    l2_score: int,
    l2_pass: bool,
) -> str:
    concern = app._concern_display_score(l2_pass, l2_score)
    return app._document_match_summary(doc_checks, field_checks, concern, l2_pass)


def build_good_moral_checks(passed: dict[str, bool]) -> list[dict]:
    fields = [
        "Good moral / moral character keyword",
        "Certification/Certificate keyword",
        "Name label",
        "School name keyword",
        "Date/issuance text found",
    ]
    return [{"field": f, "ok": bool(passed.get(f, False))} for f in fields]


def assert_eq(label: str, got, expected) -> None:
    if got != expected:
        raise AssertionError(f"{label}: got {got!r}, expected {expected!r}")


def main() -> None:
    # Scenario: one label keyword missing (signature is covered by visual scan, not doc_checks)
    checks = build_good_moral_checks(
        {
            "Good moral / moral character keyword": True,
            "Certification/Certificate keyword": True,
            "Name label": True,
            "School name keyword": False,
            "Date/issuance text found": True,
        }
    )
    assert_eq("good moral check count", len(checks), 5)
    ocr = 0.85
    field_checks = [{"field": "Name", "ok": True}, {"field": "Previous school", "ok": True}]
    l2 = l2_from_checks(checks, field_checks, ocr)
    label_ratio = 5 / 6
    expected_l2 = l2_from_checks(checks, field_checks, ocr)
    assert_eq("L2 score", l2, expected_l2)

    l2_pass = l2 >= 62
    summary = summary_for(checks, field_checks, l2, l2_pass=l2_pass)
    assert "To Whom" not in summary
    if l2_pass:
        assert "0% concern" in summary
    else:
        assert "School name" in summary

    # Old scenario (7 checks, missing to_whom + principal) reproduced for comparison
    old_checks = [
        {"field": "Good moral / moral character keyword", "ok": True},
        {"field": '"To Whom It May Concern" phrase', "ok": False},
        {"field": "Certification/Certificate keyword", "ok": True},
        {"field": "Name label", "ok": True},
        {"field": "School name keyword", "ok": True},
        {"field": "Date/issuance text found", "ok": True},
        {"field": "Authority/signature keyword (Principal/Registrar)", "ok": False},
    ]
    old_l2 = l2_from_checks(old_checks, field_checks, ocr)
    assert_eq("old 7-check L2 (5/7 pass)", old_l2, 83)

    # _build_security_levels end-to-end
    payload = {
        "doc_checks": checks,
        "field_checks": field_checks,
        "ocr_confidence": ocr,
        "confidence": l2 / 100.0,
        "issues": [],
    }
    sec = app._build_security_levels(
        quality=app._upload_quality_stub(),
        doc_type="good_moral",
        payload=payload,
        tamper_score=1.0,
        quality_enforced_at_upload=True,
    )
    level1 = sec["levels"][0]
    assert_eq("panel level title", level1["title"], "Document & enrollment mismatch")
    assert_eq("panel concern score", level1["score"], app._concern_display_score(l2_pass, l2))
    assert_eq("panel summary", level1["summary"], summary)

    # Name mismatch must raise mismatch concern (not 0% clean).
    name_fail_checks = [
        {"field": "Name", "ok": False, "match_ratio": 0.33},
        {"field": "Previous school", "ok": True},
        {"field": "School year", "ok": True},
    ]
    name_fail_payload = {
        "doc_checks": checks,
        "field_checks": name_fail_checks,
        "ocr_confidence": ocr,
        "confidence": l2_from_checks(checks, name_fail_checks, ocr) / 100.0,
        "issues": ["Mismatch: Student name not clearly found in the document text."],
    }
    name_fail_sec = app._build_security_levels(
        quality=app._upload_quality_stub(),
        doc_type="good_moral",
        payload=name_fail_payload,
        tamper_score=1.0,
        quality_enforced_at_upload=True,
    )
    mismatch_lv = name_fail_sec["levels"][0]
    assert_eq("name mismatch fails level", mismatch_lv["pass"], False)
    assert_eq("name mismatch concern > 0", mismatch_lv["score"] > 0, True)
    assert "Name" in mismatch_lv["summary"]
    assert "School name" not in mismatch_lv["summary"]

    # Signature scan is shown in cross-check but must not inflate enrollment MM %.
    sig_fail_checks = [
        {"field": "Name", "ok": False, "match_ratio": 0.33},
        {"field": "Signature", "ok": False, "match_ratio": 0.0},
        {"field": "Previous school", "ok": True},
        {"field": "School year", "ok": True},
    ]
    sig_payload = {
        "doc_checks": checks,
        "field_checks": sig_fail_checks,
        "ocr_confidence": ocr,
        "confidence": l2_from_checks(checks, sig_fail_checks, ocr) / 100.0,
        "issues": [],
    }
    sig_sec = app._build_security_levels(
        quality=app._upload_quality_stub(),
        doc_type="good_moral",
        payload=sig_payload,
        tamper_score=1.0,
        quality_enforced_at_upload=True,
    )
    sig_mm = sig_sec["levels"][0]
    assert_eq("signature excluded from MM summary", "Signature" in sig_mm["summary"], False)
    assert_eq("name still in MM summary", "Name" in sig_mm["summary"], True)

    # SF10 — every failed enrollment cross-check should appear in summary/issues.
    sf10_field_checks = [
        {"field": "Name", "ok": False, "match_ratio": 0.0},
        {"field": "LRN", "ok": False},
        {"field": "School year", "ok": False},
        {"field": "Grade level", "ok": False},
        {"field": "Sex", "ok": True},
        {"field": "Previous school", "ok": True, "match_ratio": 0.5},
    ]
    sf10_payload = {
        "doc_checks": [{"field": "LRN detected", "ok": False}],
        "field_checks": sf10_field_checks,
        "ocr_confidence": 0.71,
        "confidence": 0.56,
        "issues": [
            "LRN not detected (OCR may have missed or misread it).",
            "Mismatch: LRN in the document does not match the student's input.",
            "Mismatch: Student name not clearly found in the document text.",
            "Mismatch: School year not found or does not match the student's input.",
            "Mismatch: Grade level on the document does not match the student's enrollment.",
        ],
    }
    sf10_sec = app._build_security_levels(
        quality=app._upload_quality_stub(),
        doc_type="form137",
        payload=sf10_payload,
        tamper_score=1.0,
        quality_enforced_at_upload=True,
    )
    sf10_mm = sf10_sec["levels"][0]
    assert_eq("sf10 multi-field mismatch fails", sf10_mm["pass"], False)
    assert_eq("sf10 concern uses all failed fields", sf10_mm["score"], 100)
    for label in ("Name", "LRN", "School year", "Grade level"):
        assert label in sf10_mm["summary"], f"missing {label} in {sf10_mm['summary']}"
    assert "LRN detected" not in sf10_mm["summary"]
    issue_blob = " ".join(sf10_mm.get("issues") or [])
    assert "School year" in issue_blob
    assert "Grade level" in issue_blob
    assert "Missing: LRN detected" not in issue_blob

    print("OK — good moral scoring is consistent:")
    print(f"  5-check model (1 missing): L2={l2}%, summary={summary}")
    print(f"  7-check legacy model (2 missing): L2={old_l2}%")
    print(f"  name mismatch concern: {mismatch_lv['score']}% — {mismatch_lv['summary']}")
    print(f"  composite confidence={l2}% (stored ai_score basis)")


if __name__ == "__main__":
    main()
