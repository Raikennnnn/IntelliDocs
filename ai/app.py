from flask import Flask, request, jsonify, make_response
import os
import re
import shutil
import sys
import tempfile
from werkzeug.utils import secure_filename

app = Flask(__name__)
APP_DIR = os.path.dirname(os.path.abspath(__file__))
app.config['UPLOAD_FOLDER'] = os.path.join(APP_DIR, 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# OCR backend: EasyOCR (needs PyTorch) when available; else Tesseract via pytesseract (works on Python 3.14+).
_easyocr_reader = None
_ocr_engine = "none"  # "easyocr" | "tesseract" | "none"
_tesseract_exe: str | None = None


def _resolve_tesseract_exe() -> str | None:
    """Find tesseract.exe. pytesseract is only a wrapper; the binary must be installed separately."""
    env = (os.environ.get("TESSERACT_CMD") or "").strip().strip('"')
    if env and os.path.isfile(env):
        return env
    which = shutil.which("tesseract")
    if which and os.path.isfile(which):
        return which
    if os.name == "nt":
        for _te in (
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ):
            if os.path.isfile(_te):
                return _te
    else:
        # Linux / macOS: apt and brew install to predictable locations.
        # Railway / Render / generic Debian containers ship tesseract under
        # /usr/bin (apt) or /usr/local/bin (manual or brew). shutil.which
        # already covers these when /usr/bin is on PATH, but we list them
        # explicitly so a stripped PATH (rare on minimal containers) still
        # finds the binary.
        for _te in (
            "/usr/bin/tesseract",
            "/usr/local/bin/tesseract",
            "/opt/homebrew/bin/tesseract",
            "/nix/var/nix/profiles/default/bin/tesseract",
        ):
            if os.path.isfile(_te):
                return _te
    return None


def _env_flag(name: str) -> bool:
    return (os.environ.get(name) or "").strip().lower() in ("1", "true", "yes", "on")


def _bootstrap_ocr() -> None:
    """Pick OCR backend at startup. Avoid EasyOCR/PyTorch on Python 3.13+ unless forced."""
    global _easyocr_reader, _ocr_engine, _tesseract_exe

    pref = (os.environ.get("AI_OCR_ENGINE") or "auto").strip().lower()
    disable_easyocr = _env_flag("DISABLE_EASYOCR")
    py313_plus = sys.version_info >= (3, 13)

    def _try_tesseract() -> bool:
        global _ocr_engine, _tesseract_exe
        try:
            import pytesseract  # noqa: F401
            from PIL import Image  # noqa: F401

            exe = _resolve_tesseract_exe()
            if not exe:
                return False
            import pytesseract as pt

            pt.pytesseract.tesseract_cmd = exe
            _tesseract_exe = exe
            _ocr_engine = "tesseract"
            print(f"[IntelliDocs AI] OCR engine: Tesseract ({exe})", flush=True)
            return True
        except Exception as exc:
            print(f"[IntelliDocs AI] Tesseract unavailable: {exc}", flush=True)
            return False

    def _try_easyocr() -> bool:
        global _easyocr_reader, _ocr_engine
        if disable_easyocr:
            return False
        if py313_plus and pref != "easyocr":
            print(
                "[IntelliDocs AI] Skipping EasyOCR on Python 3.13+ (PyTorch DLL load is slow/unstable). "
                "Install Tesseract or set AI_OCR_ENGINE=easyocr to force it.",
                flush=True,
            )
            return False
        try:
            import easyocr

            print("[IntelliDocs AI] Loading EasyOCR (PyTorch); first start may take 1–2 minutes…", flush=True)
            _easyocr_reader = easyocr.Reader(["en"])
            _ocr_engine = "easyocr"
            print("[IntelliDocs AI] OCR engine: EasyOCR", flush=True)
            return True
        except Exception as exc:
            print(f"[IntelliDocs AI] EasyOCR unavailable: {exc}", flush=True)
            _easyocr_reader = None
            return False

    order: list[str]
    if pref == "tesseract":
        order = ["tesseract", "easyocr"]
    elif pref == "easyocr":
        order = ["easyocr", "tesseract"]
    elif py313_plus:
        order = ["tesseract", "easyocr"]
    else:
        order = ["easyocr", "tesseract"]

    for engine in order:
        if engine == "tesseract" and _try_tesseract():
            return
        if engine == "easyocr" and _try_easyocr():
            return

    _ocr_engine = "none"
    print(
        "[IntelliDocs AI] No OCR engine available. Install Tesseract OCR or use Python 3.11–3.12 with EasyOCR.",
        flush=True,
    )


_bootstrap_ocr()

ALLOWED_ORIGINS = {
    "http://127.0.0.1:3001",
    "http://localhost:3001",
}


def _corsify(resp):
    origin = request.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Credentials"] = "true"
    else:
        resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


PHOTO_DOC_TYPES = {"photo_2x2", "2x2", "id_photo", "photo"}


def _looks_like_psa_birth_cert(norm_text: str) -> bool:
    """True when OCR text strongly indicates a PSA Certificate of Live Birth."""
    u = (norm_text or "").upper()
    if not u:
        return False
    has_psa = any(
        m in u
        for m in (
            "PHILIPPINE STATISTICS AUTHORITY",
            "PHILIPPINE STATISTICS",
            "CERTIFICATE OF LIVE BIRTH",
        )
    ) or bool(re.search(r"\bPSA\b", u))
    live_birth = "CERTIFICATE OF LIVE BIRTH" in u or "LIVE BIRTH" in u
    if has_psa and live_birth:
        return True
    if has_psa and "REPUBLIC OF THE PHILIPPINES" in u:
        return "DATE OF BIRTH" in u or "PLACE OF BIRTH" in u
    return False


def _resolve_doc_type_from_content(norm_text: str, requested: str) -> str:
    """Prefer document content over upload slot when they disagree (e.g. PSA in SF10 slot)."""
    req = (requested or "").strip().lower()
    if req in PHOTO_DOC_TYPES:
        return req
    if _looks_like_psa_birth_cert(norm_text):
        return "birth_certificate"
    return req


def _image_quality_check(filepath: str, doc_type: str) -> dict:
    """
    Level 1 — image quality gate (blur, size, brightness).
    Must pass before upload is accepted or before OCR runs.
    """
    issues: list[str] = []
    is_photo = doc_type in PHOTO_DOC_TYPES

    try:
        import cv2
        import numpy as np

        img = cv2.imread(filepath)
        if img is None:
            return {
                "pass": False,
                "score": 0,
                "blur_variance": 0.0,
                "message": "Could not read the image file. Try JPG or PNG.",
                "issues": ["Unreadable image file"],
            }

        h, w = img.shape[:2]
        if w < 400 or h < 400:
            issues.append("Image resolution is too low. Move closer or use a higher camera setting.")
        if w > h * 2.2 or h > w * 2.2:
            issues.append("Image looks heavily cropped. Include the full document in the frame.")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        min_lap = 120.0 if is_photo else 55.0
        if lap_var < min_lap:
            issues.append(
                "Photo is too blurry or out of focus. Retake in good lighting with the camera steady."
            )

        mean_brightness = float(np.mean(gray))
        if mean_brightness < 45:
            issues.append("Image is too dark. Use brighter lighting.")
        elif mean_brightness > 235:
            issues.append("Image is overexposed (too bright). Reduce glare and retake.")

        score = _clamp01(lap_var / (min_lap * 2.2))
        passed = len(issues) == 0
        return {
            "pass": passed,
            "score": int(round(score * 100)),
            "blur_variance": round(lap_var, 2),
            "message": "Image quality OK." if passed else issues[0],
            "issues": issues,
        }
    except Exception as e:
        return {
            "pass": True,
            "score": 70,
            "blur_variance": 0.0,
            "message": "Quality check skipped (engine unavailable).",
            "issues": [f"Quality check warning: {type(e).__name__}"],
        }


_ENROLLMENT_MM_EXCLUDE_FIELDS = frozenset({"signature"})


def _clamp_signature_region(
    x: int,
    y: int,
    w: int,
    h: int,
    img_w: int,
    img_h: int,
) -> tuple[int, int, int, int] | None:
    w = max(8, min(w, img_w))
    h = max(8, min(h, img_h))
    x = max(0, min(x, img_w - w))
    y = max(0, min(y, img_h - h))
    if w < 8 or h < 8:
        return None
    return x, y, w, h


def _signature_candidate_regions(
    boxes: list[dict] | None,
    img_w: int,
    img_h: int,
) -> list[tuple[int, int, int, int]]:
    """
    Candidate signature areas on PH school certificates.

    Handwritten signatures usually sit just below the last certification sentence and
    above the printed principal/registrar name — not on the bottom page margin.
    """
    candidates: list[tuple[int, int, int, int]] = []
    seen: set[tuple[int, int, int, int]] = set()

    def _add(x: int, y: int, w: int, h: int) -> None:
        region = _clamp_signature_region(x, y, w, h, img_w, img_h)
        if region and region not in seen:
            seen.add(region)
            candidates.append(region)

    lower_start = int(img_h * 0.45)
    sig_h = max(28, int(img_h * 0.11))
    sig_w = max(int(img_w * 0.38), int(img_w * 0.45))

    authority_kw = ("PRINCIPAL", "REGISTRAR", "HEAD", "ADMINISTRATOR", "SCHOOL PRINCIPAL")
    name_prefix = ("MR.", "MR ", "MRS.", "MS.", "DR.")
    authority_boxes: list[dict] = []
    body_boxes: list[dict] = []
    body_kw = ("CERTIFY", "CERTIFIES", "MORAL", "CHARACTER", "GRADE", "STUDENT", "SCHOOL", "HEREBY")

    if boxes:
        for b in boxes:
            t = str(b.get("text") or "").upper().strip()
            by = float(b.get("y", 0))
            bh = float(b.get("h", 0))
            cy = by + bh / 2.0
            if cy >= lower_start and (
                any(k in t for k in authority_kw)
                or any(t.startswith(p) for p in name_prefix)
            ):
                authority_boxes.append(b)
            if img_h * 0.30 < cy < img_h * 0.86 and any(k in t for k in body_kw):
                body_boxes.append(b)

    # 1) Just below the last certification sentence (most common on good-moral forms).
    if body_boxes:
        body_boxes.sort(key=lambda b: float(b.get("y", 0)), reverse=True)
        last = body_boxes[0]
        last_bottom = int(float(last.get("y", 0)) + float(last.get("h", 0)))
        y_below_text = last_bottom + max(4, int(sig_h * 0.15))
        _add(int(img_w * 0.08), y_below_text, sig_w, sig_h)
        _add(int(img_w * 0.32), y_below_text, sig_w, sig_h)

    # 2) Above printed principal / registrar name in the lower block.
    if authority_boxes:
        authority_boxes.sort(key=lambda b: float(b.get("y", 0)))
        anchor = authority_boxes[0]
        ax = int(float(anchor.get("x", 0)))
        ay = int(float(anchor.get("y", 0)))
        aw = max(20, int(float(anchor.get("w", 40))))
        y_above_name = max(0, ay - sig_h - max(6, int(sig_h * 0.2)))
        _add(max(0, ax - int(aw * 0.2)), y_above_name, sig_w, sig_h)
        _add(int(img_w * 0.30), y_above_name, sig_w, sig_h)

    # 3) Lower-middle band fallback (avoid empty bottom margin).
    _add(int(img_w * 0.10), int(img_h * 0.58), sig_w, sig_h)
    _add(int(img_w * 0.28), int(img_h * 0.62), sig_w, sig_h)

    return candidates


def _score_signature_roi(gray_roi, roi_w: int, roi_h: int) -> tuple[float, bool, float, int]:
    """Return confidence, detected, ink_ratio, stroke_components for a grayscale ROI."""
    import cv2
    import numpy as np

    gray = cv2.GaussianBlur(gray_roi, (3, 3), 0)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    ink_ratio = float(np.count_nonzero(binary)) / float(binary.size)
    edges = cv2.Canny(gray, 40, 120)
    edge_ratio = float(np.count_nonzero(edges)) / float(edges.size)
    variance = float(np.var(gray))
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    stroke_components = sum(
        1
        for c in contours
        if 12 <= cv2.contourArea(c) <= max(800, (roi_w * roi_h) * 0.35)
    )
    score = 0.0
    if ink_ratio >= 0.004:
        score += 0.28
    if ink_ratio >= 0.012:
        score += 0.18
    if edge_ratio >= 0.02:
        score += 0.2
    if variance >= 180:
        score += 0.14
    if stroke_components >= 2:
        score += 0.2
    elif stroke_components >= 1:
        score += 0.1
    confidence = max(0.0, min(1.0, score))
    detected = confidence >= 0.45 and ink_ratio >= 0.003 and stroke_components >= 1
    return confidence, detected, ink_ratio, stroke_components


def _scan_handwritten_signature(
    filepath: str,
    boxes: list[dict] | None,
    img_w: int,
    img_h: int,
) -> dict:
    """
    Visual signature scan — looks for ink strokes in the authority/signature area.
    Complements the OCR keyword label check (Principal/Registrar).
    """
    fallback = {
        "detected": False,
        "confidence": 0.0,
        "bbox": None,
        "note": "Could not scan signature area.",
    }
    try:
        import cv2
    except ImportError:
        fallback["note"] = "OpenCV unavailable for signature scan."
        return fallback

    try:
        img = cv2.imread(filepath)
        if img is None:
            return fallback

        best = {
            "detected": False,
            "confidence": 0.0,
            "bbox": None,
            "note": "No clear handwritten strokes in signature area",
            "ink_ratio": 0.0,
            "stroke_components": 0,
        }
        for x, y, w, h in _signature_candidate_regions(boxes, img_w, img_h):
            roi = img[y : y + h, x : x + w]
            if roi.size == 0:
                continue
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            confidence, detected, ink_ratio, stroke_components = _score_signature_roi(gray, w, h)
            if confidence > best["confidence"] or (detected and not best["detected"]):
                best = {
                    "detected": detected,
                    "confidence": confidence,
                    "bbox": {"x": float(x), "y": float(y), "w": float(w), "h": float(h)},
                    "note": (
                        f"Ink {ink_ratio * 100:.1f}% · {stroke_components} stroke(s)"
                        if detected
                        else "No clear handwritten strokes in signature area"
                    ),
                    "ink_ratio": ink_ratio,
                    "stroke_components": stroke_components,
                }

        if best["bbox"] is None:
            return fallback
        return {
            "detected": bool(best["detected"]),
            "confidence": round(float(best["confidence"]), 2),
            "bbox": best["bbox"],
            "note": str(best["note"]),
        }
    except Exception:
        return fallback


def _append_good_moral_signature_field_check(
    payload: dict,
    filepath: str,
    boxes: list[dict] | None,
    img_w: int | None,
    img_h: int | None,
) -> None:
    """Add visual signature scan result to field_checks for registrar cross-check UI."""
    if not img_w or not img_h:
        return
    sig = _scan_handwritten_signature(filepath, boxes, int(img_w), int(img_h))
    detected = bool(sig.get("detected"))
    confidence = float(sig.get("confidence") or 0.0)
    row: dict = {
        "field": "Signature",
        "expected": "Handwritten signature present",
        "detected": "Found" if detected else "Not detected",
        "ok": detected,
        "match_ratio": round(confidence, 2) if detected else 0.0,
        "scan_method": "visual",
    }
    note = str(sig.get("note") or "").strip()
    if note:
        row["note"] = note
    bb = sig.get("bbox")
    if isinstance(bb, dict):
        for k in ("x", "y", "w", "h"):
            if k in bb:
                row[k] = float(bb[k])
    checks = list(payload.get("field_checks") or [])
    checks = [c for c in checks if str(c.get("field") or "").strip().lower() != "signature"]
    checks.append(row)
    payload["field_checks"] = checks
    if not detected:
        payload["issues"] = (payload.get("issues") or []) + [
            "Signature scan: no handwritten signature detected in the signature area."
        ]


def _level_pack(
    *,
    level: int,
    title: str,
    passed: bool,
    score: int,
    summary: str,
    issues: list[str] | None = None,
) -> dict:
    return {
        "level": level,
        "title": title,
        "pass": bool(passed),
        "score": max(0, min(100, int(score))),
        "summary": summary,
        "issues": issues or [],
    }


def _upload_quality_stub() -> dict:
    """
    Student JPG/PNG uploads already pass Level 1 in PHP (api/documents.php).
    Verification scoring uses document match + integrity only.
    """
    return {
        "pass": True,
        "score": 100,
        "message": "Blur and lighting were verified when the student uploaded this file.",
        "issues": [],
        "checked_at_upload": True,
    }


def _document_match_ratios(
    doc_checks: list[dict],
    field_checks: list[dict],
) -> tuple[float, float]:
    """Label and enrollment-field pass ratios for document-match level."""
    label_ratio = (
        sum(1 for c in doc_checks if c.get("ok")) / len(doc_checks) if doc_checks else 0.0
    )
    field_ratio = (
        sum(1 for c in field_checks if c.get("ok")) / len(field_checks)
        if field_checks
        else 1.0
    )
    return label_ratio, field_ratio


def _concern_display_score(passed: bool, confidence_pct: int) -> int:
    """UI concern % — 0 when a stage is clear, rises as confidence/integrity falls."""
    if passed:
        return 0
    return max(1, min(100, 100 - int(confidence_pct)))


def _single_field_check_concern_pct(check: dict) -> int:
    if check.get("ok"):
        return 0
    mr = check.get("match_ratio")
    if isinstance(mr, (int, float)) and float(mr) >= 0.0:
        return max(1, min(100, 100 - int(round(float(mr) * 100))))
    return 100


def _field_check_concern_pct(field_checks: list[dict]) -> int:
    """Average concern across failed enrollment cross-checks (all mismatches count)."""
    failed = [
        c for c in field_checks
        if not c.get("ok")
        and str(c.get("field") or "").strip().lower() not in _ENROLLMENT_MM_EXCLUDE_FIELDS
    ]
    if not failed:
        return 0
    per_field = [_single_field_check_concern_pct(c) for c in failed]
    return max(1, min(100, int(round(sum(per_field) / len(per_field)))))


def _mismatch_summary_fields(_doc_checks: list[dict], field_checks: list[dict], *, limit: int = 6) -> list[str]:
    """Enrollment cross-check failures only (doc label scans live under Labels on scan)."""
    return [
        str(c.get("field"))
        for c in field_checks
        if not c.get("ok")
        and str(c.get("field") or "").strip().lower() not in _ENROLLMENT_MM_EXCLUDE_FIELDS
    ][:limit]


def _mismatch_level_issues(
    doc_checks: list[dict],
    field_checks: list[dict],
    payload_issues: list[str] | None,
    *,
    limit: int = 8,
) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()

    def _add(msg: str) -> None:
        key = msg.strip().lower()
        if not key or key in seen:
            return
        seen.add(key)
        out.append(msg)

    for c in field_checks:
        if c.get("ok"):
            continue
        field = str(c.get("field") or "").strip()
        if field and field.lower() not in _ENROLLMENT_MM_EXCLUDE_FIELDS:
            _add(f"Mismatch: {field} does not match the student's enrollment.")
    for issue in payload_issues or []:
        text = str(issue).strip()
        if not text:
            continue
        # Skip label-scan messages — shown under Labels on scan, not enrollment mismatch.
        if text.lower().startswith("missing:"):
            continue
        _add(text)

    return out[:limit]


def _document_match_summary(
    doc_checks: list[dict],
    field_checks: list[dict],
    concern_pct: int,
    l2_pass: bool,
) -> str:
    if l2_pass:
        return "No document or enrollment mismatch — 0% concern."
    missing = _mismatch_summary_fields(doc_checks, field_checks)
    if missing:
        return (
            f"Mismatch concern {concern_pct}% — missing or mismatched: {', '.join(missing)}."
        )
    return f"Document or enrollment mismatch — {concern_pct}% concern."


def _build_security_levels(
    *,
    quality: dict,
    doc_type: str,
    payload: dict,
    tamper_score: float,
    tamper_cells: list | None = None,
    tamper_fields: list | None = None,
    quality_enforced_at_upload: bool = False,
) -> dict:
    """Three-level security model returned to PHP / frontend."""
    is_photo = doc_type in PHOTO_DOC_TYPES
    if quality_enforced_at_upload:
        l1_pass = True
        l1_score = 100
        l1_summary = str(
            quality.get("message")
            or "Blur and lighting were verified when the student uploaded this file."
        )
        l1_issues: list[str] = []
    else:
        l1_pass = bool(quality.get("pass"))
        l1_score = int(quality.get("score") or 0)
        l1_summary = str(quality.get("message") or "")
        l1_issues = list(quality.get("issues") or [])

    doc_checks = list(payload.get("doc_checks") or [])
    field_checks = list(payload.get("field_checks") or [])
    ocr_conf = float(payload.get("ocr_confidence") or 0.0)
    match_conf = float(payload.get("confidence") or 0.0)

    if is_photo:
        l2_pass = match_conf >= 0.80
        l2_score = int(round(match_conf * 100))
        l2_summary = (
            "ID photo accepted."
            if l2_pass
            else "ID photo did not pass readability checks."
        )
        l2_issues = list(payload.get("issues") or [])[:4]
    else:
        label_ratio, field_ratio = _document_match_ratios(doc_checks, field_checks)
        # Headline match % must match stored confidence / weighted overall score.
        match_score_pct = int(round(_clamp01(match_conf) * 100))
        l2_score = match_score_pct
        enrollment_ok = not field_checks or all(
            bool(c.get("ok"))
            for c in field_checks
            if str(c.get("field") or "").strip().lower() not in _ENROLLMENT_MM_EXCLUDE_FIELDS
        )
        l2_pass = l2_score >= 62 and label_ratio >= 0.35 and enrollment_ok
        l2_issues = _mismatch_level_issues(
            doc_checks,
            field_checks,
            list(payload.get("issues") or []),
        )

    l2_concern = _concern_display_score(l2_pass, l2_score)
    if not is_photo and field_checks:
        field_concern = _field_check_concern_pct(field_checks)
        if field_concern > 0:
            l2_concern = field_concern
            l2_pass = False
    if not is_photo:
        l2_summary = _document_match_summary(doc_checks, field_checks, l2_concern, l2_pass)
    elif l2_pass:
        l2_summary = "ID photo accepted — 0% concern."
    else:
        l2_summary = f"ID photo readability concern — {l2_concern}%."

    cells = tamper_cells or []
    fields = tamper_fields or []
    tamper_pct = int(round(_clamp01(tamper_score) * 100))
    high_risk = any(str(c.get("risk")) == "high" for c in cells) or any(
        str(f.get("risk")) == "high" for f in fields
    )
    # Level 3 should reflect tamper/integrity only.
    # Overall pass still requires Levels 1–3, but we don't want a quality/match failure
    # to incorrectly show "possible edits" when integrity is clean (e.g., 100%).
    l3_pass = tamper_score >= 0.50 and not (high_risk and tamper_score < 0.65)
    l3_concern = _concern_display_score(l3_pass, tamper_pct)
    if is_photo:
        # Photos do not run tamper analysis.
        l3_pass = True
        l3_concern = 0
        l3_summary = "Tamper scan not required for ID photos — 0% concern."
        l3_issues: list[str] = []
    elif l3_pass:
        hotspot_n = len(cells) + len(fields)
        l3_summary = (
            "Tamper check clear — 0% concern."
            if hotspot_n == 0
            else "Minor integrity flags only — 0% concern; review preview if unsure."
        )
        l3_issues = list(payload.get("tamper_signals") or [])[:4]
    else:
        l3_summary = (
            f"Possible edits detected — {l3_concern}% tamper concern; review highlighted areas."
        )
        l3_issues = list(payload.get("tamper_signals") or [])[:6]

    l2_pack = _level_pack(
        level=2,
        title="Document & enrollment mismatch",
        passed=l2_pass,
        score=l2_concern,
        summary=l2_summary,
        issues=l2_issues,
    )
    l3_pack = _level_pack(
        level=3,
        title="Tamper & integrity",
        passed=l3_pass,
        score=l3_concern,
        summary=l3_summary,
        issues=l3_issues,
    )

    def _security_alert_level(passes: list[bool]) -> int:
        """0 = all clear; increases to the index of the highest failed stage (1-based)."""
        alert = 0
        for i, ok in enumerate(passes):
            if not ok:
                alert = i + 1
        return alert

    if quality_enforced_at_upload:
        # Image quality is blocked at student upload — show only verification levels (renumbered 1–2).
        levels = [
            {**l2_pack, "level": 1},
            {**l3_pack, "level": 2},
        ]
        overall_pass = l2_pass and l3_pass
        alert_level = _security_alert_level([l2_pass, l3_pass])
    else:
        l1_concern = _concern_display_score(l1_pass, l1_score)
        l1_summary_out = (
            "Image quality acceptable — 0% concern."
            if l1_pass
            else f"Image quality concern — {l1_concern}%."
        )
        levels = [
            _level_pack(
                level=1,
                title="Image quality",
                passed=l1_pass,
                score=l1_concern,
                summary=l1_summary_out if l1_pass else (l1_summary or l1_summary_out),
                issues=l1_issues,
            ),
            l2_pack,
            l3_pack,
        ]
        overall_pass = l1_pass and l2_pass and l3_pass
        alert_level = _security_alert_level([l1_pass, l2_pass, l3_pass])

    return {
        "levels": levels,
        "overall_pass": overall_pass,
        "alert_level": alert_level,
        # Legacy field — mirrors alert_level (0 = clear, higher = more concern).
        "highest_level_passed": alert_level,
        "quality_enforced_at_upload": quality_enforced_at_upload,
    }


@app.after_request
def add_cors_headers(response):
    return _corsify(response)


@app.route("/health", methods=["GET"])
def health():
    payload = {"ok": True, "ocr_engine": _ocr_engine}
    if _ocr_engine == "tesseract" and _tesseract_exe:
        payload["tesseract"] = _tesseract_exe
    elif _ocr_engine == "none" and _easyocr_reader is None:
        payload["hint"] = (
            "Tesseract OCR binary not found. Install via apt (`apt-get install tesseract-ocr`) on Linux, "
            "the UB Mannheim build on Windows, or `brew install tesseract` on macOS. "
            "Override the path with the TESSERACT_CMD environment variable. "
            "Alternatively install PyTorch + EasyOCR on Python 3.11–3.12."
        )
    return jsonify(payload)


def _ocr_easyocr(filepath: str) -> tuple[str, float]:
    assert _easyocr_reader is not None
    result = _easyocr_reader.readtext(filepath)
    parts = []
    confs = []
    boxes: list[dict] = []
    for detection in result:
        if len(detection) >= 3:
            t = str(detection[1])
            parts.append(t)
            try:
                confs.append(float(detection[2]))
            except Exception:
                pass
            # bbox is typically 4 points: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            try:
                bbox = detection[0]
                xs = [float(p[0]) for p in bbox]
                ys = [float(p[1]) for p in bbox]
                x1, y1, x2, y2 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
                boxes.append({"text": t, "x": x1, "y": y1, "w": max(1, x2 - x1), "h": max(1, y2 - y1)})
            except Exception:
                pass
    text = " ".join(parts).strip()
    avg_conf = sum(confs) / len(confs) if confs else 0.0
    return text, max(0.0, min(1.0, avg_conf)), boxes


def _ocr_tesseract(filepath: str) -> tuple[str, float, list[dict]]:
    import pytesseract
    from PIL import Image

    image = Image.open(filepath)
    text = pytesseract.image_to_string(image).strip()
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    confs = []
    boxes: list[dict] = []
    for c in data.get("conf", []):
        try:
            n = int(c)
            if n >= 0:
                confs.append(n)
        except (TypeError, ValueError):
            pass
    n_items = len(data.get("text", []))
    for i in range(n_items):
        try:
            t = str(data["text"][i] or "").strip()
            if not t:
                continue
            x = int(data["left"][i])
            y = int(data["top"][i])
            w = int(data["width"][i])
            h = int(data["height"][i])
            conf_raw = data.get("conf", [None] * n_items)[i]
            try:
                conf = float(conf_raw) / 100.0
            except Exception:
                conf = None
            boxes.append({"text": t, "x": x, "y": y, "w": max(1, w), "h": max(1, h), "conf": conf})
        except Exception:
            continue
    avg_0_100 = sum(confs) / len(confs) if confs else 0.0
    avg_conf = max(0.0, min(1.0, avg_0_100 / 100.0))
    return text, avg_conf, boxes


def _tamper_check(filepath: str) -> tuple[float, list[str]]:
    """
    Lightweight tamper signals.
    Returns (tamper_score_01, signals). 1.0 = looks clean, 0.0 = highly suspicious.
    """
    signals: list[str] = []
    score = 1.0

    # --- Metadata (EXIF Software) ---
    try:
        from PIL import Image, ExifTags

        software_tag = None
        for k, v in ExifTags.TAGS.items():
            if v == "Software":
                software_tag = k
                break

        if software_tag is not None:
            img = Image.open(filepath)
            exif = getattr(img, "getexif", lambda: None)()
            if exif:
                sw = str(exif.get(software_tag, "")).strip().lower()
                if sw:
                    suspicious = ["photoshop", "canva", "picsart", "snapseed", "gimp", "lightroom"]
                    if any(t in sw for t in suspicious):
                        signals.append(f"Edited with software: {sw}")
                        score -= 0.35
    except Exception:
        # metadata is optional; ignore failures
        pass

    # --- ELA (JPEG only) ---
    try:
        from PIL import Image, ImageChops
        import numpy as np

        ext = os.path.splitext(filepath)[1].lower()
        if ext in [".jpg", ".jpeg"]:
            original = Image.open(filepath).convert("RGB")
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                tmp_path = tmp.name
            try:
                # Resave at a fixed quality to highlight compression differences.
                original.save(tmp_path, "JPEG", quality=90)
                resaved = Image.open(tmp_path).convert("RGB")
                diff = ImageChops.difference(original, resaved)
                arr = np.asarray(diff, dtype=np.uint8)
                # Variance is a rough proxy for localized artifacts.
                var = float(np.var(arr))

                # Heuristic thresholds (empirical; adjust as you collect samples).
                if var > 120.0:
                    signals.append("ELA: strong local compression artifacts detected")
                    score -= 0.55
                elif var > 70.0:
                    signals.append("ELA: moderate compression artifacts detected")
                    score -= 0.30
            finally:
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
    except Exception:
        # ELA is best-effort; ignore failures.
        pass

    # --- PNG / WebP / GIF / BMP: JPEG round-trip ELA proxy (edits often survive re-export) ---
    try:
        from PIL import Image, ImageChops
        import io
        import numpy as np

        ext = os.path.splitext(filepath)[1].lower()
        if ext in [".png", ".webp", ".gif", ".bmp"]:
            original = Image.open(filepath).convert("RGB")
            buf = io.BytesIO()
            original.save(buf, format="JPEG", quality=90)
            buf.seek(0)
            resaved = Image.open(buf).convert("RGB")
            diff = ImageChops.difference(original, resaved)
            arr = np.asarray(diff, dtype=np.uint8)
            var = float(np.var(arr))
            if var > 95.0:
                signals.append("Round-trip JPEG check: strong artifacts (often seen on edited PNG/scan exports)")
                score -= 0.45
            elif var > 52.0:
                signals.append("Round-trip JPEG check: moderate artifacts")
                score -= 0.22
    except Exception:
        pass

    return _clamp01(score), signals


def _merge_localized_tamper_score(
    global_score: float,
    cells: list[dict] | None,
    fields: list[dict] | None,
) -> tuple[float, list[str]]:
    """
    Global _tamper_check can miss pasted edits. When localized ELA checks flag regions,
    lower the headline tamper_score so the UI matches human-visible hotspots.
    """
    s = _clamp01(float(global_score))
    cells = cells or []
    fields = fields or []
    merged = list(cells) + list(fields)
    if not merged:
        return s, []

    # Some detectors may omit "risk" — treat missing risk as "warning" so any hotspot
    # actually affects the headline integrity score.
    high = 0
    warn = 0
    for x in merged:
        r = str(x.get("risk") or "").lower().strip()
        if r == "high":
            high += 1
        elif r == "warning" or r == "":
            warn += 1
    if high == 0 and warn == 0:
        warn = len(merged)

    # Penalize: high-risk regions are strong evidence of inconsistent compression / edits.
    penalty = min(0.72, high * 0.20 + warn * 0.09)
    s2 = _clamp01(s - penalty)
    signals = []
    if penalty > 0.0:
        signals.append(
            f"Integrity adjusted by hotspots: -{int(round(penalty * 100))}% (high={high}, warning={warn})"
        )
    return s2, signals


def _synthetic_check(filepath: str, *, ocr_confidence: float | None = None, word_count: int | None = None) -> tuple[float, list[str]]:
    """
    Best-effort heuristic to flag documents that look digitally generated (including AI-generated),
    NOT a definitive detector.

    Returns (synthetic_score_01, signals). 1.0 = looks natural/realistic, 0.0 = highly suspicious.
    """
    signals: list[str] = []
    score = 1.0

    ext = os.path.splitext(filepath)[1].lower()

    # --- Metadata hint (EXIF Software) ---
    try:
        from PIL import Image, ExifTags

        software_tag = None
        for k, v in ExifTags.TAGS.items():
            if v == "Software":
                software_tag = k
                break
        if software_tag is not None:
            img = Image.open(filepath)
            exif = getattr(img, "getexif", lambda: None)()
            if exif:
                sw = str(exif.get(software_tag, "")).strip()
                if sw:
                    sw_l = sw.lower()
                    suspicious = ["photoshop", "canva", "picsart", "snapseed", "gimp", "lightroom", "adobe"]
                    if any(t in sw_l for t in suspicious):
                        signals.append(f"Metadata: created/edited with software ({sw})")
                        score -= 0.25
    except Exception:
        pass

    # --- Pixel-level heuristics ---
    # Goal: find overly-clean images with sharp text + low noise, common in screenshots / synthetic renders.
    try:
        import cv2
        import numpy as np

        img = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
        if img is None or img.size == 0:
            return _clamp01(score), signals

        h, w = int(img.shape[0]), int(img.shape[1])
        if h < 50 or w < 50:
            return _clamp01(score), signals

        # Sharpness proxy (Laplacian variance)
        lap = cv2.Laplacian(img, cv2.CV_64F)
        sharp = float(np.var(lap))

        # Noise proxy (high-frequency residual magnitude)
        blur = cv2.GaussianBlur(img, (0, 0), 1.2)
        resid = cv2.absdiff(img, blur)
        resid_mean = float(np.mean(resid))
        resid_std = float(np.std(resid))

        # Flat-area ratio: large portion of pixels near the median => suspiciously uniform background
        med = float(np.median(img))
        flat_ratio = float(np.mean(np.abs(img.astype(np.float32) - med) < 3.0))

        # Edge density: lots of crisp edges, typical of screenshots / digital text
        edges = cv2.Canny(img, 60, 160)
        edge_ratio = float(np.mean(edges > 0))

        # Heuristics (tunable): combine multiple weak signals
        # These thresholds are intentionally a bit sensitive to catch AI/synthetic document renders.
        if sharp > 750.0 and resid_mean < 3.2 and resid_std < 5.5 and flat_ratio > 0.55:
            signals.append("Image looks extremely clean with very sharp edges (screenshot/synthetic-like)")
            score -= 0.45
        elif sharp > 600.0 and resid_mean < 4.0 and flat_ratio > 0.60:
            signals.append("Image looks very clean with sharp text and low scan noise")
            score -= 0.25

        if edge_ratio > 0.07 and resid_mean < 4.2:
            signals.append("High edge density with low noise (digital render/screenshot indicator)")
            score -= 0.18

        # PNGs are often screenshots; if PNG + very low noise, increase penalty
        if ext == ".png" and resid_mean < 3.6 and flat_ratio > 0.52:
            signals.append("PNG with unusually low noise (often from screenshots or digital export)")
            score -= 0.18

        # Geometry: screenshot/rendered docs often have many perfectly horizontal/vertical lines.
        try:
            lines = cv2.HoughLinesP(edges, 1, np.pi / 180.0, threshold=120, minLineLength=max(40, int(min(w, h) * 0.12)), maxLineGap=6)
            if lines is not None and len(lines) >= 12:
                near_axis = 0
                total = 0
                for ln in lines[:300]:
                    x1, y1, x2, y2 = ln[0]
                    dx = float(x2 - x1)
                    dy = float(y2 - y1)
                    if abs(dx) < 1e-6 and abs(dy) < 1e-6:
                        continue
                    ang = abs(np.degrees(np.arctan2(dy, dx)))
                    # normalize to 0..90
                    if ang > 90:
                        ang = 180 - ang
                    total += 1
                    if ang < 2.0 or abs(ang - 90.0) < 2.0:
                        near_axis += 1
                if total >= 10:
                    ratio = near_axis / total
                    if ratio >= 0.78 and edge_ratio > 0.05:
                        signals.append("Many perfectly straight horizontal/vertical lines (digital layout indicator)")
                        score -= 0.18
        except Exception:
            pass

        # OCR synergy: synthetic renders often produce unusually high OCR confidence with low noise.
        try:
            oc = float(ocr_confidence) if ocr_confidence is not None else None
            wc = int(word_count) if word_count is not None else None
            if oc is not None and wc is not None and wc >= 15 and oc >= 0.78 and resid_mean < 4.0 and sharp > 550.0:
                signals.append("Very high OCR readability + low noise (common in digitally generated text)")
                score -= 0.12
        except Exception:
            pass
    except Exception:
        pass

    return _clamp01(score), signals


def _compute_ela_diff(filepath: str) -> tuple["object|None", float | None]:
    """
    Returns (diff_array_uint8_RGB, variance) for JPEG ELA, or (None, None) if not applicable.
    """
    try:
        from PIL import Image, ImageChops
        import numpy as np

        ext = os.path.splitext(filepath)[1].lower()
        if ext not in [".jpg", ".jpeg"]:
            return None, None
        original = Image.open(filepath).convert("RGB")
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = tmp.name
        try:
            original.save(tmp_path, "JPEG", quality=90)
            resaved = Image.open(tmp_path).convert("RGB")
            diff = ImageChops.difference(original, resaved)
            arr = np.asarray(diff, dtype=np.uint8)
            return arr, float(np.var(arr))
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
    except Exception:
        return None, None


def _compute_noise_residual(filepath: str) -> "object|None":
    """
    For PNG / non-JPEG images where ELA isn't meaningful, compute a simple noise-residual map.
    Returns a 2D uint8 array where higher values mean stronger local high-frequency residue.
    """
    try:
        import cv2
        import numpy as np

        img = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
        if img is None or img.size == 0:
            return None
        # Median blur approximates the "smooth" layer; residual highlights pasted/sharp edits.
        blur = cv2.medianBlur(img, 5)
        resid = cv2.absdiff(img, blur)
        resid = np.asarray(resid, dtype=np.uint8)
        return resid
    except Exception:
        return None


def _compute_tamper_map(filepath: str) -> "object|None":
    """
    Build a 2D grayscale "residual" map that highlights locally inconsistent regions for ANY format.

    Strategy (robust across JPEG and PNG/screenshots):
      1. JPEG round-trip ELA: re-save in-memory as JPEG and diff against the original. Pasted/edited
         regions usually have a different compression history, so they light up.
      2. Add a median-blur noise residual so non-JPEG edits (sharp paste edges) are also captured.
    The two maps are combined (max), which catches more edit types than either alone.

    Returns a 2D uint8 numpy array, or None.
    """
    try:
        from PIL import Image, ImageChops
        import io
        import numpy as np

        original = Image.open(filepath).convert("RGB")
        buf = io.BytesIO()
        original.save(buf, format="JPEG", quality=90)
        buf.seek(0)
        resaved = Image.open(buf).convert("RGB")
        ela = ImageChops.difference(original, resaved)
        ela_gray = np.asarray(ela.convert("L"), dtype=np.float32)

        combined = ela_gray
        try:
            import cv2

            g = np.asarray(original.convert("L"), dtype=np.uint8)
            blur = cv2.medianBlur(g, 5)
            resid = cv2.absdiff(g, blur).astype(np.float32)
            # Normalize both to comparable 0..255 ranges before combining.
            def _norm(a: "np.ndarray") -> "np.ndarray":
                mx = float(a.max()) if a.size else 0.0
                if mx <= 1e-6:
                    return a
                return a * (255.0 / mx)

            combined = np.maximum(_norm(ela_gray), _norm(resid))
        except Exception:
            pass

        return np.clip(combined, 0, 255).astype(np.uint8)
    except Exception:
        return None


def _grid_hotspot_tamper(
    tamper_map: "object|None",
    image_w: int | None,
    image_h: int | None,
) -> list[dict]:
    """
    OCR-INDEPENDENT tamper detection.

    Earlier detectors only flagged a region when OCR successfully located a label + value box.
    When OCR misses a header (common on PSA / good-moral scans), edits went completely undetected.

    This scans the WHOLE image on a grid, computes the mean residual per cell, and flags cells whose
    residual is a strong statistical outlier (robust z-score via the median + MAD). Adjacent flagged
    cells are clustered into bounding boxes. This catches pasted/edited regions even with no OCR text.
    """
    if tamper_map is None or not image_w or not image_h:
        return []
    try:
        import numpy as np
    except Exception:
        return []

    arr = tamper_map
    if not hasattr(arr, "shape") or arr.ndim != 2:
        return []
    h_img, w_img = int(arr.shape[0]), int(arr.shape[1])
    if h_img < 32 or w_img < 32:
        return []

    # ~28px cells, clamped to a sane grid so tiny/huge images behave.
    cell = max(16, int(round(min(w_img, h_img) / 28.0)))
    rows = max(4, h_img // cell)
    cols = max(4, w_img // cell)

    means = np.zeros((rows, cols), dtype=np.float32)
    # "content" = cells that actually contain ink/edges, so we don't flag blank-paper noise.
    content = np.zeros((rows, cols), dtype=bool)
    for r in range(rows):
        y1 = int(r * h_img / rows)
        y2 = int((r + 1) * h_img / rows)
        for c in range(cols):
            x1 = int(c * w_img / cols)
            x2 = int((c + 1) * w_img / cols)
            roi = arr[y1:y2, x1:x2]
            if roi.size == 0:
                continue
            m = float(roi.mean())
            means[r, c] = m
            # A cell has content if it has enough strong-residual pixels (ink/edges/paste seams).
            content[r, c] = bool((roi > 28).mean() > 0.04)

    vals = means[content]
    if vals.size < 8:
        return []

    median = float(np.median(vals))
    mad = float(np.median(np.abs(vals - median))) or 1.0
    # Robust z-score; 0.6745 makes MAD comparable to std for normal data.
    z = 0.6745 * (means - median) / mad

    HIGH_Z = 7.0
    WARN_Z = 4.5
    flagged = np.zeros((rows, cols), dtype=np.int8)
    flagged[(z >= WARN_Z) & content] = 1
    flagged[(z >= HIGH_Z) & content] = 2

    if not flagged.any():
        return []

    # Cluster contiguous flagged cells (4-neighborhood) into bounding boxes.
    visited = np.zeros((rows, cols), dtype=bool)
    suspects: list[dict] = []
    for r in range(rows):
        for c in range(cols):
            if flagged[r, c] == 0 or visited[r, c]:
                continue
            stack = [(r, c)]
            visited[r, c] = True
            cells: list[tuple[int, int]] = []
            max_level = 1
            while stack:
                cr, cc = stack.pop()
                cells.append((cr, cc))
                max_level = max(max_level, int(flagged[cr, cc]))
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nr, nc = cr + dr, cc + dc
                    if 0 <= nr < rows and 0 <= nc < cols and not visited[nr, nc] and flagged[nr, nc] > 0:
                        visited[nr, nc] = True
                        stack.append((nr, nc))

            # Ignore single isolated warning cells (likely scan noise); require a real cluster.
            if max_level < 2 and len(cells) < 2:
                continue

            rs = [p[0] for p in cells]
            cs = [p[1] for p in cells]
            x1 = int(min(cs) * w_img / cols)
            x2 = int((max(cs) + 1) * w_img / cols)
            y1 = int(min(rs) * h_img / rows)
            y2 = int((max(rs) + 1) * h_img / rows)
            peak_z = float(z[rs, cs].max()) if cells else 0.0
            suspects.append(
                {
                    "field": "REGION",
                    "text": "",
                    "x": x1,
                    "y": y1,
                    "w": max(1, x2 - x1),
                    "h": max(1, y2 - y1),
                    "var": round(peak_z, 2),
                    "ratio": round(peak_z, 2),
                    "risk": "high" if max_level >= 2 else "warning",
                }
            )

    # Keep the strongest few so a noisy scan can't produce dozens of boxes.
    suspects.sort(key=lambda s: s.get("ratio", 0.0), reverse=True)
    return suspects[:6]


def _sf9_cell_tamper(diff_arr: "object|None", boxes: list[dict]) -> list[dict]:
    """
    For SF9/report card: flag suspicious numeric cells using local ELA variance near OCR boxes.
    Returns list of suspicious cells with coordinates and scores.
    """
    if diff_arr is None or not boxes:
        return []
    try:
        import numpy as np
    except Exception:
        return []

    arr = diff_arr
    if not hasattr(arr, "shape"):
        return []
    h_img = int(arr.shape[0])
    w_img = int(arr.shape[1])

    suspects: list[dict] = []

    def is_grade_token(t: str) -> bool:
        tt = t.strip()
        if not tt.isdigit():
            return False
        n = int(tt)
        return 50 <= n <= 100  # typical grade range

    roi_vars: list[float] = []
    candidates: list[tuple[dict, float]] = []

    for b in boxes:
        try:
            t = str(b.get("text", "")).strip()
            if not is_grade_token(t):
                continue
            x = int(b.get("x", 0))
            y = int(b.get("y", 0))
            w = int(b.get("w", 0))
            hh = int(b.get("h", 0))
            if w <= 0 or hh <= 0:
                continue
            pad = max(2, int(max(w, hh) * 0.35))
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(w_img, x + w + pad)
            y2 = min(h_img, y + hh + pad)
            if x2 - x1 < 3 or y2 - y1 < 3:
                continue
            roi = np.asarray(arr[y1:y2, x1:x2], dtype=np.uint8)
            v = float(np.var(roi))
            roi_vars.append(v)
            candidates.append(({"text": t, "x": x, "y": y, "w": w, "h": hh}, v))
        except Exception:
            continue

    if not candidates:
        return []

    # Use robust baseline: median variance among grade candidates.
    baseline = float(np.median(np.asarray(roi_vars, dtype=np.float32))) if roi_vars else 0.0
    if baseline <= 1e-6:
        baseline = 1.0

    # Flag outliers relative to baseline to reduce false positives across different scans.
    for cell, v in candidates:
        ratio = v / baseline
        if ratio >= 2.8:
            suspects.append({**cell, "ela_var": round(v, 2), "ratio": round(ratio, 2), "risk": "high"})
        elif ratio >= 2.0:
            suspects.append({**cell, "ela_var": round(v, 2), "ratio": round(ratio, 2), "risk": "warning"})
    return suspects


def _sf9_field_tamper(diff_arr: "object|None", boxes: list[dict], image_w: int | None, image_h: int | None) -> list[dict]:
    """
    Flag suspicious non-grade fields for SF9/report cards:
    LRN line, Name, Year/Section, Adviser.
    Uses OCR boxes and local artifact/noise outlier scoring.
    """
    if diff_arr is None or not boxes or not image_w or not image_h:
        return []
    try:
        import numpy as np
        import re
    except Exception:
        return []

    arr = diff_arr
    if not hasattr(arr, "shape"):
        return []
    h_img = int(arr.shape[0])
    w_img = int(arr.shape[1])

    # Helper: ROI variance around a box
    def roi_var(x: int, y: int, w: int, h: int) -> float | None:
        pad = max(2, int(max(w, h) * 0.45))
        x1 = max(0, x - pad)
        y1 = max(0, y - pad)
        x2 = min(w_img, x + w + pad)
        y2 = min(h_img, y + h + pad)
        if x2 - x1 < 3 or y2 - y1 < 3:
            return None
        roi = np.asarray(arr[y1:y2, x1:x2], dtype=np.uint8)
        return float(np.var(roi))

    # Baseline across header area (top ~45%): robust median of ROI variances
    header_y2 = int(image_h * 0.45)
    header_vars: list[float] = []
    for b in boxes:
        try:
            x = int(b.get("x", 0))
            y = int(b.get("y", 0))
            w = int(b.get("w", 0))
            h = int(b.get("h", 0))
            if y > header_y2:
                continue
            v = roi_var(x, y, w, h)
            if v is not None:
                header_vars.append(v)
        except Exception:
            continue
    baseline = float(np.median(np.asarray(header_vars, dtype=np.float32))) if header_vars else 1.0
    if baseline <= 1e-6:
        baseline = 1.0

    # Find label boxes
    def norm(t: str) -> str:
        return re.sub(r"[^A-Z0-9/ ]+", "", t.upper()).strip()

    label_keys = {
        "LRN": ["LRN", "IRN", "URN"],
        "NAME": ["NAME"],
        "YEAR_SECTION": ["YEAR/SECTION", "YEAR SECTION", "SECTION"],
        "ADVISER": ["ADVISER", "ADVISOR"],
    }

    label_boxes: dict[str, list[dict]] = {k: [] for k in label_keys}
    for b in boxes:
        t = str(b.get("text", "") or "")
        nt = norm(t)
        for key, variants in label_keys.items():
            if any(v in nt for v in variants):
                label_boxes[key].append(b)

    # Given a label box, choose the "value" box to the right on same line
    def find_value_box(lbl: dict) -> dict | None:
        try:
            lx = int(lbl.get("x", 0))
            ly = int(lbl.get("y", 0))
            lw = int(lbl.get("w", 0))
            lh = int(lbl.get("h", 0))
            lcy = ly + lh / 2.0
        except Exception:
            return None

        best = None
        best_score = None
        for b in boxes:
            try:
                x = int(b.get("x", 0))
                y = int(b.get("y", 0))
                w = int(b.get("w", 0))
                h = int(b.get("h", 0))
                if x <= lx + lw + 4:
                    continue
                # same line: y-centers close
                cy = y + h / 2.0
                if abs(cy - lcy) > max(12.0, lh * 0.9):
                    continue
                # score: prefer closest to the right
                dx = x - (lx + lw)
                if best_score is None or dx < best_score:
                    best_score = dx
                    best = b
            except Exception:
                continue
        return best

    suspects: list[dict] = []

    def add_if_suspicious(label: str, box: dict, value_text: str | None = None):
        try:
            x = int(box.get("x", 0))
            y = int(box.get("y", 0))
            w = int(box.get("w", 0))
            h = int(box.get("h", 0))
            v = roi_var(x, y, w, h)
            if v is None:
                return
            ratio = v / baseline
            if ratio >= 2.6:
                risk = "high"
            elif ratio >= 1.9:
                risk = "warning"
            else:
                return
            suspects.append(
                {
                    "field": label,
                    "text": value_text if value_text is not None else str(box.get("text", "")).strip(),
                    "x": x,
                    "y": y,
                    "w": w,
                    "h": h,
                    "var": round(v, 2),
                    "ratio": round(ratio, 2),
                    "risk": risk,
                }
            )
        except Exception:
            return

    # LRN: accept either the value box next to the label or a 12-digit number in top region
    for lbl in label_boxes["LRN"]:
        vb = find_value_box(lbl)
        if vb:
            add_if_suspicious("LRN", vb)

    # Name, Year/Section, Adviser
    for key, field_name in [("NAME", "NAME"), ("YEAR_SECTION", "YEAR/SECTION"), ("ADVISER", "ADVISER")]:
        for lbl in label_boxes[key]:
            vb = find_value_box(lbl)
            if vb:
                add_if_suspicious(field_name, vb)

    # Fallback: any 12-digit number near top 25% can be LRN value (even if label missed)
    try:
        top_y2 = int(image_h * 0.25)
        for b in boxes:
            t = str(b.get("text", "")).strip()
            if not t:
                continue
            y = int(b.get("y", 999999))
            if y > top_y2:
                continue
            if re.search(r"\b\d{12}\b", t):
                add_if_suspicious("LRN", b, value_text=t)
    except Exception:
        pass

    return suspects


def _keyword_field_tamper(
    diff_arr: "object|None",
    boxes: list[dict],
    image_w: int | None,
    image_h: int | None,
    field_map: dict[str, list[str]],
    *,
    search_y_max_ratio: float = 0.9,
) -> list[dict]:
    """
    Generic field tamper detector for non-table documents.
    Finds label boxes by keyword variants and then picks the nearest value box to the right on the same line.
    Uses local artifact/noise variance ratio vs median baseline of the search area.
    Returns list of suspects with bounding boxes.
    """
    if diff_arr is None or not boxes or not image_w or not image_h:
        return []
    try:
        import numpy as np
        import re
    except Exception:
        return []

    arr = diff_arr
    if not hasattr(arr, "shape"):
        return []
    h_img = int(arr.shape[0])
    w_img = int(arr.shape[1])

    def roi_var(x: int, y: int, w: int, h: int) -> float | None:
        pad = max(2, int(max(w, h) * 0.45))
        x1 = max(0, x - pad)
        y1 = max(0, y - pad)
        x2 = min(w_img, x + w + pad)
        y2 = min(h_img, y + h + pad)
        if x2 - x1 < 3 or y2 - y1 < 3:
            return None
        roi = np.asarray(arr[y1:y2, x1:x2], dtype=np.uint8)
        return float(np.var(roi))

    def norm(t: str) -> str:
        return re.sub(r"[^A-Z0-9/ ]+", "", t.upper()).strip()

    y_max = int(image_h * search_y_max_ratio)
    baseline_vars: list[float] = []
    for b in boxes:
        try:
            x = int(b.get("x", 0))
            y = int(b.get("y", 0))
            w = int(b.get("w", 0))
            h = int(b.get("h", 0))
            if y > y_max:
                continue
            v = roi_var(x, y, w, h)
            if v is not None:
                baseline_vars.append(v)
        except Exception:
            continue
    baseline = float(np.median(np.asarray(baseline_vars, dtype=np.float32))) if baseline_vars else 1.0
    if baseline <= 1e-6:
        baseline = 1.0

    # find label boxes
    label_boxes: dict[str, list[dict]] = {k: [] for k in field_map}
    for b in boxes:
        t = str(b.get("text", "") or "")
        nt = norm(t)
        for field, variants in field_map.items():
            if any(v in nt for v in variants):
                label_boxes[field].append(b)

    def find_value_box(lbl: dict) -> dict | None:
        try:
            lx = int(lbl.get("x", 0))
            ly = int(lbl.get("y", 0))
            lw = int(lbl.get("w", 0))
            lh = int(lbl.get("h", 0))
            lcy = ly + lh / 2.0
        except Exception:
            return None

        best = None
        best_dx = None
        for b in boxes:
            try:
                x = int(b.get("x", 0))
                y = int(b.get("y", 0))
                w = int(b.get("w", 0))
                h = int(b.get("h", 0))
                if x <= lx + lw + 4:
                    continue
                cy = y + h / 2.0
                if abs(cy - lcy) > max(12.0, lh * 0.9):
                    continue
                dx = x - (lx + lw)
                if best_dx is None or dx < best_dx:
                    best_dx = dx
                    best = b
            except Exception:
                continue
        return best

    suspects: list[dict] = []
    for field, lbls in label_boxes.items():
        for lbl in lbls:
            vb = find_value_box(lbl)
            if not vb:
                continue
            try:
                x = int(vb.get("x", 0))
                y = int(vb.get("y", 0))
                w = int(vb.get("w", 0))
                h = int(vb.get("h", 0))
                v = roi_var(x, y, w, h)
                if v is None:
                    continue
                ratio = v / baseline
                if ratio >= 2.6:
                    risk = "high"
                elif ratio >= 1.9:
                    risk = "warning"
                else:
                    continue
                suspects.append(
                    {
                        "field": field,
                        "text": str(vb.get("text", "")).strip(),
                        "x": x,
                        "y": y,
                        "w": w,
                        "h": h,
                        "var": round(v, 2),
                        "ratio": round(ratio, 2),
                        "risk": risk,
                    }
                )
            except Exception:
                continue

    # de-duplicate (same region detected multiple times)
    uniq: list[dict] = []
    seen = set()
    for s in suspects:
        key = (s.get("field"), int(s.get("x", 0)), int(s.get("y", 0)), int(s.get("w", 0)), int(s.get("h", 0)))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(s)
    return uniq


def _composite_verify_score(
    *,
    is_photo: bool,
    ocr_confidence: float,
    word_count: int,
    doc_checks: list[dict],
    field_checks: list[dict],
    detected_lrn: str | None,
    doc_type: str,
) -> float:
    """
    Verification score (0..1) from label checks, enrollment cross-checks, and OCR.
    Not the same as raw OCR confidence — reflects how well the scan matches requirements.
    """
    ocr = max(0.0, min(1.0, float(ocr_confidence)))
    if is_photo:
        return 0.92

    weighted: list[tuple[float, float]] = []

    if doc_checks:
        label_ratio = sum(1 for c in doc_checks if c.get("ok")) / len(doc_checks)
        weighted.append((0.50, label_ratio))

    if field_checks:
        field_ratio = sum(1 for c in field_checks if c.get("ok")) / len(field_checks)
        weighted.append((0.30, field_ratio))

    weighted.append((0.20, ocr))

    base = sum(w * v for w, v in weighted) / sum(w for w, _ in weighted)

    if word_count < 10:
        base -= 0.18
    elif word_count < 20:
        base -= 0.08

    academic = ("form137", "sf10", "form157", "sf9", "report_card")
    if doc_type in academic and not detected_lrn:
        base -= 0.10

    return max(0.0, min(1.0, base))


def _evaluate(
    text: str,
    ocr_confidence: float,
    doc_type: str,
    boxes: list[dict] | None = None,
    img_h: int | None = None,
    expected: dict | None = None,
) -> dict:
    def clamp01(x: float) -> float:
        return max(0.0, min(1.0, float(x)))

    upper_text = text.upper()
    word_count = len(text.split())
    verified = False
    issues = []

    def normalize(u: str) -> str:
        # Keep only letters/numbers/common separators; collapse whitespace.
        try:
            import re

            s = u.upper()
            s = s.replace("\u00ad", "")  # soft hyphen noise
            s = re.sub(r"\s+", " ", s)
            s = re.sub(r"[^A-Z0-9:/# \-]", " ", s)
            s = re.sub(r"\s+", " ", s).strip()
            return s
        except Exception:
            return (u or "").upper()

    def contains_any(u: str, needles: list[str]) -> bool:
        uu = u.upper()
        return any(n.upper() in uu for n in needles)

    def extract_lrn_from_text(u: str) -> str | None:
        """
        Extract an LRN from raw OCR text.
        OCR often misreads 'LRN' as 'IRN', 'URN', etc. Accept common variants.
        """
        try:
            import re

            s = normalize(u)

            # Strict: label + digits
            m = re.search(r"\b[LIU]RN\s*[:#]?\s*([0-9]{12})\b", s)
            if m:
                return m.group(1)

            # Some forms include "LEARNER REFERENCE NO."
            m = re.search(r"\b(LEARNER|LEARNERS)\s+(REFERENCE|REF)\s+(NO|NUMBER)\s*[:#]?\s*([0-9]{12})\b", s)
            if m:
                return m.group(4)

            # Fallback: 12-digit number anywhere (lower confidence; use boxes when possible)
            m = re.search(r"\b([0-9]{12})\b", s)
            if m:
                return m.group(1)
        except Exception:
            pass
        return None

    def extract_lrn_from_boxes(_boxes: list[dict] | None, _img_h: int | None) -> str | None:
        """
        Prefer LRN values from OCR boxes.

        Fixes the exact problem you’re seeing: the LRN is clearly printed (e.g. "LRN: 40314715023")
        but a whole-page regex can miss/misread it. We:
        - First, find an OCR box that contains the label (LRN / IRN / URN).
        - Then read the nearest value box to the right on the same row.
        - Finally fall back to any 12-digit token in the top third.
        """
        if not _boxes or not _img_h:
            return None
        try:
            import re

            top_y2 = int(_img_h * 0.33)
            normed: list[dict] = []
            for b in _boxes:
                t = str(b.get("text", "") or "").strip()
                if not t:
                    continue
                try:
                    x = int(b.get("x", 0))
                    y = int(b.get("y", 999999))
                    w = int(b.get("w", 0))
                    h = int(b.get("h", 0))
                except Exception:
                    continue
                if y > top_y2:
                    continue
                nt = normalize(t)
                normed.append({"t": nt, "raw": t, "x": x, "y": y, "w": w, "h": h})

            # 1) Find label box and read value to the right on same row.
            labels = [b for b in normed if re.search(r"\b[LIU]RN\b", b["t"])]
            labels.sort(key=lambda b: (b["y"], b["x"]))
            for lb in labels[:3]:
                lcy = lb["y"] + lb["h"] / 2.0
                candidates = [
                    b
                    for b in normed
                    if b is not lb
                    and b["x"] > lb["x"] + max(6, int(lb["w"] * 0.5))
                    and abs((b["y"] + b["h"] / 2.0) - lcy) <= max(14.0, lb["h"] * 1.1)
                ]
                candidates.sort(key=lambda b: b["x"])
                joined = " ".join(b["t"] for b in candidates[:4])
                # Allow spaces/hyphens between digits: "4031 4715 023" etc.
                m = re.search(r"\b([0-9][0-9 \-]{10,20}[0-9])\b", joined)
                if m:
                    digits = re.sub(r"\D+", "", m.group(1))
                    if len(digits) == 12:
                        return digits

            # 2) Fallback: any 12-digit token in top third (lower confidence).
            for b in normed:
                m = re.search(r"\b([0-9]{12})\b", b["t"])
                if m:
                    return m.group(1)
        except Exception:
            return None
        return None

    # Photo-only requirements (e.g., 2x2 picture) are not expected to contain readable text.
    photo_types = {"photo_2x2", "2x2", "id_photo", "photo"}
    is_photo = doc_type in photo_types

    if (not is_photo) and word_count < 10:
        issues.append("Very little text detected (image may be too blurry).")

    ocr_confidence = clamp01(ocr_confidence)
    verify_score = ocr_confidence

    def penalize(amount: float):
        nonlocal verify_score
        verify_score = clamp01(verify_score - amount)

    norm_text = normalize(upper_text)
    requested_doc_type = (doc_type or "").strip().lower()
    doc_type = _resolve_doc_type_from_content(norm_text, requested_doc_type)
    if doc_type == "birth_certificate" and requested_doc_type not in ("birth_certificate", "birthcert"):
        issues.append(
            "Document content matches a PSA birth certificate; using identity checks only (not school record fields)."
        )
    lrn_from_boxes = extract_lrn_from_boxes(boxes, img_h)
    lrn_from_text = extract_lrn_from_text(norm_text)
    detected_lrn = lrn_from_boxes or lrn_from_text

    # --- Doc-specific "what we check" lists (for clearer UI) ---
    doc_checks: list[dict] = []
    if not is_photo:
        try:
            import re

            def has_any(needles: list[str]) -> bool:
                return contains_any(norm_text, needles)

            def has_date_like() -> bool:
                # Not strict date parsing; just look for common DOB formats.
                return bool(
                    re.search(r"\b(19|20)\d{2}[-/](0?\d|1[0-2])[-/](0?\d|[12]\d|3[01])\b", norm_text)
                    or re.search(r"\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[A-Z]*\b", norm_text)
                )

            if doc_type in ("birth_certificate", "birthcert"):
                # PSA Birth Certificate checks
                psa_header = has_any(["PHILIPPINE STATISTICS AUTHORITY", "PHILIPPINE STATISTICS", "PSA"])
                live_birth = has_any(["CERTIFICATE OF LIVE BIRTH", "LIVE BIRTH"])
                rep = has_any(["REPUBLIC OF THE PHILIPPINES"])
                name_kw = has_any(["NAME"])
                dob_kw = has_any(["DATE OF BIRTH", "BIRTHDATE", "DATE"])
                pob_kw = has_any(["PLACE OF BIRTH", "PLACE"])
                sex_kw = has_any(["SEX", "MALE", "FEMALE"])
                reg_kw = has_any(["REGISTRY", "REGISTRY NO", "REGISTRY NO.", "REGISTRY NUMBER"])
                date_like = has_date_like()

                doc_checks = [
                    {"field": "PSA header (PSA/Philippine Statistics Authority)", "ok": bool(psa_header)},
                    {"field": "Title (Certificate of Live Birth)", "ok": bool(live_birth)},
                    {"field": "Republic of the Philippines header", "ok": bool(rep)},
                    {"field": "Name label", "ok": bool(name_kw)},
                    {"field": "Date of birth label", "ok": bool(dob_kw)},
                    {"field": "Place of birth label", "ok": bool(pob_kw)},
                    {"field": "Sex label/value", "ok": bool(sex_kw)},
                    {"field": "Registry number label", "ok": bool(reg_kw)},
                    {"field": "Any date-like text found", "ok": bool(date_like)},
                ]
            elif doc_type in ("good_moral", "goodmoral"):
                # Good Moral Certificate checks
                moral_kw = has_any(["GOOD MORAL", "MORAL CHARACTER", "GOOD MORAL CHARACTER"])
                cert_kw = has_any(["CERTIFICATION", "CERTIFICATE"])
                name_kw = has_any(["NAME"])
                school_kw = has_any(["SCHOOL", "ACADEMY", "HIGH SCHOOL", "SENIOR HIGH"])
                date_kw = has_any(["DATE", "ISSUED", "THIS", "DAY OF"]) or has_date_like()
                principal_kw = has_any(["PRINCIPAL", "REGISTRAR", "HEAD", "SIGNED"])

                doc_checks = [
                    {"field": "Good moral / moral character keyword", "ok": bool(moral_kw)},
                    {"field": "Certification/Certificate keyword", "ok": bool(cert_kw)},
                    {"field": "Name label", "ok": bool(name_kw)},
                    {"field": "School name keyword", "ok": bool(school_kw)},
                    {"field": "Date/issuance text found", "ok": bool(date_kw)},
                    {"field": "Authority/signature keyword (Principal/Registrar)", "ok": bool(principal_kw)},
                ]
            elif doc_type in ("sf9", "report_card"):
                # SF9 / Report card checks
                lrn_present = bool(detected_lrn)
                grade_kw = has_any(["GRADE", "GRADES", "FINAL", "AVERAGE"])
                school_year_kw = has_any(["SCHOOL YEAR", "SY"])
                learner_kw = has_any(["LEARNER", "LEARNER'S", "LEARNERS"])
                name_kw = has_any(["NAME"])
                section_kw = has_any(["SECTION", "YEAR/SECTION", "YEAR SECTION"])

                doc_checks = [
                    {"field": "LRN detected", "ok": bool(lrn_present)},
                    {"field": "Grades keyword (GRADE/FINAL/AVERAGE)", "ok": bool(grade_kw)},
                    {"field": "School year keyword (SY / SCHOOL YEAR)", "ok": bool(school_year_kw)},
                    {"field": "Learner keyword", "ok": bool(learner_kw)},
                    {"field": "Name label", "ok": bool(name_kw)},
                    {"field": "Section keyword", "ok": bool(section_kw)},
                ]
            elif doc_type in ("sf10", "form137", "form157"):
                # SF10 / Form137 / Form157 checks
                lrn_present = bool(detected_lrn)
                form_kw = has_any(["SF10", "FORM 137", "FORM137", "SCHOOL FORM 10", "FORM 157", "FORM157"])
                school_kw = has_any(["SCHOOL"])
                school_year_kw = has_any(["SCHOOL YEAR", "SY"])
                name_kw = has_any(["NAME"])
                grade_kw = has_any(["GRADE", "GRADES"])

                doc_checks = [
                    {"field": "LRN detected", "ok": bool(lrn_present)},
                    {"field": "Form keyword (SF10 / Form 137 / Form 157)", "ok": bool(form_kw)},
                    {"field": "School keyword", "ok": bool(school_kw)},
                    {"field": "School year keyword (SY / SCHOOL YEAR)", "ok": bool(school_year_kw)},
                    {"field": "Name label", "ok": bool(name_kw)},
                    {"field": "Grade(s) keyword", "ok": bool(grade_kw)},
                ]
        except Exception:
            doc_checks = []

    if not is_photo:
        if word_count < 10:
            penalize(0.25)
        elif word_count < 20:
            penalize(0.10)

    if is_photo:
        # For 2x2 photos we only need the file to be a valid image; OCR signals are irrelevant.
        verified = True
        verify_score = max(verify_score, 0.85)
    elif doc_type in ("form137", "sf10", "form157", "sf9", "report_card"):
        # Academic records should contain academic keywords; use them as soft requirements.
        academic_keywords = ["GRADE", "GRADES", "SCHOOL YEAR", "SY", "LEARNER", "LEARNER'S", "REPORT CARD", "FORM 137", "SF9", "SF10"]
        if not contains_any(norm_text, academic_keywords):
            issues.append("Academic keywords not detected (image may be incomplete or OCR missed headers).")
            penalize(0.25)

        # LRN: prefer header-box detection; fallback to text extraction.
        if not detected_lrn:
            issues.append("LRN not detected (OCR may have missed or misread it).")
            penalize(0.35)
        elif lrn_from_text and not lrn_from_boxes:
            # We found a 12-digit number in text but not in header region; treat as weaker evidence.
            issues.append("LRN detected, but not confidently located in the header region.")
            penalize(0.08)

        if word_count < 30:
            issues.append("Low text volume for an academic record.")
            penalize(0.25)
        verified = (verify_score >= 0.70) and (ocr_confidence >= 0.30) and (word_count >= 20)
    elif doc_type in ("birth_certificate", "birthcert"):
        birth_keywords = [
            "PHILIPPINE STATISTICS AUTHORITY",
            "PHILIPPINE STATISTICS",
            "PSA",
            "CERTIFICATE OF LIVE BIRTH",
            "LIVE BIRTH",
            "CERTIFICATION",
            "REPUBLIC OF THE PHILIPPINES",
        ]
        if not contains_any(norm_text, birth_keywords):
            issues.append("Birth certificate keywords not detected (PSA / Live Birth headers).")
            penalize(0.40)
        verified = (verify_score >= 0.70) and (ocr_confidence >= 0.30) and (word_count >= 12)
    elif doc_type in ("good_moral", "goodmoral"):
        goodmoral_keywords = ["GOOD MORAL", "GOOD MORAL CHARACTER", "MORAL CHARACTER", "CERTIFICATION"]
        if not contains_any(norm_text, goodmoral_keywords):
            issues.append("Good moral keywords not detected.")
            penalize(0.30)
        # Dates commonly appear on certificates; soft requirement (avoid strict date parsing).
        if not contains_any(norm_text, ["DATE", "ISSUED", "THIS", "DAY OF"]):
            issues.append("Date/issuance keywords not detected (check if document is cropped).")
            penalize(0.10)
        verified = (verify_score >= 0.70) and (ocr_confidence >= 0.30) and (word_count >= 12)
    else:
        verified = (verify_score >= 0.65) and (ocr_confidence >= 0.30) and (word_count >= 12)

    status = "verified" if verified else "failed"
    payload = {
        "status": status,
        "confidence": verify_score,
        "ocr_confidence": ocr_confidence,
        "detected_lrn": detected_lrn,
        "extracted_text": text[:2000],
        "word_count": word_count,
        "issues": issues,
    }

    # --- Cross-check: student-provided details vs OCR ---
    # This is best-effort and may be impacted by OCR quality or document layout.
    checks: list[dict] = []
    if expected and (not is_photo):
        try:
            import re

            def norm_simple(s: str) -> str:
                ss = normalize(s or "")
                ss = re.sub(r"[^A-Z0-9 ]+", " ", ss)
                ss = re.sub(r"\s+", " ", ss).strip()
                return ss

            # Line-by-line view of OCR text (helps avoid "anywhere in page" false positives).
            raw_lines = [x for x in (text or "").splitlines() if (x or "").strip()]
            norm_lines = [normalize(x) for x in raw_lines]
            simple_lines = [norm_simple(x) for x in raw_lines]

            _LOCATION_STOPWORDS = {
                "CITY", "PROVINCE", "MUNICIPALITY", "MUNICIPAL", "BARANGAY", "BRGY",
                "OF", "THE", "AND", "PHILIPPINES", "NCR", "METRO", "MANILA",
                "HOSPITAL", "COMMUNITY", "ST", "SAINT", "SAN", "SANTA", "SANTO",
            }

            def _distinct_location_tokens(place: str) -> list[str]:
                return [
                    t
                    for t in norm_simple(place).split(" ")
                    if len(t) >= 3 and t not in _LOCATION_STOPWORDS
                ]

            def _psa_child_section_lines(u_simple: list[str], u_norm: list[str]) -> list[str]:
                """Lines for the child block only — excludes father/mother/informant sections."""
                end_idx = len(u_simple)
                for i, nl in enumerate(u_norm):
                    if any(
                        k in nl
                        for k in (
                            "FATHER",
                            "MOTHER",
                            "NAME OF FATHER",
                            "NAME OF MOTHER",
                            "MAIDEN NAME OF MOTHER",
                            "INFORMANT",
                            "ATTENDANT",
                        )
                    ):
                        end_idx = i
                        break
                skip_headers = (
                    "REPUBLIC",
                    "PHILIPPINE",
                    "STATISTICS",
                    "CERTIFICATE",
                    "LIVE BIRTH",
                    "REGISTRY",
                    "FORM NO",
                    "PSA",
                )
                out: list[str] = []
                for sl, nl in zip(u_simple[:end_idx], u_norm[:end_idx]):
                    if any(h in nl for h in skip_headers):
                        continue
                    out.append(sl)
                return out

            def _psa_place_of_birth_lines(u_simple: list[str], u_norm: list[str]) -> list[str]:
                lines: list[str] = []
                for i, nl in enumerate(u_norm):
                    if "PLACE OF BIRTH" in nl or "PLACE OF BIRT" in nl:
                        lines.append(u_simple[i])
                        if i + 1 < len(u_simple):
                            lines.append(u_simple[i + 1])
                if lines:
                    return lines
                return _psa_child_section_lines(u_simple, u_norm)

            def name_match(expected_name: str, u_full: str, u_lines: list[str]) -> tuple[bool, float, list[str]]:
                exp = norm_simple(expected_name)
                if not exp:
                    return True, 1.0, []
                # Token-based containment (robust to middle name/initial differences)
                exp_tokens = [t for t in exp.split(" ") if len(t) >= 2]
                if not exp_tokens:
                    return True, 1.0, []
                # Prefer the best matching single line; fall back to whole-page text.
                best_hits: list[str] = []
                best_ratio = -1.0
                for ln in u_lines or []:
                    if not ln:
                        continue
                    hits = [t for t in exp_tokens if t in ln]
                    ratio = len(hits) / max(1, len(exp_tokens))
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best_hits = hits
                if best_ratio < 0:
                    best_hits = [t for t in exp_tokens if t in u_full]
                    best_ratio = len(best_hits) / max(1, len(exp_tokens))
                missing = [t for t in exp_tokens if t not in best_hits]
                ok = best_ratio >= 0.6
                return ok, float(best_ratio), missing[:6]

            def name_match_birth_certificate(
                expected_name: str,
                u_simple: list[str],
                u_norm: list[str],
            ) -> tuple[bool, float, list[str], str]:
                """
                PSA name check: compare only against the child's name block.
                Requires both first and last name tokens — avoids false matches from
                a parent's surname elsewhere on the certificate (e.g. Dela Cruz on father).
                """
                exp_tokens = [t for t in norm_simple(expected_name).split(" ") if len(t) >= 2]
                if not exp_tokens:
                    return True, 1.0, [], ""
                first_tok, last_tok = exp_tokens[0], exp_tokens[-1]
                child_lines = _psa_child_section_lines(u_simple, u_norm)

                best_hits: list[str] = []
                best_ratio = 0.0
                best_line = ""
                for ln in child_lines:
                    hits = [t for t in exp_tokens if t in ln]
                    ratio = len(hits) / max(1, len(exp_tokens))
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best_hits = hits
                        best_line = ln.strip()[:64]

                missing = [t for t in exp_tokens if t not in best_hits]
                first_ok = any(first_tok in ln for ln in child_lines)
                last_ok = any(last_tok in ln for ln in child_lines)
                # Child's first + last name must both appear in the child block.
                ok = first_ok and last_ok and best_ratio >= 0.67
                if not best_line and child_lines:
                    skip_kw = ("DATE", "BIRTH", "SEX", "PLACE", "NAME", "MALE", "FEMALE", "REGISTRY")
                    nameish = [
                        ln
                        for ln in child_lines
                        if len(ln.split()) >= 1
                        and not any(k in ln for k in skip_kw)
                        and re.search(r"[A-Z]{2,}", ln)
                    ]
                    if nameish:
                        best_line = " / ".join(nameish[:3])[:64]
                return ok, float(best_ratio), missing[:6], best_line

            def birth_place_match(
                expected_place: str,
                u_simple: list[str],
                u_norm: list[str],
            ) -> tuple[bool, float, list[str], str]:
                """
                PSA place-of-birth check: ignore generic words like CITY/PROVINCE and
                require every distinctive location token (e.g. MARIKINA, not CITY).
                """
                bp_tokens = _distinct_location_tokens(expected_place)
                if not bp_tokens:
                    bp_tokens = [t for t in norm_simple(expected_place).split(" ") if len(t) >= 4]
                if not bp_tokens:
                    return False, 0.0, [], ""

                pool = _psa_place_of_birth_lines(u_simple, u_norm)
                best_hits: list[str] = []
                best_ratio = 0.0
                best_line = ""
                for ln in pool:
                    hits = [t for t in bp_tokens if t in ln]
                    ratio = len(hits) / max(1, len(bp_tokens))
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best_hits = hits
                        best_line = ln.strip()[:72]

                # Every distinctive token must match (CITY alone must not pass).
                ok = len(best_hits) == len(bp_tokens)
                return ok, float(best_ratio), best_hits, best_line

            def _normalize_expected_sex(expected_sex: str) -> str | None:
                es = (expected_sex or "").strip().upper()
                if not es:
                    return None
                if es in {"M", "MALE", "MAN", "BOY"} or es.startswith("M"):
                    return "MALE"
                if es in {"F", "FEMALE", "WOMAN", "GIRL"} or es.startswith("F"):
                    return "FEMALE"
                return None

            # OCR commonly mangles the label (e.g. "GENDFR", "GENDR", "SEK").
            # Use a fuzzy pattern so we still find the row.
            _LABEL_RE = re.compile(r"\b(GE?N[DR][A-Z]*|SE[XK]|GENDER)\b")

            def _detect_sex_from_lines(raw_text: str) -> str | None:
                """
                Line-by-line extraction to avoid false positives.
                Many forms include both 'MALE' and 'FEMALE' as static template text.
                We only accept a value when it appears on the same line as the SEX/GENDER label.
                Falls back to "only one occurrence in the whole document" when label is missing.
                """
                try:
                    lines = [normalize(x) for x in (raw_text or "").splitlines() if (x or "").strip()]
                except Exception:
                    lines = []
                if not lines:
                    return None
                for i, ln in enumerate(lines):
                    if not _LABEL_RE.search(ln):
                        continue

                    # Case A: label + value on same line (common: "GENDER: FEMALE")
                    has_m = ("MALE" in ln) or bool(re.search(r"\bM\b", ln))
                    has_f = ("FEMALE" in ln) or bool(re.search(r"\bF\b", ln))
                    if has_m and not has_f:
                        return "MALE"
                    if has_f and not has_m:
                        return "FEMALE"

                    # Case B: OCR split label and value across consecutive lines.
                    # Example:
                    #   "GENDER:"
                    #   "FEMALE"
                    nxt = lines[i + 1] if i + 1 < len(lines) else ""
                    if nxt:
                        has_m2 = ("MALE" in nxt) or bool(re.search(r"\bM\b", nxt))
                        has_f2 = ("FEMALE" in nxt) or bool(re.search(r"\bF\b", nxt))
                        if has_m2 and not has_f2:
                            return "MALE"
                        if has_f2 and not has_m2:
                            return "FEMALE"

                    # If both are present on the same line, it's usually template text → ambiguous.
                    return None

                # Fallback: count distinct MALE/FEMALE occurrences in the whole document.
                # SF9 / many forms only print the value once. If exactly one is present we accept it.
                try:
                    full_upper = " ".join(lines)
                    n_female = len(re.findall(r"\bFEMALE\b", full_upper))
                    n_male_total = len(re.findall(r"\bMALE\b", full_upper))
                    # "MALE" is contained inside "FEMALE" — subtract that.
                    n_male = n_male_total - n_female
                    if n_female == 1 and n_male <= 0:
                        return "FEMALE"
                    if n_male == 1 and n_female == 0:
                        return "MALE"
                except Exception:
                    pass
                return None

            def _detect_sex_from_boxes(ocr_boxes: list[dict] | None) -> tuple[str | None, dict | None]:
                """
                Prefer OCR bounding boxes when available:
                find the 'SEX' label box and read the nearest value on the same row.
                """
                if not ocr_boxes:
                    return None, None
                try:
                    # Normalize box text; tolerate different box shapes.
                    normed = []
                    for b in ocr_boxes:
                        t = normalize(str(b.get("text") or ""))
                        if not t:
                            continue
                        # Common shapes: {text, x,y,w,h} or {text, bbox:[...]}.
                        x = float(b.get("x") or 0.0)
                        y = float(b.get("y") or 0.0)
                        w = float(b.get("w") or 0.0)
                        h = float(b.get("h") or 0.0)
                        if (w <= 0 or h <= 0) and isinstance(b.get("bbox"), (list, tuple)) and len(b.get("bbox")) >= 2:
                            # bbox can be [[x1,y1],[x2,y2],...]
                            pts = b.get("bbox")
                            xs = [float(p[0]) for p in pts if isinstance(p, (list, tuple)) and len(p) >= 2]
                            ys = [float(p[1]) for p in pts if isinstance(p, (list, tuple)) and len(p) >= 2]
                            if xs and ys:
                                x = min(xs)
                                y = min(ys)
                                w = max(xs) - x
                                h = max(ys) - y
                        normed.append({"t": t, "x": x, "y": y, "w": w, "h": h})

                    # Locate a SEX/GENDER label (fuzzy: GENDER/GENDFR/GENDR/SEX/SEK).
                    labels = [b for b in normed if _LABEL_RE.search(b["t"]) and b["w"] >= 0]
                    # PSA birth certs repeat sex labels for parents — prefer the child's row (upper page).
                    if doc_type in ("birth_certificate", "birthcert") and img_h and img_h > 0:
                        cutoff = float(img_h) * 0.42
                        upper = [b for b in labels if b["y"] <= cutoff]
                        if upper:
                            labels = upper
                    if not labels:
                        # Fallback: only one MALE/FEMALE value present anywhere → use that.
                        m_boxes = [b for b in normed if re.search(r"\bMALE\b", b["t"]) and not re.search(r"\bFEMALE\b", b["t"])]
                        f_boxes = [b for b in normed if re.search(r"\bFEMALE\b", b["t"])]
                        if len(f_boxes) == 1 and len(m_boxes) == 0:
                            b = f_boxes[0]
                            return "FEMALE", {"x": b["x"], "y": b["y"], "w": b["w"], "h": b["h"]}
                        if len(m_boxes) == 1 and len(f_boxes) == 0:
                            b = m_boxes[0]
                            return "MALE", {"x": b["x"], "y": b["y"], "w": b["w"], "h": b["h"]}
                        return None, None
                    # Use the first plausible label (top-most tends to be correct).
                    labels.sort(key=lambda b: (b["y"], b["x"]))
                    lb = labels[0]

                    # Sometimes OCR puts "GENDER: FEMALE" inside ONE box.
                    has_m0 = ("MALE" in lb["t"]) or bool(re.search(r"\bM\b", lb["t"]))
                    has_f0 = ("FEMALE" in lb["t"]) or bool(re.search(r"\bF\b", lb["t"]))
                    if has_m0 and not has_f0:
                        return "MALE", {"x": lb["x"], "y": lb["y"], "w": lb["w"], "h": lb["h"]}
                    if has_f0 and not has_m0:
                        return "FEMALE", {"x": lb["x"], "y": lb["y"], "w": lb["w"], "h": lb["h"]}

                    cy = lb["y"] + (lb["h"] * 0.5)
                    # Candidate values on same row band, to the right of label.
                    band = max(10.0, lb["h"] * 0.9)
                    candidates = [
                        b
                        for b in normed
                        if b is not lb
                        and abs((b["y"] + b["h"] * 0.5) - cy) <= band
                        and (b["x"] >= lb["x"] + max(5.0, lb["w"] * 0.6))
                    ]
                    if not candidates:
                        return None, None
                    candidates.sort(key=lambda b: b["x"])
                    # Look at the closest few boxes; OCR may split 'FEMALE' into 'FE' 'MALE', etc.
                    picked = candidates[:4]
                    joined = " ".join(b["t"] for b in picked)
                    has_m = ("MALE" in joined) or bool(re.search(r"\bM\b", joined))
                    has_f = ("FEMALE" in joined) or bool(re.search(r"\bF\b", joined))
                    if has_m and not has_f:
                        x1 = min(b["x"] for b in picked)
                        y1 = min(b["y"] for b in picked)
                        x2 = max(b["x"] + b["w"] for b in picked)
                        y2 = max(b["y"] + b["h"] for b in picked)
                        return "MALE", {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1}
                    if has_f and not has_m:
                        x1 = min(b["x"] for b in picked)
                        y1 = min(b["y"] for b in picked)
                        x2 = max(b["x"] + b["w"] for b in picked)
                        y2 = max(b["y"] + b["h"] for b in picked)
                        return "FEMALE", {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1}
                    return None, None
                except Exception:
                    return None, None

            def sex_match(
                expected_sex: str,
                raw_text: str,
                u_norm: str,
                ocr_boxes: list[dict] | None,
            ) -> tuple[bool | None, str, dict | None]:
                """
                Returns (ok|None, detected_value).
                None means we couldn't confidently read sex/gender from the document.
                """
                exp = _normalize_expected_sex(expected_sex)
                if not exp:
                    return None, "", None
                detected, bbox = _detect_sex_from_boxes(ocr_boxes)
                if not detected:
                    line_text = raw_text
                    if doc_type in ("birth_certificate", "birthcert"):
                        try:
                            lines = [ln for ln in (raw_text or "").splitlines() if (ln or "").strip()]
                            upper_n = max(10, int(len(lines) * 0.45))
                            line_text = "\n".join(lines[:upper_n])
                        except Exception:
                            line_text = raw_text
                    detected = _detect_sex_from_lines(line_text)
                if not detected:
                    return None, "", None
                return (detected == exp), detected, bbox

            def school_year_match(expected_sy: str, u: str) -> bool | None:
                sy = (expected_sy or "").strip()
                if not sy:
                    return None
                # Accept formats like 2023-2024, 2023/2024
                m = re.search(r"(\d{4})\s*[-/]\s*(\d{4})", sy)
                if not m:
                    return None
                a, b = m.group(1), m.group(2)
                return (a in u) and (b in u)

            def school_year_match_linewise(expected_sy: str, u_lines: list[str]) -> bool | None:
                """
                Prefer lines that contain the 'SCHOOL YEAR' / 'SY' label to avoid false matches
                from random years elsewhere on the page.
                """
                sy = (expected_sy or "").strip()
                if not sy:
                    return None
                m = re.search(r"(\d{4})\s*[-/]\s*(\d{4})", sy)
                if not m:
                    return None
                a, b = m.group(1), m.group(2)
                labeled = [ln for ln in u_lines if ("SCHOOL YEAR" in ln or re.search(r"\bSY\b", ln))]
                pool = labeled if labeled else u_lines
                for ln in pool:
                    if a in ln and b in ln:
                        return True
                return False

            exp_name = str(expected.get("name") or "").strip()
            exp_lrn = re.sub(r"\D+", "", str(expected.get("lrn") or ""))
            exp_sex = str(expected.get("sex") or "").strip()
            exp_sy = str(expected.get("school_year") or "").strip()
            exp_prev_school = str(expected.get("prev_school") or "").strip()
            exp_dob = str(expected.get("dob") or "").strip()
            exp_birth_place = str(expected.get("birth_place") or "").strip()
            exp_grade = str(expected.get("grade_level") or "").strip()
            exp_strand = str(expected.get("strand") or "").strip()

            # Cross-check only fields that belong on this document type.
            _academic_doc = doc_type in ("sf9", "report_card", "sf10", "form137", "form157")
            _birth_doc = doc_type in ("birth_certificate", "birthcert")
            _moral_doc = doc_type in ("good_moral", "goodmoral")
            run_lrn_check = _academic_doc
            run_name_check = _academic_doc or _birth_doc or _moral_doc
            run_sex_check = _academic_doc or _birth_doc
            run_school_year_check = _academic_doc or _moral_doc
            run_prev_school_check = _academic_doc or _moral_doc
            run_dob_check = _birth_doc
            run_birth_place_check = _birth_doc
            run_grade_check = _academic_doc
            run_strand_check = False

            # ---- Helpers to find a "value area" near a label so the UI can circle mismatches ----
            def _norm_boxes(ocr_boxes: list[dict] | None) -> list[dict]:
                out: list[dict] = []
                if not ocr_boxes:
                    return out
                for b in ocr_boxes:
                    try:
                        t = normalize(str(b.get("text") or ""))
                        if not t:
                            continue
                        x = float(b.get("x") or 0.0)
                        y = float(b.get("y") or 0.0)
                        w = float(b.get("w") or 0.0)
                        h = float(b.get("h") or 0.0)
                        if (w <= 0 or h <= 0) and isinstance(b.get("bbox"), (list, tuple)) and len(b.get("bbox")) >= 2:
                            pts = b.get("bbox")
                            xs = [float(p[0]) for p in pts if isinstance(p, (list, tuple)) and len(p) >= 2]
                            ys = [float(p[1]) for p in pts if isinstance(p, (list, tuple)) and len(p) >= 2]
                            if xs and ys:
                                x = min(xs)
                                y = min(ys)
                                w = max(xs) - x
                                h = max(ys) - y
                        out.append({"t": t, "x": x, "y": y, "w": w, "h": h})
                    except Exception:
                        continue
                return out

            def _union_bbox(items: list[dict]) -> dict | None:
                if not items:
                    return None
                x1 = min(it["x"] for it in items)
                y1 = min(it["y"] for it in items)
                x2 = max(it["x"] + it["w"] for it in items)
                y2 = max(it["y"] + it["h"] for it in items)
                return {"x": x1, "y": y1, "w": max(1.0, x2 - x1), "h": max(1.0, y2 - y1)}

            def _value_area_for_label(
                normed: list[dict],
                label_variants: list[str],
                *,
                max_neighbors: int = 4,
            ) -> dict | None:
                """Find the bounding area of the value(s) next to a label keyword."""
                labels = [b for b in normed if any(v in b["t"] for v in label_variants)]
                if not labels:
                    return None
                labels.sort(key=lambda b: (b["y"], b["x"]))
                lb = labels[0]
                cy = lb["y"] + lb["h"] / 2.0
                band = max(14.0, lb["h"] * 1.1)
                # Same-row neighbors to the right of the label.
                same_row = [
                    b
                    for b in normed
                    if b is not lb
                    and b["x"] > lb["x"] + max(4.0, lb["w"] * 0.4)
                    and abs((b["y"] + b["h"] / 2.0) - cy) <= band
                ]
                if same_row:
                    same_row.sort(key=lambda b: b["x"])
                    return _union_bbox(same_row[:max_neighbors])
                # Next-line fallback: line right below the label.
                below = [
                    b
                    for b in normed
                    if b is not lb
                    and b["y"] > lb["y"] + lb["h"] * 0.4
                    and b["y"] < lb["y"] + lb["h"] * 2.5
                ]
                if below:
                    below.sort(key=lambda b: (b["y"], b["x"]))
                    return _union_bbox(below[:max_neighbors])
                # Fallback: the label itself.
                return {"x": lb["x"], "y": lb["y"], "w": lb["w"], "h": lb["h"]}

            def _find_lrn_box(normed: list[dict]) -> dict | None:
                """Use the LRN label area; if missing, find any 12-digit token's box."""
                bb = _value_area_for_label(normed, ["LRN", "IRN", "URN"])
                if bb:
                    return bb
                for b in normed:
                    if re.search(r"\b[0-9]{12}\b", b["t"]):
                        return {"x": b["x"], "y": b["y"], "w": b["w"], "h": b["h"]}
                return None

            def _attach_bbox(row: dict, bb: dict | None) -> dict:
                if bb and all(k in bb for k in ("x", "y", "w", "h")):
                    row.update(
                        {
                            "x": float(bb["x"]),
                            "y": float(bb["y"]),
                            "w": float(bb["w"]),
                            "h": float(bb["h"]),
                        }
                    )
                return row

            normed_boxes = _norm_boxes(boxes)

            if run_lrn_check and exp_lrn:
                ok_lrn = bool(detected_lrn) and exp_lrn == str(detected_lrn)
                row = {"field": "LRN", "expected": exp_lrn, "detected": detected_lrn or "", "ok": ok_lrn}
                _attach_bbox(row, _find_lrn_box(normed_boxes))
                checks.append(row)
                if not ok_lrn:
                    issues.append("Mismatch: LRN in the document does not match the student's input.")
                    penalize(0.25)

            if run_name_check and exp_name:
                detected_name = ""
                if _birth_doc:
                    ok_name, ratio, missing, detected_name = name_match_birth_certificate(
                        exp_name, simple_lines, norm_lines
                    )
                else:
                    ok_name, ratio, missing = name_match(exp_name, norm_text, simple_lines)
                    if not ok_name:
                        exp_tokens = [t for t in norm_simple(exp_name).split(" ") if len(t) >= 2]
                        best_line_ratio = -1.0
                        for ln in simple_lines or []:
                            if not ln:
                                continue
                            hits = [t for t in exp_tokens if t in ln]
                            line_ratio = len(hits) / max(1, len(exp_tokens))
                            if line_ratio > best_line_ratio:
                                best_line_ratio = line_ratio
                                detected_name = ln.strip()[:64]
                    elif not detected_name:
                        exp_tokens = [t for t in norm_simple(exp_name).split(" ") if len(t) >= 2]
                        for ln in simple_lines or []:
                            if exp_tokens and all(t in ln for t in [exp_tokens[0], exp_tokens[-1]]):
                                detected_name = ln.strip()[:64]
                                break
                row = {
                    "field": "Name",
                    "expected": exp_name,
                    "detected": detected_name,
                    "ok": ok_name,
                    "match_ratio": round(float(ratio), 2),
                    "missing_tokens": missing,
                }
                # Circle the NAME value area regardless of doc layout (academic forms have "NAME:" labels).
                _attach_bbox(row, _value_area_for_label(normed_boxes, ["NAME"]))
                checks.append(row)
                if not ok_name:
                    issues.append("Mismatch: Student name not clearly found in the document text.")
                    penalize(0.18)

            if run_sex_check and exp_sex:
                sm, detected_sex, detected_sex_box = sex_match(exp_sex, text, norm_text, boxes)
                if sm is None:
                    # Make the check VISIBLE even when the AI cannot confidently read sex/gender
                    # from the document, so the registrar always sees the row instead of silence.
                    row = {
                        "field": "Sex",
                        "expected": exp_sex,
                        "detected": "",
                        "ok": False,
                        "note": "Could not read sex/gender from the document — please verify manually.",
                    }
                    checks.append(row)
                    issues.append("Sex/Gender could not be read from the document — manual check required.")
                    penalize(0.06)
                else:
                    row = {"field": "Sex", "expected": exp_sex, "detected": detected_sex, "ok": bool(sm)}
                    if detected_sex_box and all(k in detected_sex_box for k in ("x", "y", "w", "h")):
                        row.update(
                            {
                                "x": float(detected_sex_box["x"]),
                                "y": float(detected_sex_box["y"]),
                                "w": float(detected_sex_box["w"]),
                                "h": float(detected_sex_box["h"]),
                            }
                        )
                    checks.append(row)
                    if not bool(sm):
                        issues.append("Mismatch: Sex/Gender in the document does not match the student's input.")
                        penalize(0.12)

            sy_ok = school_year_match_linewise(exp_sy, norm_lines) if run_school_year_check else None
            if run_school_year_check and sy_ok is not None:
                row = {
                    "field": "School year",
                    "expected": exp_sy,
                    "detected": "",
                    "ok": bool(sy_ok),
                    "match_ratio": 1.0 if sy_ok else 0.0,
                }
                _attach_bbox(row, _value_area_for_label(normed_boxes, ["SCHOOL YEAR", "SY"]))
                checks.append(row)
                if not sy_ok:
                    issues.append("Mismatch: School year not found or does not match the student's input.")
                    penalize(0.12)

            if run_prev_school_check and exp_prev_school:
                # Soft check: look for at least one significant token from the school name.
                school_tokens = [t for t in norm_simple(exp_prev_school).split(" ") if len(t) >= 4]
                if school_tokens:
                    # Prefer best line hit so headers/footers don't cause accidental matches.
                    best_hits: list[str] = []
                    best_ratio = -1.0
                    for ln in simple_lines or []:
                        hits = [t for t in school_tokens if t in ln]
                        ratio = len(hits) / max(1, len(school_tokens))
                        if ratio > best_ratio:
                            best_ratio = ratio
                            best_hits = hits
                    if best_ratio < 0:
                        best_hits = [t for t in school_tokens if t in norm_text]
                        best_ratio = len(best_hits) / max(1, len(school_tokens))
                    ok = best_ratio >= 0.35
                    row = {
                        "field": "Previous school",
                        "expected": exp_prev_school,
                        "detected": "",
                        "ok": ok,
                        "match_ratio": round(float(best_ratio), 2),
                    }
                    _attach_bbox(row, _value_area_for_label(normed_boxes, ["SCHOOL"]))
                    checks.append(row)
                    if not ok and doc_type in ("sf9", "sf10", "form137", "form157", "report_card"):
                        issues.append("Mismatch: Previous school name not clearly found in the document.")
                        penalize(0.08)
                    elif not ok and _moral_doc:
                        issues.append("Mismatch: Previous school name not clearly found on the certificate.")
                        penalize(0.06)

            def grade_match_linewise(expected_grade: str, u_lines: list[str]) -> tuple[bool | None, str]:
                g = re.sub(r"\D", "", (expected_grade or "").strip())
                if not g:
                    return None, ""
                labeled = [ln for ln in u_lines if "GRADE" in ln or re.search(r"\bGR\.?\b", ln)]
                pool = labeled if labeled else u_lines
                patterns = [
                    rf"\bGRADE\s*0?{g}\b",
                    rf"\bGR\.?\s*0?{g}\b",
                    rf"\bG{g}\b",
                ]
                for ln in pool:
                    for pat in patterns:
                        m = re.search(pat, ln)
                        if m:
                            return True, m.group(0)
                for ln in pool:
                    if "GRADE" in ln and re.search(rf"\b0?{g}\b", ln):
                        return True, ln.strip()[:48]
                return False, ""

            if run_grade_check and exp_grade:
                grade_ok, grade_detected = grade_match_linewise(exp_grade, norm_lines)
                if grade_ok is not None:
                    row = {
                        "field": "Grade level",
                        "expected": exp_grade,
                        "detected": grade_detected,
                        "ok": bool(grade_ok),
                        "match_ratio": 1.0 if grade_ok else 0.0,
                    }
                    _attach_bbox(row, _value_area_for_label(normed_boxes, ["GRADE", "GR"]))
                    checks.append(row)
                    if not grade_ok:
                        issues.append("Mismatch: Grade level on the document does not match the student's enrollment.")
                        penalize(0.10)

            if run_strand_check and exp_strand:
                strand_tokens = [
                    t for t in re.split(r"[\s\-/]+", norm_simple(exp_strand))
                    if len(t) >= 3 and t not in {"TVL", "AND", "THE"}
                ]
                if strand_tokens:
                    best_hits: list[str] = []
                    best_ratio = -1.0
                    for ln in simple_lines or []:
                        hits = [t for t in strand_tokens if t in ln]
                        ratio = len(hits) / max(1, len(strand_tokens))
                        if ratio > best_ratio:
                            best_ratio = ratio
                            best_hits = hits
                    if best_ratio < 0:
                        best_hits = [t for t in strand_tokens if t in norm_text]
                        best_ratio = len(best_hits) / max(1, len(strand_tokens))
                    strand_ok = best_ratio >= 0.35
                    row = {
                        "field": "Strand / track",
                        "expected": exp_strand,
                        "detected": "",
                        "ok": strand_ok,
                        "match_ratio": round(float(best_ratio), 2),
                    }
                    _attach_bbox(row, _value_area_for_label(normed_boxes, ["STRAND", "TRACK", "HUMSS", "STEM", "ABM", "ICT"]))
                    checks.append(row)
                    if not strand_ok:
                        issues.append("Mismatch: Strand or track on the certificate does not match the student's enrollment.")
                        penalize(0.05)

            # -----------------------------------------------------------
            # Date of Birth and Place of Birth (mainly used for PSA, but
            # supported on any doc that has those labels).
            # -----------------------------------------------------------
            def _dob_parts(s: str) -> dict | None:
                """Accept YYYY-MM-DD or YYYY/MM/DD or 'Month D, YYYY'."""
                if not s:
                    return None
                s = s.strip()
                m = re.match(r"^\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s*$", s)
                if m:
                    y = int(m.group(1)); mo = int(m.group(2)); d = int(m.group(3))
                    if 1900 <= y <= 2100 and 1 <= mo <= 12 and 1 <= d <= 31:
                        return {"y": y, "m": mo, "d": d}
                months = {
                    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
                    "JUL": 7, "AUG": 8, "SEP": 9, "SEPT": 9, "OCT": 10, "NOV": 11, "DEC": 12,
                }
                m = re.match(r"^\s*([A-Z]{3,9})\s+(\d{1,2})\s*,?\s*(\d{4})\s*$", s.upper())
                if m and m.group(1)[:3] in months:
                    mo = months[m.group(1)[:3]]
                    return {"y": int(m.group(3)), "m": mo, "d": int(m.group(2))}
                return None

            def dob_match_linewise(expected_dob_str: str, u_lines: list[str]) -> tuple[bool | None, str]:
                """
                Look for a date that matches the student's DOB on lines that mention DATE/BIRTH.
                Returns (ok|None, the_extracted_value_str).
                """
                parts = _dob_parts(expected_dob_str)
                if not parts:
                    return None, ""
                month_names = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL",
                               "AUG", "SEP", "SEPT", "OCT", "NOV", "DEC"]
                month_word = month_names[parts["m"] - 1]
                month_full = (
                    "JANUARY FEBRUARY MARCH APRIL MAY JUNE JULY AUGUST SEPTEMBER OCTOBER NOVEMBER DECEMBER".split()[
                        parts["m"] - 1
                    ]
                )
                # Prefer lines labelled with date/birth keywords.
                preferred = [ln for ln in u_lines if any(k in ln for k in ("BIRTH", "DATE", "BORN"))]
                pool = preferred if preferred else u_lines
                # Numeric: 1990-07-15 / 1990/7/15 / 07-15-1990 / 15/07/1990 ...
                yyyy = str(parts["y"])
                mm = parts["m"]
                dd = parts["d"]
                num_patterns = [
                    rf"\b{yyyy}[\-/](0?{mm}|{mm:02d})[\-/](0?{dd}|{dd:02d})\b",
                    rf"\b(0?{mm}|{mm:02d})[\-/](0?{dd}|{dd:02d})[\-/]{yyyy}\b",
                    rf"\b(0?{dd}|{dd:02d})[\-/](0?{mm}|{mm:02d})[\-/]{yyyy}\b",
                ]
                for ln in pool:
                    for pat in num_patterns:
                        m = re.search(pat, ln)
                        if m:
                            return True, m.group(0)
                # Worded PSA formats: 'JULY 15 1990', 'JUL 15, 1990', '15 NOVEMBER 2004'
                month_alt = "(?:" + "|".join([month_word, month_word[:3], month_full]) + ")"
                for ln in pool:
                    m = re.search(rf"\b{month_alt}[A-Z]*\s+(0?{dd}|{dd:02d})\s*,?\s*{yyyy}\b", ln)
                    if m:
                        return True, m.group(0)
                    m = re.search(rf"\b(0?{dd}|{dd:02d})\s+{month_alt}[A-Z]*\s*,?\s*{yyyy}\b", ln)
                    if m:
                        return True, m.group(0)
                return False, ""

            if run_dob_check and exp_dob:
                dob_ok, dob_detected = dob_match_linewise(exp_dob, norm_lines)
                row = {
                    "field": "Date of birth",
                    "expected": exp_dob,
                    "detected": dob_detected,
                    "ok": bool(dob_ok) if dob_ok is not None else False,
                }
                if dob_ok is None:
                    row["note"] = "Could not parse expected date of birth for comparison."
                elif not dob_ok and not dob_detected:
                    row["note"] = "Could not read date of birth from the document — please verify manually."
                _attach_bbox(row, _value_area_for_label(normed_boxes, ["DATE OF BIRTH", "BIRTHDATE", "DATE OF BIRT", "BIRTH"]))
                checks.append(row)
                if dob_ok is False:
                    issues.append("Mismatch: Date of birth in the document does not match the student's input.")
                    penalize(0.15)
                elif dob_ok is None:
                    issues.append("Date of birth could not be compared automatically — manual check required.")
                    penalize(0.06)

            if run_birth_place_check and exp_birth_place:
                if _birth_doc:
                    bp_ok, best_ratio, best_hits, detected_place = birth_place_match(
                        exp_birth_place, simple_lines, norm_lines
                    )
                else:
                    bp_tokens = [t for t in norm_simple(exp_birth_place).split(" ") if len(t) >= 3]
                    if not bp_tokens:
                        bp_tokens = [t for t in norm_simple(exp_birth_place).split(" ") if len(t) >= 2]
                    best_hits = []
                    best_ratio = -1.0
                    detected_place = ""
                    if bp_tokens:
                        for ln in simple_lines or []:
                            hits = [t for t in bp_tokens if t in ln]
                            ratio = len(hits) / max(1, len(bp_tokens))
                            if ratio > best_ratio:
                                best_ratio = ratio
                                best_hits = hits
                                detected_place = ln.strip()[:72]
                        if best_ratio < 0:
                            best_hits = [t for t in bp_tokens if t in norm_text]
                            best_ratio = len(best_hits) / max(1, len(bp_tokens))
                    bp_ok = best_ratio >= 0.5 if bp_tokens else False
                row = {
                    "field": "Place of birth",
                    "expected": exp_birth_place,
                    "detected": detected_place or (" · ".join(best_hits) if best_hits else ""),
                    "ok": bp_ok,
                    "match_ratio": round(float(max(0.0, best_ratio)), 2),
                }
                if not _distinct_location_tokens(exp_birth_place) and _birth_doc:
                    row["note"] = "Place of birth on the form has no distinctive location token to compare."
                elif not bp_ok:
                    row["note"] = (
                        "Place of birth on the certificate does not match the enrollment form."
                        if _birth_doc
                        else "Place of birth tokens were not clearly found in the document text."
                    )
                _attach_bbox(row, _value_area_for_label(normed_boxes, ["PLACE OF BIRTH", "PLACE OF BIRT", "PLACE"]))
                checks.append(row)
                if not bp_ok:
                    issues.append("Mismatch: Place of birth in the document does not match the student's input.")
                    penalize(0.10)
        except Exception:
            pass

    if checks:
        payload["field_checks"] = checks

    if doc_checks:
        payload["doc_checks"] = doc_checks

    field_checks = payload.get("field_checks") or []
    verify_score = _composite_verify_score(
        is_photo=is_photo,
        ocr_confidence=ocr_confidence,
        word_count=word_count,
        doc_checks=doc_checks,
        field_checks=field_checks,
        detected_lrn=detected_lrn,
        doc_type=doc_type,
    )
    payload["confidence"] = verify_score

    min_words = 12
    if doc_type in ("form137", "sf10", "form157", "sf9", "report_card"):
        min_words = 20
    if is_photo:
        verified = True
    else:
        verified = verify_score >= 0.62 and ocr_confidence >= 0.25 and word_count >= min_words
    payload["status"] = "verified" if verified else "failed"
    payload["requested_doc_type"] = requested_doc_type
    payload["resolved_doc_type"] = doc_type
    payload["v"] = 9

    return payload


@app.route("/screen-quality", methods=["POST", "OPTIONS"])
def screen_quality():
    """Level 1 only — used when the student uploads a file (blur / quality gate)."""
    if request.method == "OPTIONS":
        return _corsify(make_response("", 204))

    if "image" not in request.files:
        return jsonify({"error": "No image"}), 400

    file = request.files["image"]
    doc_type = (request.form.get("doc_type") or "").strip().lower()
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    try:
        quality = _image_quality_check(filepath, doc_type)
        sec = {
            "levels": [
                _level_pack(
                    level=1,
                    title="Image quality",
                    passed=bool(quality.get("pass")),
                    score=int(quality.get("score") or 0),
                    summary=str(quality.get("message") or ""),
                    issues=list(quality.get("issues") or []),
                ),
            ],
            "overall_pass": bool(quality.get("pass")),
            "highest_level_passed": 1 if quality.get("pass") else 0,
        }
        return jsonify(
            {
                "pass": quality["pass"],
                "quality": quality,
                "security_levels": sec,
                "message": quality.get("message"),
            }
        )
    finally:
        try:
            os.remove(filepath)
        except OSError:
            pass


@app.route("/verify", methods=["POST"])
def verify_doc():
    if request.method == "OPTIONS":
        return _corsify(make_response("", 204))

    if _ocr_engine == "none":
        return (
            jsonify(
                {
                    "error": "No OCR engine available. Install PyTorch+EasyOCR, or install Tesseract OCR and: pip install pytesseract Pillow",
                }
            ),
            503,
        )

    if "image" not in request.files:
        return jsonify({"error": "No image"}), 400

    file = request.files["image"]
    doc_type = (request.form.get("doc_type") or "").strip().lower()

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)
    
    try:
        # Level 1 (blur / brightness) is enforced at student upload in PHP for JPG/PNG.
        # Do not re-run or penalize verification score for image quality here.
        quality = _upload_quality_stub()

        # Image dimensions (used by UI to scale tamper cell overlays)
        try:
            from PIL import Image

            im = Image.open(filepath)
            img_w, img_h = int(im.size[0]), int(im.size[1])
        except Exception:
            img_w, img_h = None, None

        if _ocr_engine == "easyocr":
            text, avg_conf, boxes = _ocr_easyocr(filepath)
        else:
            text, avg_conf, boxes = _ocr_tesseract(filepath)

        # Used by downstream checks (synthetic heuristics, UI hints)
        word_count = len((text or "").split())

        expected = {
            "name": (request.form.get("expected_name") or "").strip(),
            "lrn": (request.form.get("expected_lrn") or "").strip(),
            "sex": (request.form.get("expected_sex") or "").strip(),
            "school_year": (request.form.get("expected_school_year") or "").strip(),
            "prev_school": (request.form.get("expected_prev_school") or "").strip(),
            "dob": (request.form.get("expected_dob") or "").strip(),
            "birth_place": (request.form.get("expected_birth_place") or "").strip(),
            "grade_level": (request.form.get("expected_grade_level") or "").strip(),
            "strand": (request.form.get("expected_strand") or "").strip(),
        }
        if not any(v for v in expected.values()):
            expected = None

        payload = _evaluate(text, avg_conf, doc_type, boxes=boxes, img_h=img_h, expected=expected)
        effective_doc_type = str(payload.get("resolved_doc_type") or doc_type).strip().lower()
        if img_w and img_h:
            payload["image_width"] = img_w
            payload["image_height"] = img_h

        # Photo-only requirements (2x2, ID photo) do not need tamper analysis.
        if effective_doc_type in {"photo_2x2", "2x2", "id_photo", "photo"}:
            tamper_score, tamper_signals = 1.0, []
            payload["tamper_applicable"] = False
        else:
            tamper_score, tamper_signals = _tamper_check(filepath)
            payload["tamper_applicable"] = True
        payload["tamper_score"] = tamper_score
        payload["tamper_signals"] = tamper_signals

        # Synthetic / AI-generated suspicion signals (heuristics; NOT definitive).
        if effective_doc_type in {"photo_2x2", "2x2", "id_photo", "photo"}:
            payload["synthetic_applicable"] = False
            payload["synthetic_score"] = 1.0
            payload["synthetic_signals"] = []
        else:
            syn_score, syn_signals = _synthetic_check(filepath, ocr_confidence=avg_conf, word_count=word_count)
            payload["synthetic_applicable"] = True
            payload["synthetic_score"] = syn_score
            payload["synthetic_signals"] = syn_signals

            # If the document looks digitally generated (straight lines, ultra-clean edges, etc.),
            # reduce the headline integrity score so UI doesn't show "Integrity 100%" alongside
            # strong synthetic/digital-layout indicators.
            try:
                ss = float(syn_score)
            except Exception:
                ss = 1.0
            if ss < 0.92:
                # Cap integrity by synthetic score (soft cap).
                # ss=0.82 → cap≈0.92 (so integrity moves, but not as harsh as tamper hotspots).
                cap = _clamp01(0.55 + 0.45 * ss)
                if cap < tamper_score:
                    tamper_score = cap
                    payload["tamper_score"] = tamper_score
                    payload["tamper_signals"] = (payload.get("tamper_signals") or []) + [
                        f"Integrity capped by synthetic check: {int(round(cap * 100))}%"
                    ]

        # SF9/report card: add cell-level tamper hints (JPEG ELA + numeric boxes).
        if effective_doc_type in ("sf9", "report_card"):
            diff_arr, _ = _compute_ela_diff(filepath)
            if diff_arr is None:
                diff_arr = _compute_noise_residual(filepath)
            cells = _sf9_cell_tamper(diff_arr, boxes)
            payload["tamper_cells"] = cells
            fields = _sf9_field_tamper(diff_arr, boxes, img_w, img_h)
            payload["tamper_fields"] = fields
            if cells:
                # summarize into signals/issues
                payload["tamper_signals"] = (payload.get("tamper_signals") or []) + [
                    f"SF9: {len(cells)} suspicious grade cell(s) detected"
                ]
                payload["issues"] = (payload.get("issues") or []) + [
                    "SF9: possible grade-area tampering signals detected (review highlighted cells)"
                ]
            if fields:
                payload["tamper_signals"] = (payload.get("tamper_signals") or []) + [
                    f"SF9: {len(fields)} suspicious header field(s) detected"
                ]
                payload["issues"] = (payload.get("issues") or []) + [
                    "SF9: possible header-field tampering signals detected (review highlighted fields)"
                ]

        # Other doc types: field-only tamper hints (names, IDs, etc.)
        if effective_doc_type in ("sf10", "form137", "form157"):
            diff_arr, _ = _compute_ela_diff(filepath)
            if diff_arr is None:
                diff_arr = _compute_noise_residual(filepath)
            fm = {
                "LRN": ["LRN", "IRN", "URN"],
                "NAME": ["NAME"],
                "SCHOOL": ["SCHOOL"],
                "GRADE": ["GRADE"],
                "SY": ["SY", "SCHOOL YEAR", "SCHOOLYEAR"],
            }
            fields = _keyword_field_tamper(diff_arr, boxes, img_w, img_h, fm, search_y_max_ratio=0.8)
            if fields:
                payload["tamper_fields"] = (payload.get("tamper_fields") or []) + fields
                payload["tamper_signals"] = (payload.get("tamper_signals") or []) + [
                    f"SF10/Form137: {len(fields)} suspicious field(s) detected"
                ]
                payload["issues"] = (payload.get("issues") or []) + [
                    "SF10/Form137: possible field tampering signals detected (review highlighted fields)"
                ]

        if effective_doc_type in ("birth_certificate", "birthcert"):
            diff_arr, _ = _compute_ela_diff(filepath)
            if diff_arr is None:
                diff_arr = _compute_noise_residual(filepath)
            fm = {
                "NAME": ["NAME"],
                "DATE OF BIRTH": ["DATE OF BIRTH", "BIRTH", "BIRTHDATE"],
                "PLACE OF BIRTH": ["PLACE OF BIRTH", "PLACE"],
                "SEX": ["SEX"],
                "REGISTRY NO": ["REGISTRY", "REGISTRY NO", "REGISTRY NO."],
                "PSA": ["PSA", "PHILIPPINE STATISTICS", "PHILIPPINE"],
            }
            fields = _keyword_field_tamper(diff_arr, boxes, img_w, img_h, fm, search_y_max_ratio=0.95)
            if fields:
                payload["tamper_fields"] = (payload.get("tamper_fields") or []) + fields
                payload["tamper_signals"] = (payload.get("tamper_signals") or []) + [
                    f"Birth cert: {len(fields)} suspicious field(s) detected"
                ]
                payload["issues"] = (payload.get("issues") or []) + [
                    "Birth cert: possible field tampering signals detected (review highlighted fields)"
                ]

        if effective_doc_type in ("good_moral", "goodmoral") and img_w and img_h:
            _append_good_moral_signature_field_check(payload, filepath, boxes, img_w, img_h)

        if effective_doc_type in ("good_moral", "goodmoral"):
            diff_arr, _ = _compute_ela_diff(filepath)
            if diff_arr is None:
                diff_arr = _compute_noise_residual(filepath)
            fm = {
                "NAME": ["NAME"],
                "SCHOOL": ["SCHOOL"],
                "DATE": ["DATE"],
                "GOOD MORAL": ["GOOD", "MORAL", "GOOD MORAL"],
            }
            fields = _keyword_field_tamper(diff_arr, boxes, img_w, img_h, fm, search_y_max_ratio=0.95)
            if fields:
                payload["tamper_fields"] = (payload.get("tamper_fields") or []) + fields
                payload["tamper_signals"] = (payload.get("tamper_signals") or []) + [
                    f"Good moral: {len(fields)} suspicious field(s) detected"
                ]
                payload["issues"] = (payload.get("issues") or []) + [
                    "Good moral: possible field tampering signals detected (review highlighted fields)"
                ]

        # OCR-INDEPENDENT whole-image hotspot scan (catches edits even when OCR misses the labels).
        # Runs for every non-photo document so PSA / good-moral / etc. are no longer skipped.
        if effective_doc_type not in {"photo_2x2", "2x2", "id_photo", "photo"}:
            try:
                tmap = _compute_tamper_map(filepath)
                region_hits = _grid_hotspot_tamper(tmap, img_w, img_h)
                if region_hits:
                    payload["tamper_fields"] = (payload.get("tamper_fields") or []) + region_hits
                    n_high = sum(1 for r in region_hits if str(r.get("risk")) == "high")
                    payload["tamper_signals"] = (payload.get("tamper_signals") or []) + [
                        f"Region scan: {len(region_hits)} area(s) with inconsistent compression/noise"
                        + (f" ({n_high} high-risk)" if n_high else "")
                    ]
                    payload["issues"] = (payload.get("issues") or []) + [
                        "Possible edited region(s) detected by whole-image scan (review highlighted areas)"
                    ]
            except Exception:
                pass

        # Merge localized tamper hotspots into headline tamper_score (global-only check often stayed at 100%).
        cells_all = list(payload.get("tamper_cells") or [])
        fields_all = list(payload.get("tamper_fields") or [])
        merged_score, merge_signals = _merge_localized_tamper_score(tamper_score, cells_all, fields_all)
        tamper_score = merged_score
        payload["tamper_score"] = tamper_score
        if merge_signals:
            payload["tamper_signals"] = (payload.get("tamper_signals") or []) + merge_signals

        # When OCR is weak and most structural labels are missing, cap "perfect" integrity (heuristic).
        doc_checks = payload.get("doc_checks") or []
        if isinstance(doc_checks, list) and len(doc_checks) >= 5:
            missing = sum(1 for c in doc_checks if c.get("ok") is False)
            try:
                oc = float(avg_conf)
            except Exception:
                oc = 1.0
            if missing >= 4 and oc < 0.48:
                tamper_score = _clamp01(tamper_score - 0.14)
                payload["tamper_score"] = tamper_score

        # Integrity (Level 2/3) is separate from document-match confidence.
        # confidence / ai_score / weighted overall all use the document-match score only.
        payload["match_score"] = float(payload.get("confidence", 0.0))

        if tamper_score < 0.35:
            # High risk: force failure and add a visible issue.
            payload["status"] = "failed"
            payload["issues"] = (payload.get("issues") or []) + ["High tamper risk: possible image manipulation"]

        payload["quality"] = quality
        payload["security_levels"] = _build_security_levels(
            quality=quality,
            doc_type=effective_doc_type,
            payload=payload,
            tamper_score=tamper_score,
            tamper_cells=cells_all,
            tamper_fields=fields_all,
            quality_enforced_at_upload=True,
        )
        if not payload["security_levels"]["overall_pass"]:
            payload["status"] = "failed"

        return jsonify(payload)
    except Exception as e:
        err_name = type(e).__name__
        if err_name == "TesseractNotFoundError" or "tesseract" in str(e).lower():
            return (
                jsonify(
                    {
                        "error": (
                            "Tesseract OCR is not installed or not found. "
                            "Install the Windows installer (e.g. UB Mannheim Tesseract), "
                            "or set environment variable TESSERACT_CMD to the full path of tesseract.exe, then restart python app.py."
                        )
                    }
                ),
                503,
            )
        # Never return HTML error pages to the PHP proxy.
        return (
            jsonify(
                {
                    "error": "Unexpected error running AI verification",
                    "type": err_name,
                    "detail": (str(e) or "")[:800],
                }
            ),
            500,
        )
    finally:
        try:
            os.remove(filepath)
        except OSError:
            pass


if __name__ == "__main__":
    # Hosts like Railway / Render inject the port via $PORT; fall back to 5000 locally.
    _port = int(os.environ.get("PORT", "5000"))
    _debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=_port, debug=_debug)
