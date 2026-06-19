from flask import Flask, request, jsonify, make_response
import os
import re
import shutil
import sys
import tempfile
import uuid
from werkzeug.utils import secure_filename

app = Flask(__name__)
APP_DIR = os.path.dirname(os.path.abspath(__file__))
app.config['UPLOAD_FOLDER'] = os.path.join(APP_DIR, 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


def _staging_upload_path(file) -> str:
    """Randomized temp path — never use client filenames on disk."""
    raw = secure_filename(file.filename or "upload") or "upload"
    _, ext = os.path.splitext(raw)
    if not ext or len(ext) > 8:
        ext = ".jpg"
    return os.path.join(app.config["UPLOAD_FOLDER"], f"{uuid.uuid4().hex}{ext.lower()}")


# OCR backends: Tesseract (fast) and EasyOCR (heavier). Multi-level fallback tries alternate
# engines / preprocessing when the first pass reads poorly.
_easyocr_reader = None
_ocr_engine = "none"  # primary engine label for /health (legacy)
_ocr_primary = "none"
_tesseract_available = False
_easyocr_available = False
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
    """Initialize OCR backends. Primary is used first; secondary is tried on weak reads."""
    global _easyocr_reader, _ocr_engine, _ocr_primary, _tesseract_exe
    global _tesseract_available, _easyocr_available

    pref = (os.environ.get("AI_OCR_ENGINE") or "auto").strip().lower()
    disable_easyocr = _env_flag("DISABLE_EASYOCR")
    py313_plus = sys.version_info >= (3, 13)
    preload_easyocr = pref == "easyocr" or _env_flag("AI_OCR_PRELOAD_EASYOCR")

    def _init_tesseract() -> bool:
        global _tesseract_exe, _tesseract_available
        try:
            import pytesseract  # noqa: F401
            from PIL import Image  # noqa: F401

            exe = _resolve_tesseract_exe()
            if not exe:
                return False
            import pytesseract as pt

            pt.pytesseract.tesseract_cmd = exe
            _tesseract_exe = exe
            _tesseract_available = True
            print(f"[IntelliDocs AI] Tesseract ready ({exe})", flush=True)
            return True
        except Exception as exc:
            print(f"[IntelliDocs AI] Tesseract unavailable: {exc}", flush=True)
            return False

    def _init_easyocr() -> bool:
        global _easyocr_reader, _easyocr_available
        if disable_easyocr:
            return False
        if py313_plus and pref != "easyocr":
            return False
        try:
            import easyocr

            print("[IntelliDocs AI] Loading EasyOCR (PyTorch); first start may take 1–2 minutes…", flush=True)
            _easyocr_reader = easyocr.Reader(["en"])
            _easyocr_available = True
            print("[IntelliDocs AI] EasyOCR ready", flush=True)
            return True
        except Exception as exc:
            print(f"[IntelliDocs AI] EasyOCR unavailable: {exc}", flush=True)
            _easyocr_reader = None
            return False

    _init_tesseract()
    if preload_easyocr:
        _init_easyocr()

    if pref == "easyocr" and _easyocr_available:
        _ocr_primary = "easyocr"
    elif _tesseract_available:
        _ocr_primary = "tesseract"
    elif _easyocr_available:
        _ocr_primary = "easyocr"
    else:
        _ocr_primary = "none"

    _ocr_engine = _ocr_primary
    if _ocr_primary == "none":
        print(
            "[IntelliDocs AI] No OCR engine available. Install Tesseract OCR or use Python 3.11–3.12 with EasyOCR.",
            flush=True,
        )
    else:
        fallback_note = "multi-level fallback on" if not _env_flag("DISABLE_OCR_FALLBACK") else "fallback off"
        engines = []
        if _tesseract_available:
            engines.append("tesseract")
        if _easyocr_available:
            engines.append("easyocr")
        elif not disable_easyocr and not py313_plus:
            engines.append("easyocr(lazy)")
        print(
            f"[IntelliDocs AI] OCR primary: {_ocr_primary}; available: {', '.join(engines)}; {fallback_note}",
            flush=True,
        )


def _ensure_easyocr_loaded() -> bool:
    """Lazy-load EasyOCR for level-3 fallback (avoids RAM cost until needed)."""
    global _easyocr_reader, _easyocr_available
    if _easyocr_available and _easyocr_reader is not None:
        return True
    if _env_flag("DISABLE_EASYOCR"):
        return False
    pref = (os.environ.get("AI_OCR_ENGINE") or "auto").strip().lower()
    if sys.version_info >= (3, 13) and pref != "easyocr":
        return False
    try:
        import easyocr

        print("[IntelliDocs AI] Loading EasyOCR for OCR fallback…", flush=True)
        _easyocr_reader = easyocr.Reader(["en"])
        _easyocr_available = True
        return True
    except Exception as exc:
        print(f"[IntelliDocs AI] EasyOCR fallback unavailable: {exc}", flush=True)
        _easyocr_reader = None
        return False


def _ocr_any_available() -> bool:
    return _tesseract_available or _easyocr_available or (
        not _env_flag("DISABLE_EASYOCR") and sys.version_info < (3, 13)
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
# Enrollment-critical forms: always run enhanced Tesseract (PSM 6/11/4), not only on weak reads.
OCR_PRIORITY_DOC_TYPES = frozenset({"birth_certificate", "sf9", "form137", "good_moral"})


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


def _normalize_doc_type_key(doc_type: str) -> str:
    t = (doc_type or "").strip().lower()
    if t in ("birthcert",):
        return "birth_certificate"
    if t in ("sf10", "form137", "form157"):
        return "form137"
    if t in ("report_card",):
        return "sf9"
    if t in ("goodmoral",):
        return "good_moral"
    return t or "other"


def _ocr_priority_doc(doc_type: str) -> bool:
    """PSA, SF9, SF10/137, good moral — always use enhanced multi-pass Tesseract."""
    return _normalize_doc_type_key(doc_type) in OCR_PRIORITY_DOC_TYPES


def _doc_type_display_label(doc_type: str) -> str:
    key = _normalize_doc_type_key(doc_type)
    labels = {
        "birth_certificate": "PSA birth certificate",
        "form137": "SF10 / Form 137",
        "sf9": "SF9 / Report card",
        "good_moral": "Good moral certificate",
        "photo_2x2": "2×2 ID photo",
    }
    return labels.get(key, (doc_type or "document").replace("_", " ").strip() or "document")


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


def _normalize_upload_ocr_text(text: str) -> str:
    import re

    s = (text or "").upper().replace("\u00ad", "")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _upload_doc_type_keywords(doc_type: str) -> list[str]:
    dt = _normalize_doc_type_key(doc_type)
    if dt in ("birth_certificate", "birthcert"):
        return ["BIRTH", "NAME", "CERTIF", "REGIST", "LIVE", "SEX", "DATE"]
    if dt in ("sf9", "report_card"):
        return ["GRADE", "SCHOOL", "NAME", "LEARNER", "LRN", "REPORT"]
    if dt in ("form137", "sf10", "form157"):
        return ["SCHOOL", "NAME", "GRADE", "FORM", "LRN", "SF10"]
    if dt in ("good_moral", "goodmoral"):
        return ["MORAL", "CERTIF", "SCHOOL", "NAME", "CHARACTER"]
    return ["NAME", "SCHOOL", "CERTIF", "GRADE"]


def _quick_ocr_for_upload_screen(filepath: str, doc_type: str) -> tuple[str, float]:
    """Fast OCR for student upload gate — one or two passes, not full verification."""
    text, conf, _ = _ocr_tesseract(filepath)
    dt = _normalize_doc_type_key(doc_type)
    if dt in ("birth_certificate", "birthcert"):
        extra = _ocr_birth_cert_header_text(filepath)
        if extra:
            text = f"{text}\n{extra}".strip()
    if _ocr_priority_doc(doc_type) or _ocr_needs_fallback(text, conf, doc_type):
        try:
            from PIL import Image

            t2, c2, _ = _ocr_tesseract_image(Image.open(filepath), psm=6, enhanced=True)
            if _ocr_candidate_score(t2, c2, doc_type) > _ocr_candidate_score(text, conf, doc_type):
                text, conf = t2, c2
            if dt in ("birth_certificate", "birthcert"):
                extra = _ocr_birth_cert_header_text(filepath)
                if extra and extra not in text:
                    text = f"{text}\n{extra}".strip()
        except Exception:
            pass
    return text, conf


def _upload_document_readability_check(filepath: str, doc_type: str) -> dict:
    """
    Level 1b — ensure enrollment documents contain enough readable text before accept.
    ID photos skip text checks.
    """
    dt = _normalize_doc_type_key(doc_type)
    if dt in PHOTO_DOC_TYPES:
        return {
            "pass": True,
            "message": "Photo upload accepted.",
            "issues": [],
            "word_count": 0,
            "ocr_confidence": None,
        }

    if not _ocr_any_available():
        return {
            "pass": False,
            "message": "Document verification is temporarily unavailable. Please try again in a few minutes.",
            "issues": ["OCR engine unavailable"],
            "word_count": 0,
            "ocr_confidence": 0.0,
        }

    try:
        text, avg_conf = _quick_ocr_for_upload_screen(filepath, doc_type)
    except Exception as exc:
        print(f"[upload screen] readability error: {type(exc).__name__}: {exc}", flush=True)
        return {
            "pass": False,
            "message": "We could not read this document. Retake the photo in good lighting with the full page visible.",
            "issues": ["Document could not be processed"],
            "word_count": 0,
            "ocr_confidence": 0.0,
        }

    norm = _normalize_upload_ocr_text(text)
    word_count = len((text or "").split())
    min_words = _ocr_fallback_min_words(doc_type)
    issues: list[str] = []

    if word_count < min_words:
        issues.append(
            f"Not enough readable text was detected ({word_count} words). "
            "Retake with the full document in frame, steady hands, and good lighting."
        )

    keywords = _upload_doc_type_keywords(doc_type)
    hits = sum(1 for k in keywords if k in norm)
    min_hits = 2
    if hits < min_hits:
        issues.append(
            "This file does not look like a readable copy of the required document. "
            "Check that you selected the correct requirement and that all text is sharp and legible."
        )

    try:
        conf_val = float(avg_conf)
    except (TypeError, ValueError):
        conf_val = 0.0
    if conf_val < 0.22 and word_count < min_words + 4:
        issues.append("Text is too faint or blurry to read. Avoid shadows, glare, and camera shake.")

    passed = len(issues) == 0
    return {
        "pass": passed,
        "message": "Document text is readable." if passed else issues[0],
        "issues": issues,
        "word_count": word_count,
        "ocr_confidence": round(conf_val, 3),
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


_SEAL_ASSETS_DIR = os.path.join(APP_DIR, "assets", "seals")
_seal_templates_bootstrapped = False


def _bootstrap_seal_templates() -> None:
    """Create reference seal crops from bundled admission samples when assets are missing."""
    global _seal_templates_bootstrapped
    if _seal_templates_bootstrapped:
        return
    _seal_templates_bootstrapped = True
    try:
        import cv2
    except ImportError:
        return

    os.makedirs(_SEAL_ASSETS_DIR, exist_ok=True)
    needed = ("psa_logo.png", "deped_logo.png", "deped_ncr_logo.png")
    if all(os.path.isfile(os.path.join(_SEAL_ASSETS_DIR, name)) for name in needed):
        return

    samples = os.path.join(APP_DIR, "..", "frontend", "public", "admission-samples")
    psa_src = os.path.join(samples, "psa-birth-certificate.jpg")
    gm_src = os.path.join(samples, "good-moral-certificate.jpg")
    if not os.path.isfile(psa_src) or not os.path.isfile(gm_src):
        return

    psa = cv2.imread(psa_src)
    gm = cv2.imread(gm_src)
    if psa is None or gm is None:
        return

    ph, pw = psa.shape[:2]
    cv2.imwrite(
        os.path.join(_SEAL_ASSETS_DIR, "psa_logo.png"),
        psa[int(ph * 0.01) : int(ph * 0.13), int(pw * 0.01) : int(pw * 0.16)],
    )
    gh, gw = gm.shape[:2]
    cv2.imwrite(
        os.path.join(_SEAL_ASSETS_DIR, "deped_logo.png"),
        gm[int(gh * 0.02) : int(gh * 0.17), int(gw * 0.02) : int(gw * 0.18)],
    )
    cv2.imwrite(
        os.path.join(_SEAL_ASSETS_DIR, "deped_ncr_logo.png"),
        gm[int(gh * 0.02) : int(gh * 0.17), int(gw * 0.78) : int(gw * 0.98)],
    )


def _load_seal_template(name: str):
    _bootstrap_seal_templates()
    path = os.path.join(_SEAL_ASSETS_DIR, name)
    if not os.path.isfile(path):
        return None
    try:
        import cv2

        tpl = cv2.imread(path)
        if tpl is None:
            return None
        return cv2.cvtColor(tpl, cv2.COLOR_BGR2GRAY)
    except Exception:
        return None


def _blue_pixel_ratio(roi_bgr) -> float:
    try:
        import cv2
        import numpy as np

        hsv = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, np.array([90, 40, 40]), np.array([140, 255, 255]))
        return float(np.mean(mask > 0))
    except Exception:
        return 0.0


def _norm_ocr_text(u: str) -> str:
    import re

    s = (u or "").upper().replace("\u00ad", "")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[^A-Z0-9:/# \-]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _ocr_text_from_header_boxes(boxes: list[dict] | None, img_h: int | None, *, ratio: float = 0.30) -> str:
    """Concatenate OCR box text from the top header band."""
    if not boxes or not img_h:
        return ""
    try:
        top_y = int(float(img_h) * ratio)
    except (TypeError, ValueError):
        return ""
    parts: list[str] = []
    for b in boxes:
        try:
            y = int(b.get("y", 999999))
        except (TypeError, ValueError):
            continue
        if y > top_y:
            continue
        t = str(b.get("text", "") or "").strip()
        if t:
            parts.append(t)
    parts.sort(key=lambda t: t)
    return " ".join(parts)


def _psa_has_republic_header(text: str) -> bool:
    """Fuzzy Republic-of-the-Philippines header (OCR often garbles decorative title text)."""
    import re

    s = _norm_ocr_text(text)
    if not s:
        return False
    if "REPUBLIC OF THE PHILIPPINES" in s:
        return True
    if "PHILIPPIN" not in s:
        return False
    rep_markers = ("REPUBLIC", "REPUBL", "REPUTILC", "REPUBLC", "REPUBL1C", "REPUB")
    if any(m in s for m in rep_markers):
        return True
    return bool(re.search(r"REP[UOTI]{2,8}L[CI1].*PHILIPPIN", s))


def _psa_has_authority_header(text: str) -> bool:
    """PSA / Philippine Statistics / Civil Registrar header text."""
    s = _norm_ocr_text(text)
    if not s:
        return False
    if any(
        n in s
        for n in (
            "PHILIPPINE STATISTICS AUTHORITY",
            "PHILIPPINE STATISTICS",
            "PSA",
            "CIVIL REGISTRAR GENERAL",
            "OFFICE OF THE CIVIL REGISTRAR",
            "OFFICE OF CIVIL",
        )
    ):
        return True
    if "PHILIPPIN" in s and "STATISTIC" in s:
        return True
    if "CIVIL" in s and "REGISTRAR" in s:
        return True
    return False


def _ocr_birth_cert_header_text(filepath: str) -> str:
    """Extra OCR pass on the top header band where PSA title text is often missed."""
    if not _tesseract_available:
        return ""
    try:
        from PIL import Image
    except ImportError:
        return ""
    try:
        im = Image.open(filepath)
        w, h = im.size
        crop = im.crop((0, 0, w, max(1, int(h * 0.26))))
        chunks: list[str] = []
        for psm in (6, 11):
            t, _, _ = _ocr_tesseract_image(crop, psm=psm, enhanced=True)
            if (t or "").strip():
                chunks.append(t.strip())
        return "\n".join(chunks)
    except Exception:
        return ""


def _is_lrn_label_text(text: str) -> bool:
    """True when an OCR box looks like the LRN field label on DepEd school forms."""
    import re

    s = _norm_ocr_text(text)
    if not s:
        return False
    if re.search(r"\b[LIU]RN\b", s):
        return True
    if "(LRN)" in s.replace(" ", ""):
        return True
    if "LEARNER" in s and "REFERENCE" in s:
        return True
    return False


_LRN_ROW_STOP_TOKENS = ("BIRTHDATE", "BIRTH DATE", "SEX", "DATE OF BIRTH")


def _extract_lrn_digits_from_text(text: str) -> str | None:
    """Return a 12-digit LRN string from OCR text, or None."""
    import re

    s = _norm_ocr_text(text or "")
    if not s:
        return None
    patterns = (
        r"(?:LEARNER(?:S)?\s+(?:REFERENCE|REF)\s+(?:NO|NUMBER)|\b[LIU]RN|\([LIU]RN\)|\{URN\})\s*[\):#]?\s*([0-9][0-9 \-]{8,22}[0-9])",
        r"\bWITH LRN\s*([0-9]{12})\b",
        r"\bLRN\s*([0-9]{12})\b",
        r"\b([0-9]{12})\b",
        r"([0-9]{4}\s+[0-9]{4}\s+[0-9]{4})",
    )
    for pat in patterns:
        m = re.search(pat, s)
        if not m:
            continue
        digits = re.sub(r"\D+", "", m.group(1))
        if len(digits) == 12:
            return digits
    return None


    return False


_ACADEMIC_NAME_LABEL_WORDS = frozenset(
    {
        "REFERENCE",
        "NUMBER",
        "LEARNER",
        "LEAMER",
        "LRN",
        "IRN",
        "URN",
        "BIRTHDATE",
        "BIRTH",
        "EXTN",
        "SCHOOL",
        "ELIGIBILITY",
        "SCHOLASTIC",
        "CERTIFICATION",
        "PERMANENT",
        "RECORD",
        "DEPARTMENT",
        "EDUCATION",
        "REPUBLIC",
        "PHILIPPINES",
        "FORM",
        "NAME",
        "FIRST",
        "MIDDLE",
        "LAST",
        "SEX",
        "MALE",
        "FEMALE",
    }
)


def _academic_name_part_plausible(part: str) -> bool:
    import re

    p = re.sub(r"\s+", " ", (part or "").strip().upper())
    if not p or len(p) < 2 or len(p) > 32:
        return False
    if any(w in _ACADEMIC_NAME_LABEL_WORDS for w in p.split()):
        return False
    if any(k in p for k in ("REFERENCE", "LEARNER", "LEAMER", "BIRTHDATE", "SCHOOL YEAR")):
        return False
    if re.search(r"\d", p):
        return False
    return len(p.split()) <= 3


def _extract_lrn_loose_from_text(text: str) -> str | None:
    """10–12 digit LRN candidate beside the label when strict 12-digit parse fails."""
    import re

    s = _norm_ocr_text(text or "")
    if not s:
        return None
    patterns = (
        r"(?:LEARNER|LEAMER|REFERENCE|\b[LIU]RN|\(LRN\)|WITH LRN)[^0-9]{0,48}([0-9][0-9 \-]{8,18}[0-9])",
        r"LRN\s*[\):]?\s*([0-9][0-9 \-]{8,18}[0-9])",
    )
    for pat in patterns:
        m = re.search(pat, s)
        if not m:
            continue
        digits = re.sub(r"\D+", "", m.group(1))
        if 10 <= len(digits) <= 12:
            return digits
    return None


def _extract_academic_name_from_labeled_text(text: str) -> str:
    """Parse SF10/SF9 learner block lines like LAST NAME: TARUC FIRST NAME: ISAIAH."""
    import re

    raw_lines = [x for x in (text or "").splitlines() if (x or "").strip()]
    norm_lines = [_norm_ocr_text(x) for x in raw_lines]

    def _pick_value(label_pat: str, lines: list[str]) -> str:
        for i, ln in enumerate(lines):
            if not re.search(label_pat, ln, re.I):
                continue
            same = re.search(
                rf"{label_pat}\s*:?\s*([A-Z][A-Z \-' ]{{1,28}}?)(?:\s+(?:NAME EXTN|MIDDLE|LAST|FIRST|LEARNER|LEAMER|REFERENCE|LRN|BIRTH)|$)",
                ln,
                re.I,
            )
            if same:
                val = same.group(1).strip()
                if _academic_name_part_plausible(val):
                    return val
            for j in (0, 1):
                if i + j + 1 >= len(lines):
                    continue
                nxt = lines[i + j + 1].strip()
                if re.search(label_pat, nxt, re.I):
                    continue
                if _academic_name_part_plausible(nxt):
                    return nxt
        return ""

    first = _pick_value(r"FIRST\s*NAME", norm_lines)
    middle = _pick_value(r"MIDDLE\s*NAME", norm_lines)
    last = _pick_value(r"LAST\s*NAME", norm_lines)
    parts = [p for p in (first, middle, last) if p]
    if len(parts) >= 2:
        return " ".join(parts)[:64]

    s = _norm_ocr_text(text or "")
    if not s:
        return ""
    chunks = re.split(r"\n+", s)
    pool = chunks if len(chunks) > 1 else [s]
    for chunk in pool:
        if any(k in chunk for k in ("REFERENCE", "LEAMER", "LEARNER REFERENCE")):
            chunk = re.split(r"(?:LEARNER|LEAMER)\s+REFERENCE", chunk, maxsplit=1, flags=re.I)[0]
        if "LAST" not in chunk and "FIRST" not in chunk:
            continue
        last_m = re.search(
            r"LAST\s*NAME\s*:?\s*([A-Z][A-Z \-']{1,24}?)(?:\s+FIRST|\s+MIDDLE|\s+NAME EXTN|\s+LEARNER|\s+LEAMER|\s+REFERENCE|\s+LRN|$)",
            chunk,
        )
        first_m = re.search(
            r"FIRST\s*NAME\s*:?\s*([A-Z][A-Z \-']{1,24}?)(?:\s+NAME EXTN|\s+MIDDLE|\s+LAST|\s+LEARNER|\s+LEAMER|\s+REFERENCE|\s+LRN|$)",
            chunk,
        )
        middle_m = re.search(
            r"MIDDLE\s*NAME\s*:?\s*([A-Z][A-Z \-']{1,24}?)(?:\s+LEARNER|\s+LEAMER|\s+REFERENCE|\s+LRN|\s+BIRTH|$)",
            chunk,
        )
        parts = []
        if first_m and _academic_name_part_plausible(first_m.group(1)):
            parts.append(first_m.group(1).strip())
        if middle_m and _academic_name_part_plausible(middle_m.group(1)):
            parts.append(middle_m.group(1).strip())
        if last_m and _academic_name_part_plausible(last_m.group(1)):
            parts.append(last_m.group(1).strip())
        if len(parts) >= 2:
            return " ".join(parts)[:64]
    return ""


def _extract_school_years_from_text(text: str) -> list[str]:
    import re

    out: list[str] = []
    s = _norm_ocr_text(text or "")
    for m in re.finditer(r"\b(20\d{2})\s*[-/]\s*(20\d{2})\b", s):
        pair = f"{m.group(1)}-{m.group(2)}"
        if pair not in out:
            out.append(pair)
    return out


def _extract_lrn_from_ocr_boxes(
    _boxes: list[dict] | None,
    _img_h: int | None,
    *,
    top_ratio: float = 0.48,
) -> str | None:
    """
    Prefer LRN values from OCR boxes in the learner header band.

    SF10-JHS often splits the label across boxes (Learner / Reference / Number / (LRN):).
    """
    if not _boxes or not _img_h:
        return None
    try:
        import re

        top_y2 = int(float(_img_h) * top_ratio)
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
            nt = _norm_ocr_text(t)
            normed.append({"t": nt, "raw": t, "x": x, "y": y, "w": w, "h": h})

        labels = [b for b in normed if _is_lrn_label_text(b["t"])]
        labels.sort(key=lambda b: (b["y"], b["x"]))
        for lb in labels[:4]:
            lcy = lb["y"] + lb["h"] / 2.0
            band = max(16.0, lb["h"] * 1.25)
            row = [
                b
                for b in normed
                if abs((b["y"] + b["h"] / 2.0) - lcy) <= band
                and b["x"] >= lb["x"] - max(8, int(lb["w"] * 0.5))
            ]
            row.sort(key=lambda b: b["x"])
            digit_parts = [
                re.sub(r"\D+", "", b["t"])
                for b in row
                if re.search(r"[0-9]", b["t"])
                and not any(stop in b["t"].upper() for stop in _LRN_ROW_STOP_TOKENS)
                and not _is_lrn_label_text(b["t"])
            ]
            if digit_parts:
                combined = "".join(digit_parts)
                if 10 <= len(combined) <= 12:
                    return combined
            chunks: list[str] = []
            for b in row:
                tu = b["t"].upper()
                if any(stop in tu for stop in _LRN_ROW_STOP_TOKENS):
                    break
                if _is_lrn_label_text(b["t"]):
                    continue
                chunks.append(b["t"])
            joined = " ".join(chunks)
            digits = _extract_lrn_digits_from_text(joined)
            if digits:
                return digits
            m = re.search(r"\b([0-9][0-9 \-]{8,22}[0-9])\b", joined)
            if m:
                digits = re.sub(r"\D+", "", m.group(1))
                if 10 <= len(digits) <= 12:
                    return digits

            candidates = [
                b
                for b in normed
                if b is not lb
                and b["x"] > lb["x"] + max(6, int(lb["w"] * 0.5))
                and abs((b["y"] + b["h"] / 2.0) - lcy) <= band
            ]
            candidates.sort(key=lambda b: b["x"])
            joined = " ".join(b["t"] for b in candidates[:6])
            digits = _extract_lrn_digits_from_text(joined)
            if digits:
                return digits

        for b in normed:
            m = re.search(r"\b([0-9]{12})\b", b["t"])
            if m:
                return m.group(1)
    except Exception:
        return None
    return None


def _ocr_academic_learner_header_pass(
    filepath: str,
    img_h: int | None,
) -> tuple[str, list[dict]]:
    """Extra OCR on the SF9/SF10 learner block where the LRN is printed."""
    if not _tesseract_available or not filepath:
        return "", []
    try:
        from PIL import Image
    except ImportError:
        return "", []
    try:
        im = Image.open(filepath)
        w, h = im.size
        if img_h:
            h = int(img_h)
        y1 = max(0, int(h * 0.08))
        y2 = min(h, int(h * 0.30))
        crop = im.crop((0, y1, w, y2))
        chunks: list[str] = []
        merged_boxes: list[dict] = []
        for psm in (6, 11, 4):
            t, _, boxes = _ocr_tesseract_image(crop, psm=psm, enhanced=True)
            if (t or "").strip():
                chunks.append(t.strip())
            for b in boxes or []:
                try:
                    merged_boxes.append(
                        {
                            **b,
                            "y": int(b.get("y", 0)) + y1,
                        }
                    )
                except Exception:
                    continue
        return "\n".join(chunks), merged_boxes
    except Exception:
        return "", []


def _ocr_refine_lrn_region(
    filepath: str,
    boxes: list[dict] | None,
    img_h: int | None,
    img_w: int | None = None,
) -> str | None:
    """
    Second OCR pass on the LRN value strip when whole-page OCR truncates digits.

    Common on SF10-JHS where the LRN sits beside Birthdate on the same row.
    """
    if not _tesseract_available or not filepath:
        return None
    import re

    prep_path, prep_scale, _, _, prep_temp = _ocr_prepare_document_source(filepath, "form137")
    ocr_path = prep_path
    box_scale = float(prep_scale or 1.0)

    def _scale_box(b: dict) -> dict:
        if box_scale <= 1.01:
            return b
        return {
            **b,
            "x": int(float(b.get("x", 0)) * box_scale),
            "y": int(float(b.get("y", 0)) * box_scale),
            "w": max(1, int(float(b.get("w", 0)) * box_scale)),
            "h": max(1, int(float(b.get("h", 0)) * box_scale)),
        }

    scaled_boxes = [_scale_box(b) for b in (boxes or [])]
    if img_h and box_scale > 1.01:
        work_h = int(float(img_h) * box_scale)
        work_w = int(float(img_w or 0) * box_scale) if img_w else None
    else:
        work_h = img_h
        work_w = img_w

    try:
        return _ocr_refine_lrn_region_impl(ocr_path, scaled_boxes, work_h, work_w)
    finally:
        if prep_temp:
            try:
                os.remove(prep_path)
            except OSError:
                pass


def _ocr_refine_lrn_region_impl(
    filepath: str,
    boxes: list[dict] | None,
    img_h: int | None,
    img_w: int | None = None,
) -> str | None:
    if not _tesseract_available or not filepath:
        return None
    import re

    def _digits_from_chunks(chunks: list[str]) -> str | None:
        for chunk in chunks:
            digits = _extract_lrn_digits_from_text(chunk)
            if digits:
                return digits
            raw = re.sub(r"\D+", "", chunk or "")
            if len(raw) == 12:
                return raw
        return None

    def _ocr_digit_crop(crop) -> str | None:
        if crop.size[0] < 1 or crop.size[1] < 1:
            return None
        scale = 4 if crop.size[1] < 48 else 2
        up = crop.resize((max(1, crop.size[0] * scale), max(1, crop.size[1] * scale)))
        chunks: list[str] = []
        digit_cfg = "-c tessedit_char_whitelist=0123456789"
        for psm in (7, 8, 13, 6):
            t, _, _ = _ocr_tesseract_image(up, psm=psm, enhanced=True)
            if (t or "").strip():
                chunks.append(t.strip())
            try:
                import pytesseract

                t3 = pytesseract.image_to_string(up, config=f"--psm {psm} {digit_cfg}").strip()
                if t3:
                    chunks.append(t3)
            except Exception:
                pass
        return _digits_from_chunks(chunks)

    try:
        from PIL import Image
    except ImportError:
        return None
    try:
        im = Image.open(filepath)
        w, h = im.size
        if img_w:
            w = int(img_w)
        if img_h:
            h = int(img_h)

        normed: list[dict] = []
        if boxes:
            for b in boxes:
                t = str(b.get("text", "") or "").strip()
                if not t:
                    continue
                try:
                    normed.append(
                        {
                            "t": _norm_ocr_text(t),
                            "x": int(b.get("x", 0)),
                            "y": int(b.get("y", 0)),
                            "w": int(b.get("w", 0)),
                            "h": int(b.get("h", 0)),
                        }
                    )
                except (TypeError, ValueError):
                    continue

        label_boxes = [b for b in normed if _is_lrn_label_text(b["t"]) and b["y"] <= int(h * 0.48)]
        label_boxes.sort(key=lambda b: (b["y"], -("LRN" in b["t"]), b["x"]))

        for anchor in label_boxes[:4]:
            lcy = anchor["y"] + anchor["h"] / 2.0
            band = max(18.0, anchor["h"] * 1.25)
            digit_neighbors = [
                b
                for b in normed
                if b is not anchor
                and b["x"] > anchor["x"] + max(4, int(anchor["w"] * 0.35))
                and b["x"] < anchor["x"] + int(w * 0.42)
                and abs((b["y"] + b["h"] / 2.0) - lcy) <= band
                and re.search(r"[0-9]", b["t"])
            ]
            digit_neighbors.sort(key=lambda b: b["x"])
            if digit_neighbors:
                x1 = max(0, min(b["x"] for b in digit_neighbors) - 6)
                x2 = min(w, max(b["x"] + b["w"] for b in digit_neighbors) + 10)
                y1 = max(0, int(min(b["y"] for b in digit_neighbors) - 8))
                y2 = min(h, int(max(b["y"] + b["h"] for b in digit_neighbors) + 8))
                found = _ocr_digit_crop(im.crop((x1, y1, x2, y2)))
                if found:
                    return found

            row_labels = [
                b
                for b in label_boxes
                if abs((b["y"] + b["h"] / 2.0) - lcy) <= max(18.0, anchor["h"] * 1.3)
            ]
            label_x2 = max(b["x"] + b["w"] for b in row_labels)
            row_y1 = min(b["y"] for b in row_labels)
            row_y2 = max(b["y"] + b["h"] for b in row_labels)
            stop_x = int(w * 0.62)
            for b in normed:
                tu = b["t"].upper()
                if not any(stop in tu for stop in _LRN_ROW_STOP_TOKENS):
                    continue
                if abs((b["y"] + b["h"] / 2.0) - lcy) <= max(20.0, anchor["h"] * 1.4):
                    stop_x = min(stop_x, b["x"] - 4)
            x1 = max(0, label_x2 + 2)
            x2 = max(x1 + 40, min(stop_x, int(w * 0.62)))
            y1 = max(0, int(row_y1 - anchor["h"] * 0.35))
            y2 = min(h, int(row_y2 + anchor["h"] * 0.55))
            if x2 - x1 >= 30 and y2 - y1 >= 8:
                found = _ocr_digit_crop(im.crop((x1, y1, x2, y2)))
                if found:
                    return found

        band_txt, band_boxes = _ocr_academic_learner_header_pass(filepath, h)
        found = _extract_lrn_from_ocr_boxes(band_boxes, h) or _extract_lrn_digits_from_text(band_txt)
        if found:
            return found
    except Exception:
        return None
    return None


def _upgrade_birth_cert_header_doc_checks(
    payload: dict,
    ocr_text: str,
    boxes: list[dict] | None,
    img_h: int | None,
) -> None:
    """Re-score PSA/Republic header labels using header-band OCR and seal scan."""
    checks = list(payload.get("doc_checks") or [])
    if not checks:
        return
    header_txt = _ocr_text_from_header_boxes(boxes, img_h)
    combined = _norm_ocr_text(f"{ocr_text or ''} {header_txt}")
    psa_ok = _psa_has_authority_header(combined)
    rep_ok = _psa_has_republic_header(combined)
    seal = payload.get("seal_scan") or {}
    try:
        seal_conf = float(seal.get("confidence") or 0.0)
    except (TypeError, ValueError):
        seal_conf = 0.0
    if seal.get("detected") and seal_conf >= 0.28:
        psa_ok = True
    for row in checks:
        field = str(row.get("field") or "")
        if "PSA header" in field and psa_ok:
            row["ok"] = True
        elif "Republic of the Philippines" in field and rep_ok:
            row["ok"] = True
    payload["doc_checks"] = checks


def _multiscale_template_match_score(roi_gray, template_gray) -> float:
    score, _bbox = _multiscale_template_match_detail(roi_gray, template_gray)
    return score


def _multiscale_template_match_detail(
    roi_gray,
    template_gray,
    *,
    offset_x: float = 0.0,
    offset_y: float = 0.0,
) -> tuple[float, dict | None]:
    try:
        import cv2
    except ImportError:
        return 0.0, None
    if roi_gray is None or template_gray is None:
        return 0.0, None
    if roi_gray.size == 0 or template_gray.size == 0:
        return 0.0, None

    best = 0.0
    best_bb: dict | None = None
    for scale in (0.28, 0.35, 0.5, 0.65, 0.8, 1.0, 1.2, 1.45):
        tw = max(8, int(template_gray.shape[1] * scale))
        th = max(8, int(template_gray.shape[0] * scale))
        tpl = cv2.resize(template_gray, (tw, th))
        if roi_gray.shape[0] < tpl.shape[0] or roi_gray.shape[1] < tpl.shape[1]:
            continue
        res = cv2.matchTemplate(roi_gray, tpl, cv2.TM_CCOEFF_NORMED)
        _min_val, max_val, _min_loc, max_loc = cv2.minMaxLoc(res)
        if float(max_val) > best:
            best = float(max_val)
            best_bb = {
                "x": float(offset_x + max_loc[0]),
                "y": float(offset_y + max_loc[1]),
                "w": float(tw),
                "h": float(th),
            }
    return best, best_bb


def _orb_template_match_score(roi_bgr, template_gray) -> float:
    """ORB keypoint fallback when template correlation is weak (phone scans, compression)."""
    try:
        import cv2
    except ImportError:
        return 0.0
    if roi_bgr is None or template_gray is None or roi_bgr.size == 0 or template_gray.size == 0:
        return 0.0
    gray = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2GRAY) if len(roi_bgr.shape) == 3 else roi_bgr
    orb = cv2.ORB_create(500)
    kp1, des1 = orb.detectAndCompute(gray, None)
    kp2, des2 = orb.detectAndCompute(template_gray, None)
    if des1 is None or des2 is None or len(kp1) < 8 or len(kp2) < 8:
        return 0.0
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = bf.match(des1, des2)
    if not matches:
        return 0.0
    return min(1.0, len(matches) / max(12.0, len(kp2) * 0.35))


def _header_circle_emblem_score(roi_bgr) -> float:
    """Round seal/emblem heuristic in certificate header."""
    try:
        import cv2
    except ImportError:
        return 0.0
    if roi_bgr is None or roi_bgr.size == 0:
        return 0.0
    gray = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.medianBlur(gray, 5)
    h, w = gray.shape[:2]
    min_r = max(10, min(h, w) // 18)
    max_r = min(h, w) // 2
    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=max(min_r * 2, 24),
        param1=80,
        param2=34,
        minRadius=min_r,
        maxRadius=max_r,
    )
    if circles is None:
        return 0.0
    return min(1.0, len(circles[0]) * 0.22)


def _ocr_seal_keyword_boost(ocr_text: str, doc_type: str) -> tuple[float, list[str]]:
    """Textual hints when visual match is weak (DepEd/PSA headers)."""
    u = _norm_ocr_text(ocr_text or "")
    if not u:
        return 0.0, []
    dt = (doc_type or "").strip().lower()
    if dt in ("goodmoral",):
        dt = "good_moral"
    signals: list[str] = []
    score = 0.0
    if dt in ("birth_certificate", "birthcert"):
        keys = (
            "PHILIPPINE STATISTICS AUTHORITY",
            "PHILIPPINE STATISTICS",
            "PSA",
            "CIVIL REGISTRAR",
            "CERTIFICATE OF LIVE BIRTH",
            "REPUBLIC OF THE PHILIPPINES",
            "REPUBLIC",
            "REPUTILC",
        )
        hits = [k for k in keys if k in u]
        if hits:
            score = min(1.0, 0.42 + 0.08 * len(hits))
            signals.append(f"PSA/ civil registrar header text detected ({hits[0]}).")
    elif dt == "good_moral":
        keys = (
            "DEPARTMENT OF EDUCATION",
            "KAGAWARAN",
            "REPUBLIC OF THE PHILIPPINES",
            "SCHOOLS DIVISION",
            "DIVISION OF",
        )
        hits = [k for k in keys if k in u]
        if hits:
            score = min(1.0, 0.38 + 0.07 * len(hits))
            signals.append(f"DepEd / school header text detected ({hits[0]}).")
    return score, signals


def _scan_seal_or_logo(filepath: str, doc_type: str, *, ocr_text: str = "") -> dict:
    """
    Visual seal/logo scan for PSA birth certificates and good moral certificates.
    Uses template matching plus color heuristics (PSA blue round seal, DepEd header emblem).
    """
    fallback = {
        "detected": False,
        "confidence": 0.0,
        "label": "",
        "signals": [],
        "scan_method": "visual",
    }
    dt = (doc_type or "").strip().lower()
    if dt in ("goodmoral",):
        dt = "good_moral"
    if dt not in ("birth_certificate", "birthcert", "good_moral"):
        return fallback

    try:
        import cv2
    except ImportError:
        fallback["signals"] = ["OpenCV unavailable for seal/logo scan."]
        return fallback

    try:
        img = cv2.imread(filepath)
        if img is None:
            fallback["signals"] = ["Could not read image for seal/logo scan."]
            return fallback

        h, w = img.shape[:2]
        signals: list[str] = []

        if dt in ("birth_certificate", "birthcert"):
            label = "PSA seal/logo (visual)"
            tpl = _load_seal_template("psa_logo.png")
            search = img[0 : int(h * 0.26), 0 : int(w * 0.34)]
            tl = img[0 : int(h * 0.24), 0 : int(w * 0.30)]
            blue = _blue_pixel_ratio(tl)
            match = 0.0
            orb = 0.0
            circle = _header_circle_emblem_score(tl)
            seal_bb: dict | None = None
            if tpl is not None:
                gray = cv2.cvtColor(search, cv2.COLOR_BGR2GRAY)
                match, seal_bb = _multiscale_template_match_detail(gray, tpl)
                orb = _orb_template_match_score(search, tpl)
            text_boost, text_signals = _ocr_seal_keyword_boost(ocr_text, dt)
            confidence = max(min(1.0, blue * 3.5), match, orb * 0.85, circle * 0.55, text_boost)
            detected = (
                blue >= 0.07
                or match >= 0.34
                or orb >= 0.28
                or circle >= 0.22
                or text_boost >= 0.42
            )
            if blue >= 0.07:
                signals.append(f"Blue PSA-style seal detected in header ({blue * 100:.0f}% of top-left area).")
            if match >= 0.30:
                signals.append(f"PSA logo template match {int(round(match * 100))}%.")
            if orb >= 0.24:
                signals.append(f"PSA emblem feature match {int(round(orb * 100))}%.")
            if circle >= 0.22:
                signals.append("Round seal shape detected in PSA header area.")
            signals.extend(text_signals)
            if not detected:
                signals.append("No PSA round seal or logo detected in the document header.")
        else:
            label = "Official seal/logo (DepEd or school emblem)"
            deped = _load_seal_template("deped_logo.png")
            deped_ncr = _load_seal_template("deped_ncr_logo.png")
            regions = [
                ("header center", 0.06, 0.0, 0.94, 0.32),
                ("header left", 0.0, 0.0, 0.38, 0.30),
                ("header right", 0.62, 0.0, 1.0, 0.30),
            ]
            best = 0.0
            best_orb = 0.0
            best_label = ""
            seal_bb = None
            for region_name, x0, y0, x1, y1 in regions:
                rx = int(w * x0)
                ry = int(h * y0)
                roi = img[ry : int(h * y1), rx : int(w * x1)]
                if roi.size == 0:
                    continue
                gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
                for tpl_name, tpl in (("DepEd seal", deped), ("DepEd NCR seal", deped_ncr)):
                    if tpl is None:
                        continue
                    score, bb = _multiscale_template_match_detail(gray, tpl, offset_x=rx, offset_y=ry)
                    orb = _orb_template_match_score(roi, tpl)
                    combined = max(score, orb * 0.9)
                    if combined > best:
                        best = combined
                        best_orb = orb
                        best_label = f"{tpl_name} in {region_name}"
                        seal_bb = bb
            top_band = img[0 : int(h * 0.34), int(w * 0.04) : int(w * 0.96)]
            try:
                import numpy as np

                sat = float(np.mean(cv2.cvtColor(top_band, cv2.COLOR_BGR2HSV)[:, :, 1] > 45))
            except Exception:
                sat = 0.0
            circle = _header_circle_emblem_score(top_band)
            text_boost, text_signals = _ocr_seal_keyword_boost(ocr_text, dt)
            confidence = max(best, best_orb * 0.85, min(1.0, sat * 4.0), circle * 0.5, text_boost)
            detected = (
                best >= 0.30
                or best_orb >= 0.26
                or sat >= 0.035
                or circle >= 0.22
                or text_boost >= 0.38
            )
            if best_label and best >= 0.28:
                signals.append(f"{best_label}: template match {int(round(best * 100))}%.")
            if best_orb >= 0.24:
                signals.append(f"DepEd emblem feature match {int(round(best_orb * 100))}%.")
            if sat >= 0.035:
                signals.append(f"Colored emblem detected in certificate header ({sat * 100:.1f}% saturated area).")
            if circle >= 0.22:
                signals.append("Round seal/emblem shape detected in certificate header.")
            signals.extend(text_signals)
            if not detected:
                signals.append("No DepEd or school seal/logo detected in the certificate header.")

        result = {
            "detected": bool(detected),
            "confidence": round(float(confidence), 2),
            "label": label,
            "signals": signals[:6],
            "scan_method": "visual",
        }
        if seal_bb:
            result["bbox"] = seal_bb
        return result
    except Exception:
        fallback["signals"] = ["Seal/logo scan failed unexpectedly."]
        return fallback


def _append_seal_logo_doc_check(
    payload: dict,
    filepath: str,
    doc_type: str,
    *,
    ocr_text: str = "",
) -> None:
    """Add seal/logo visual check to doc_checks and refresh match confidence."""
    scan = _scan_seal_or_logo(filepath, doc_type, ocr_text=ocr_text)
    label = str(scan.get("label") or "Seal/logo (visual)")
    detected = bool(scan.get("detected"))
    confidence = float(scan.get("confidence") or 0.0)
    row = {
        "field": label,
        "ok": detected,
        "scan_method": "visual",
        "match_ratio": round(confidence, 2) if detected else 0.0,
    }
    note = "; ".join(str(s) for s in (scan.get("signals") or []) if str(s).strip())
    if note:
        row["note"] = note
    bb = scan.get("bbox")
    if isinstance(bb, dict) and all(k in bb for k in ("x", "y", "w", "h")):
        row.update(
            {
                "x": float(bb["x"]),
                "y": float(bb["y"]),
                "w": float(bb["w"]),
                "h": float(bb["h"]),
            }
        )

    checks = list(payload.get("doc_checks") or [])
    checks = [c for c in checks if str(c.get("field") or "").strip().lower() != label.lower()]
    checks.append(row)
    payload["doc_checks"] = checks
    payload["seal_scan"] = scan

    if not detected:
        payload["issues"] = (payload.get("issues") or []) + [
            f"Seal/logo scan: {note or 'official seal or logo not detected in the document header.'}"
        ]


def _refresh_verify_confidence(
    payload: dict,
    *,
    doc_type: str,
    ocr_confidence: float,
    word_count: int,
    detected_lrn: str | None,
    is_photo: bool,
) -> None:
    doc_checks = list(payload.get("doc_checks") or [])
    field_checks = list(payload.get("field_checks") or [])
    score = _composite_verify_score(
        is_photo=is_photo,
        ocr_confidence=ocr_confidence,
        word_count=word_count,
        doc_checks=doc_checks,
        field_checks=field_checks,
        detected_lrn=detected_lrn,
        doc_type=doc_type,
    )
    payload["confidence"] = score
    payload["match_score"] = score


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

    def _security_alert_level(passes: list[bool]) -> int:
        """0 = all clear; increases to the index of the highest failed stage (1-based)."""
        alert = 0
        for i, ok in enumerate(passes):
            if not ok:
                alert = i + 1
        return alert

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

    if is_photo:
        # 2×2 ID photos: image quality + AI tamper/synthetic only (no enrollment mismatch).
        l1_concern = _concern_display_score(l1_pass, l1_score)
        l1_summary_out = (
            "Image quality acceptable — 0% concern."
            if l1_pass
            else f"Image quality concern — {l1_concern}%."
        )

        syn_score = float(payload.get("synthetic_score") or 1.0)
        syn_signals = list(payload.get("synthetic_signals") or [])
        cells = tamper_cells or []
        fields = tamper_fields or []
        high_risk = any(str(c.get("risk")) == "high" for c in cells) or any(
            str(f.get("risk")) == "high" for f in fields
        )
        combined_integrity = min(_clamp01(tamper_score), _clamp01(syn_score))
        ai_pass = (
            tamper_score >= 0.50
            and syn_score >= 0.72
            and not (high_risk and combined_integrity < 0.65)
        )
        ai_concern = _concern_display_score(ai_pass, int(round(combined_integrity * 100)))
        ai_issues = (list(payload.get("tamper_signals") or []) + syn_signals)[:6]
        if ai_pass:
            ai_summary = "AI tamper and synthetic check clear — 0% concern."
        else:
            ai_summary = (
                f"Possible AI edit or manipulation — {ai_concern}% concern; review the preview."
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
            _level_pack(
                level=2,
                title="AI tamper & authenticity",
                passed=ai_pass,
                score=ai_concern,
                summary=ai_summary,
                issues=ai_issues,
            ),
        ]
        overall_pass = l1_pass and ai_pass
        alert_level = _security_alert_level([l1_pass, ai_pass])
        return {
            "levels": levels,
            "overall_pass": overall_pass,
            "alert_level": alert_level,
            "highest_level_passed": alert_level,
            "quality_enforced_at_upload": quality_enforced_at_upload,
            "photo_only_checks": True,
        }

    doc_checks = list(payload.get("doc_checks") or [])
    field_checks = list(payload.get("field_checks") or [])
    ocr_conf = float(payload.get("ocr_confidence") or 0.0)
    match_conf = float(payload.get("confidence") or 0.0)

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
    if field_checks:
        field_concern = _field_check_concern_pct(field_checks)
        if field_concern > 0:
            l2_concern = field_concern
            l2_pass = False
    l2_summary = _document_match_summary(doc_checks, field_checks, l2_concern, l2_pass)

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
    if l3_pass:
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
    payload = {
        "ok": _ocr_any_available(),
        "ocr_engine": _ocr_primary,
        "ocr_primary": _ocr_primary,
        "tesseract_available": _tesseract_available,
        "easyocr_available": _easyocr_available,
        "ocr_fallback_enabled": not _env_flag("DISABLE_OCR_FALLBACK"),
    }
    if _tesseract_available and _tesseract_exe:
        payload["tesseract"] = _tesseract_exe
    elif not _ocr_any_available():
        payload["hint"] = (
            "Tesseract OCR binary not found. Install via apt (`apt-get install tesseract-ocr`) on Linux, "
            "the UB Mannheim build on Windows, or `brew install tesseract` on macOS. "
            "Override the path with the TESSERACT_CMD environment variable. "
            "Alternatively install PyTorch + EasyOCR on Python 3.11–3.12."
        )
    return jsonify(payload)


def _ocr_document_types_needing_upscale() -> frozenset[str]:
    return frozenset(
        {
            "birth_certificate",
            "birthcert",
            "form137",
            "sf10",
            "form157",
            "sf9",
            "report_card",
            "good_moral",
            "goodmoral",
        }
    )


def _ocr_prepare_document_source(
    filepath: str,
    doc_type: str,
) -> tuple[str, float, int, int, bool]:
    """
    Upscale low-resolution document scans before OCR.

    Phone photos and compressed uploads (e.g. ~600px wide) often look readable in the
    UI preview but Tesseract cannot read LRN / name fields until enlarged.
    """
    try:
        from PIL import Image
    except ImportError:
        return filepath, 1.0, 0, 0, False

    key = _normalize_doc_type_key(doc_type)
    if key in PHOTO_DOC_TYPES:
        return filepath, 1.0, 0, 0, False

    try:
        im = Image.open(filepath)
        orig_w, orig_h = im.size
    except Exception:
        return filepath, 1.0, 0, 0, False

    if key not in _ocr_document_types_needing_upscale():
        return filepath, 1.0, orig_w, orig_h, False

    long_edge = max(orig_w, orig_h)
    pixels = orig_w * orig_h
    target_long = 2000
    scale = 1.0
    if long_edge < 1600 or pixels < 900_000:
        scale = min(4.0, max(1.0, target_long / float(long_edge)))

    if scale <= 1.01:
        return filepath, 1.0, orig_w, orig_h, False

    try:
        resample = Image.Resampling.LANCZOS
    except AttributeError:
        resample = Image.LANCZOS

    new_w = max(1, int(round(orig_w * scale)))
    new_h = max(1, int(round(orig_h * scale)))
    prepared = im.convert("RGB").resize((new_w, new_h), resample=resample)
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp_path = tmp.name
    tmp.close()
    prepared.save(tmp_path, "PNG")
    print(
        f"[IntelliDocs AI] Upscaled OCR source {orig_w}x{orig_h} -> {new_w}x{new_h} ({scale:.2f}x)",
        flush=True,
    )
    return tmp_path, scale, orig_w, orig_h, True


def _ocr_scale_boxes_to_original(boxes: list[dict] | None, scale: float) -> list[dict]:
    if not boxes or scale <= 1.01:
        return boxes or []
    inv = 1.0 / scale
    out: list[dict] = []
    for b in boxes:
        try:
            out.append(
                {
                    **b,
                    "x": int(float(b.get("x", 0)) * inv),
                    "y": int(float(b.get("y", 0)) * inv),
                    "w": max(1, int(float(b.get("w", 0)) * inv)),
                    "h": max(1, int(float(b.get("h", 0)) * inv)),
                }
            )
        except Exception:
            out.append(b)
    return out


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
    return _ocr_tesseract_image(image, psm=None, enhanced=False)


def _ocr_tesseract_image(
    image,
    *,
    psm: int | None = None,
    enhanced: bool = False,
) -> tuple[str, float, list[dict]]:
    import pytesseract
    from PIL import ImageEnhance, ImageFilter

    img = image
    if enhanced:
        img = img.convert("L")
        img = ImageEnhance.Contrast(img).enhance(1.85)
        img = ImageEnhance.Sharpness(img).enhance(1.4)
        img = img.filter(ImageFilter.SHARPEN)

    config_parts: list[str] = []
    if psm is not None:
        config_parts.append(f"--psm {psm}")
    config = " ".join(config_parts)

    text = pytesseract.image_to_string(img, config=config).strip()
    data = pytesseract.image_to_data(img, config=config, output_type=pytesseract.Output.DICT)
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


def _ocr_fallback_min_conf() -> float:
    raw = (os.environ.get("AI_OCR_FALLBACK_MIN_CONF") or "0.38").strip()
    try:
        return max(0.05, min(0.95, float(raw)))
    except ValueError:
        return 0.38


def _ocr_fallback_min_words(doc_type: str) -> int:
    if _normalize_doc_type_key(doc_type) in PHOTO_DOC_TYPES:
        return 0
    raw = (os.environ.get("AI_OCR_FALLBACK_MIN_WORDS") or "10").strip()
    try:
        return max(0, int(raw))
    except ValueError:
        return 10


def _ocr_read_quality_score(text: str, avg_conf: float) -> float:
    words = len((text or "").split())
    conf = max(0.0, min(1.0, float(avg_conf)))
    return words * (0.25 + 0.75 * conf)


def _ocr_psa_form_score(text: str) -> float:
    """Heuristic boost for PSA birth certificate reads (block PSM often captures field 1 name)."""
    u = re.sub(r"\s+", " ", (text or "").upper())
    score = 0.0
    if re.search(r"\b1\b", u) and "NAME" in u:
        score += 3.0
    if "SEX" in u and ("DATE OF BIRTH" in u or re.search(r"\b3\b", u)):
        score += 2.0
    if "MAIDEN" in u:
        score += 1.5
    if re.search(r"\b13\b", u) and "NAME" in u:
        score += 1.0
    for line in (text or "").splitlines()[:35]:
        lead = re.sub(r"[^A-Z'.\- ]+", " ", line.upper()).strip()
        parts = [p for p in lead.split() if re.fullmatch(r"[A-Z][A-Z'.\-]*", p) and len(p) >= 2]
        if len(parts) >= 3:
            score += 4.0
            break
    return score


def _ocr_candidate_score(text: str, avg_conf: float, doc_type: str) -> float:
    score = _ocr_read_quality_score(text, avg_conf)
    if _normalize_doc_type_key(doc_type) in ("birth_certificate", "birthcert"):
        score += _ocr_psa_form_score(text) * 12.0
    return score


def _ocr_needs_fallback(text: str, avg_conf: float, doc_type: str) -> bool:
    if _env_flag("DISABLE_OCR_FALLBACK"):
        return False
    if _normalize_doc_type_key(doc_type) in PHOTO_DOC_TYPES:
        return False
    words = len((text or "").split())
    if words < _ocr_fallback_min_words(doc_type):
        return True
    if not (text or "").strip():
        return True
    return float(avg_conf) < _ocr_fallback_min_conf()


def _ocr_read_document(
    filepath: str,
    doc_type: str,
) -> tuple[str, float, list[dict], dict]:
    """
    Multi-level OCR:
      1) Primary engine (Tesseract or EasyOCR per AI_OCR_ENGINE)
      2) Enhanced Tesseract + alternate page segmentation (PSM 6, 11, 4)
         — always for PSA / SF9 / SF10; otherwise when level-1 read is weak
      3) Secondary engine (EasyOCR lazy, or Tesseract if primary was EasyOCR)
    """
    ocr_path, ocr_scale, orig_w, orig_h, ocr_temp = _ocr_prepare_document_source(filepath, doc_type)
    passes: list[dict] = []
    candidates: list[tuple[str, str, str, float, list[dict]]] = []

    def _run(level: int, engine: str, label: str, text: str, conf: float, boxes: list[dict]) -> None:
        passes.append(
            {
                "level": level,
                "engine": label,
                "confidence": round(float(conf), 4),
                "words": len((text or "").split()),
            }
        )
        candidates.append((engine, label, text, conf, boxes))

    try:
        # Level 1 — primary
        if _ocr_primary == "easyocr" and _easyocr_available and _easyocr_reader is not None:
            t1, c1, b1 = _ocr_easyocr(ocr_path)
            _run(1, "easyocr", "easyocr", t1, c1, b1)
        elif _tesseract_available:
            t1, c1, b1 = _ocr_tesseract(ocr_path)
            _run(1, "tesseract", "tesseract", t1, c1, b1)
        elif _easyocr_available and _easyocr_reader is not None:
            t1, c1, b1 = _ocr_easyocr(ocr_path)
            _run(1, "easyocr", "easyocr", t1, c1, b1)
        else:
            raise RuntimeError("No OCR engine available")

        best = max(candidates, key=lambda row: _ocr_candidate_score(row[2], row[3], doc_type))
        best_engine, best_label, best_text, best_conf, best_boxes = best

        _priority_doc = _ocr_priority_doc(doc_type)
        needs_enhanced = _ocr_needs_fallback(best_text, best_conf, doc_type) or _priority_doc

        if needs_enhanced:
            from PIL import Image

            level = 2
            if _tesseract_available:
                try:
                    base = Image.open(ocr_path)
                    for psm, tag in ((6, "tesseract_enhanced_psm6"), (11, "tesseract_enhanced_psm11"), (4, "tesseract_enhanced_psm4")):
                        t2, c2, b2 = _ocr_tesseract_image(base, psm=psm, enhanced=True)
                        _run(level, "tesseract", tag, t2, c2, b2)
                        level += 1
                        cand = max(candidates, key=lambda row: _ocr_candidate_score(row[2], row[3], doc_type))
                        if _ocr_candidate_score(cand[2], cand[3], doc_type) > _ocr_candidate_score(best_text, best_conf, doc_type):
                            best_engine, best_label, best_text, best_conf, best_boxes = cand
                        if not _priority_doc and not _ocr_needs_fallback(best_text, best_conf, doc_type):
                            break
                except Exception as exc:
                    print(f"[IntelliDocs AI] Enhanced Tesseract fallback failed: {exc}", flush=True)

            # Level 3 — secondary engine
            if _ocr_needs_fallback(best_text, best_conf, doc_type):
                secondary: list[tuple[str, str, object]] = []
                if best_engine != "easyocr" and _ensure_easyocr_loaded():
                    secondary.append(("easyocr", "easyocr_fallback", lambda: _ocr_easyocr(ocr_path)))
                if best_engine != "tesseract" and _tesseract_available:
                    secondary.append(("tesseract", "tesseract_fallback", lambda: _ocr_tesseract(ocr_path)))

                for eng, tag, fn in secondary:
                    try:
                        t3, c3, b3 = fn()
                        _run(level, eng, tag, t3, c3, b3)
                        level += 1
                        cand = max(candidates, key=lambda row: _ocr_candidate_score(row[2], row[3], doc_type))
                        if _ocr_candidate_score(cand[2], cand[3], doc_type) > _ocr_candidate_score(best_text, best_conf, doc_type):
                            best_engine, best_label, best_text, best_conf, best_boxes = cand
                        if not _ocr_needs_fallback(best_text, best_conf, doc_type):
                            break
                    except Exception as exc:
                        print(f"[IntelliDocs AI] OCR fallback ({tag}) failed: {exc}", flush=True)

        if _normalize_doc_type_key(doc_type) in ("birth_certificate", "birthcert"):
            header_extra = _ocr_birth_cert_header_text(ocr_path)
            if (header_extra or "").strip():
                best_text = f"{(best_text or '').strip()}\n{header_extra.strip()}".strip()

        best_boxes = _ocr_scale_boxes_to_original(best_boxes, ocr_scale)

        primary_pass = passes[0] if passes else {}
        fallback_used = best_label != str(primary_pass.get("engine") or best_label)

        meta = {
            "engine": best_label,
            "primary_engine": _ocr_primary,
            "fallback_used": fallback_used,
            "passes": passes,
            "ocr_scale": round(float(ocr_scale), 4),
            "original_width": orig_w or None,
            "original_height": orig_h or None,
        }
        return best_text, best_conf, best_boxes, meta
    finally:
        if ocr_temp:
            try:
                os.remove(ocr_path)
            except OSError:
                pass


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
    filepath: str | None = None,
    img_w: int | None = None,
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
        return _extract_lrn_digits_from_text(u)

    def extract_lrn_from_boxes(_boxes: list[dict] | None, _img_h: int | None) -> str | None:
        return _extract_lrn_from_ocr_boxes(_boxes, _img_h)

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
    slot_mismatch_info: dict[str, str] | None = None
    if _normalize_doc_type_key(requested_doc_type) != _normalize_doc_type_key(doc_type):
        expected_label = _doc_type_display_label(requested_doc_type)
        detected_label = _doc_type_display_label(doc_type)
        slot_mismatch_info = {
            "expected": expected_label,
            "detected": detected_label,
        }
        issues.insert(
            0,
            f"Wrong document: this slot requires {expected_label}, but the scan appears to be a {detected_label}.",
        )
        penalize(0.40)
    elif doc_type == "birth_certificate" and requested_doc_type not in ("birth_certificate", "birthcert"):
        issues.append(
            "Document content matches a PSA birth certificate; using identity checks only (not school record fields)."
        )
    lrn_from_boxes = extract_lrn_from_boxes(boxes, img_h)
    lrn_from_text = extract_lrn_from_text(norm_text)
    lrn_loose = _extract_lrn_loose_from_text(norm_text)
    detected_lrn = lrn_from_boxes or lrn_from_text or lrn_loose
    lrn_refined = False
    if (
        (not is_photo)
        and doc_type in ("form137", "sf10", "form157", "sf9", "report_card")
        and not detected_lrn
        and filepath
    ):
        refined = _ocr_refine_lrn_region(filepath, boxes, img_h, img_w)
        if refined:
            detected_lrn = refined
            lrn_from_boxes = refined
            lrn_refined = True

    # --- Doc-specific "what we check" lists (for clearer UI) ---
    doc_checks: list[dict] = []
    if not is_photo:
        try:
            import re

            def has_any(needles: list[str], *, source: str | None = None) -> bool:
                return contains_any(source if source is not None else norm_text, needles)

            def has_date_like() -> bool:
                # Not strict date parsing; just look for common DOB formats.
                return bool(
                    re.search(r"\b(19|20)\d{2}[-/](0?\d|1[0-2])[-/](0?\d|[12]\d|3[01])\b", norm_text)
                    or re.search(r"\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[A-Z]*\b", norm_text)
                )

            if doc_type in ("birth_certificate", "birthcert"):
                # PSA Birth Certificate checks
                header_txt = _ocr_text_from_header_boxes(boxes, img_h)
                header_norm = normalize(header_txt)
                check_text = f"{norm_text} {header_norm}".strip()
                psa_header = _psa_has_authority_header(check_text)
                live_birth = has_any(["CERTIFICATE OF LIVE BIRTH", "LIVE BIRTH"], source=check_text)
                rep = _psa_has_republic_header(check_text)
                name_kw = has_any(["NAME"], source=check_text)
                dob_kw = has_any(["DATE OF BIRTH", "BIRTHDATE", "DATE"], source=check_text)
                pob_kw = has_any(["PLACE OF BIRTH", "PLACE"], source=check_text)
                sex_kw = has_any(["SEX", "MALE", "FEMALE"], source=check_text)
                reg_kw = has_any(
                    ["REGISTRY", "REGISTRY NO", "REGISTRY NO.", "REGISTRY NUMBER"],
                    source=check_text,
                )
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
                school_kw = has_any(
                    [
                        "SCHOOL",
                        "ACADEMY",
                        "HIGH SCHOOL",
                        "SENIOR HIGH",
                        "JUNIOR HIGH",
                        "NATIONAL HIGH",
                        "ELEMENTARY",
                        "INTEGRATED SCHOOL",
                    ]
                )
                date_kw = has_any(["DATE", "ISSUED", "THIS", "DAY OF"]) or has_date_like()

                doc_checks = [
                    {"field": "Good moral / moral character keyword", "ok": bool(moral_kw)},
                    {"field": "Certification/Certificate keyword", "ok": bool(cert_kw)},
                    {"field": "Name label", "ok": bool(name_kw)},
                    {"field": "School name keyword", "ok": bool(school_kw)},
                    {"field": "Date/issuance text found", "ok": bool(date_kw)},
                ]
            elif doc_type in ("sf9", "report_card"):
                # SF9 / Report card checks
                lrn_present = bool(re.sub(r"\D+", "", str(detected_lrn or ""))) and len(
                    re.sub(r"\D+", "", str(detected_lrn or ""))
                ) >= 10
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
                lrn_present = bool(re.sub(r"\D+", "", str(detected_lrn or ""))) and len(
                    re.sub(r"\D+", "", str(detected_lrn or ""))
                ) >= 10
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
        else:
            lrn_digit_len = len(re.sub(r"\D+", "", str(detected_lrn)))
            if lrn_digit_len < 12:
                issues.append(
                    f"LRN field shows {lrn_digit_len} digits (expected 12) - verify scan quality or correct SF10 upload."
                )
                penalize(0.18)
            elif lrn_from_text and not lrn_from_boxes and not lrn_refined:
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

            _NAME_NOISE_KEYWORDS = (
                "FATHER",
                "MOTHER",
                "INFORMANT",
                "ATTENDANT",
                "GENDER",
                "SEX",
                "FEMALE",
                "MALE",
                "PLACE OF BIRTH",
                "DATE OF BIRTH",
                "BIRTHDATE",
                "CERTIFICATE",
                "LIVE BIRTH",
                "REPUBLIC",
                "PHILIPPINE",
                "STATISTICS",
                "PSA",
                "REGISTRY",
                "FORM NO",
                "SF10",
                "SF 10",
                "FORM 137",
                "JHS",
                "SHS",
                "SCHOOL YEAR",
                "LEARNER S",
                "PAGE ",
                "COPY",
                "OCRG",
                "QUADR",
                "ACCOMPLISHED",
                "SCCOMPLISHED",
                "DOCUMENTARY",
                "STAMP TAX",
                "REMARKS",
                "REFERENCE",
                "LEAMER",
                "LEARNER REFERENCE",
                "ANNOTATION",
                "CIVIL REGISTRAR",
                "PREPARED BY",
                "RECEIVED AT",
                "CITIZENSHIP",
                "RELIGION",
                "OCCUPATION",
                "MAIDEN NAME",
                "HOSPITAL",
                "MUNICIPALITY",
                "BARANGAY",
                "DEPARTMENT",
                "EDUCATION",
                "EDUKASYON",
                "KAGAWARAN",
                "REPUBLIKA",
                "MINISTRY",
                "DIVISION OF",
                "SCHOOLS DIVISION",
                "PERMANENT RECORD",
                "OFFICIAL SEAL",
                "REPORT CARD",
                "HIGH SCHOOL",
                "ELEMENTARY SCHOOL",
                "ELEMENTARY",
                "ACADEMY",
                "LEARNING AREAS",
                "GENERAL AVERAGE",
                "ADVISER",
                "PRINCIPAL",
                "YEAR SECTION",
                "YEAR/SECTION",
            )

            def _looks_like_school_institution_name(text: str) -> bool:
                t = norm_simple(text or "")
                if not t:
                    return False
                institution_kw = (
                    "HIGH SCHOOL",
                    "ELEMENTARY",
                    "ACADEMY",
                    "COLLEGE",
                    "UNIVERSITY",
                    "SENIOR HIGH",
                    "JUNIOR HIGH",
                    "NATIONAL HIGH",
                    "INTEGRATED SCHOOL",
                    "REPORT CARD",
                    "DEPARTMENT OF",
                    "KAGAWARAN",
                    "DIVISION OFFICE",
                    "SCHOOLS DIVISION",
                    "LEARNING AREAS",
                    "GENERAL AVERAGE",
                )
                if any(k in t for k in institution_kw):
                    return True
                if re.search(r"\bSCHOOL\b", t) and len(t.split()) >= 2:
                    return True
                return False

            def _normalize_person_name_display(name: str) -> str:
                """LAST, FIRST [MIDDLE] → FIRST [MIDDLE] LAST for enrollment matching."""
                s = _strip_name_field_labels(name or "")
                if "," in s:
                    last_part, rest = [p.strip() for p in s.split(",", 1)]
                    if last_part and rest:
                        return f"{rest} {last_part}".strip()
                return s

            def _name_line_is_noise(ln: str) -> bool:
                nl = normalize(ln or "")
                if not nl:
                    return True
                if any(k in nl for k in _NAME_NOISE_KEYWORDS):
                    return True
                if re.search(r"\bPAGE\s*\d", nl):
                    return True
                if re.search(r"\bNAME OF (FATHER|MOTHER)\b", nl):
                    return True
                if re.search(r"\bCOPY\s+FOR\b", nl):
                    return True
                return False

            def _infer_image_size_from_boxes(normed: list[dict]) -> tuple[int | None, int | None]:
                if not normed:
                    return None, None
                try:
                    w = int(max(b["x"] + b["w"] for b in normed))
                    h = int(max(b["y"] + b["h"] for b in normed))
                    return (w if w > 0 else None), (h if h > 0 else None)
                except Exception:
                    return None, None

            _MONTH_NAMES = (
                "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
                "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
                "JAN", "FEB", "MAR", "APR", "JUN", "JUL", "AUG", "SEP", "SEPT",
                "OCT", "NOV", "DEC",
            )

            def _looks_like_date_fragment(text: str) -> bool:
                u = normalize(text or "")
                if not u:
                    return False
                if re.search(r"\bDATE OF BIRTH\b", u) or re.search(r"\bBIRTHDATE\b", u):
                    return True
                if re.search(r"\b(19|20)\d{2}\b", u):
                    return True
                if any(m in u for m in _MONTH_NAMES):
                    return True
                if re.search(r"\b(0?[1-9]|[12]\d|3[01])\b", u) and (
                    any(m in u for m in _MONTH_NAMES) or re.search(r"\b(19|20)\d{2}\b", u)
                ):
                    return True
                return False

            def _candidate_name_is_plausible(name: str) -> bool:
                clean = _normalize_person_name_display(name or "")
                if len(clean) < 3:
                    return False
                if (
                    _name_line_is_noise(clean)
                    or _looks_like_date_fragment(clean)
                    or _looks_like_school_institution_name(clean)
                ):
                    return False
                words = [w for w in clean.split() if len(w) >= 2 and w.isalpha()]
                return len(words) >= 2

            def _leading_name_words(text: str, max_parts: int = 4) -> str:
                """Take consecutive capitalized tokens from the start (PSA rows often have OCR junk after the name)."""
                parts: list[str] = []
                for p in norm_simple(text or "").split():
                    if not re.fullmatch(r"[A-Z][A-Z'.\-]*", p) or len(p) < 2:
                        break
                    if _looks_like_date_fragment(p) or p in _MONTH_NAMES:
                        break
                    parts.append(p)
                    if len(parts) >= max_parts:
                        break
                return " ".join(parts)

            def _box_looks_like_person_name_part(text: str) -> bool:
                s = _strip_name_field_labels(text or "")
                if not s or len(s) < 2 or len(s) > 48:
                    return False
                if (
                    _name_line_is_noise(s)
                    or _looks_like_date_fragment(s)
                    or _looks_like_school_institution_name(s)
                ):
                    return False
                if re.search(r"\d", s):
                    return False
                if not _academic_name_part_plausible(s):
                    return False
                if re.fullmatch(r"[A-Z][A-Z'.\-]*", s):
                    return True
                parts = s.split()
                if not parts or len(parts) > 4:
                    if len(parts) > 4:
                        lead = _leading_name_words(s, max_parts=4)
                        if lead:
                            s = lead
                            parts = s.split()
                        else:
                            return False
                    else:
                        return False
                return all(re.fullmatch(r"[A-Z][A-Z'.\-]*", p) for p in parts)

            def _psa_is_parent_field_line(nl: str) -> bool:
                """PSA Form 102: field 6–12 = mother, field 13+ = father (OCR often drops FATHER/MOTHER words)."""
                if not nl:
                    return False
                if "MAIDEN" in nl and not re.search(r"\b1\b", nl):
                    return True
                if re.search(r"\b(6|[7-9]|1[0-3])\b", nl) and "NAME" in nl:
                    if re.search(r"\b1\b", nl) and not re.search(r"\b(1[0-3]|[6-9])\b", nl):
                        return False
                    return True
                if re.search(r"\b1[4-9]\b", nl) and "NAME" in nl:
                    return True
                if re.search(r"\b2[0-5]\b", nl) and "NAME" in nl:
                    return True
                return False

            def _psa_hard_child_y_max(normed: list[dict], image_h: int | None) -> float:
                """Absolute upper y for field 1 — child name is always in the top ~28% of PSA Form 102."""
                ih = float(image_h or _infer_image_size_from_boxes(normed)[1] or 1400)
                return min(ih * 0.28, _psa_child_name_y_max(normed, image_h))

            def _psa_y_center_in_child_zone(y_center: float, normed: list[dict], image_h: int | None) -> bool:
                return float(y_center) <= _psa_hard_child_y_max(normed, image_h)

            def _psa_reject_parent_name(
                name: str,
                expected_name: str,
                normed: list[dict],
                image_h: int | None,
                bb: dict | None = None,
            ) -> bool:
                """True when name should be discarded (wrong person / wrong vertical zone)."""
                if not name:
                    return True
                exp_tokens = [t for t in norm_simple(expected_name).split(" ") if len(t) >= 2]
                if exp_tokens and exp_tokens[0] not in norm_simple(name):
                    return True
                if _psa_name_from_parent_section(name, normed, image_h, bb):
                    return True
                if bb and not _psa_y_center_in_child_zone(
                    float(bb.get("y", 0)) + float(bb.get("h", 0)) / 2.0, normed, image_h
                ):
                    return True
                return False

            def _psa_child_name_from_enrollment_tokens(
                expected_name: str,
                normed: list[dict],
                image_h: int | None,
                image_w: int | None,
            ) -> tuple[str, dict | None]:
                """Find the child row by enrollment first name in the upper PSA block only."""
                exp_tokens = [t for t in norm_simple(expected_name).split(" ") if len(t) >= 2]
                if not exp_tokens or not normed:
                    return "", None
                first_tok = exp_tokens[0]
                ih = float(image_h or _infer_image_size_from_boxes(normed)[1] or 1400)
                iw = float(image_w or _infer_image_size_from_boxes(normed)[0] or 1000)
                y_lo = ih * 0.05
                y_hi = _psa_hard_child_y_max(normed, image_h)
                x_max = iw * 0.72
                row_band = max(14.0, ih * 0.018)

                zone = [
                    b
                    for b in normed
                    if y_lo <= float(b["y"]) <= y_hi
                    and float(b["x"]) <= x_max
                    and _box_looks_like_person_name_part(b["t"])
                    and not _name_line_is_noise(b["t"])
                ]
                if not zone:
                    return "", None

                def _token_hit(bt: str) -> bool:
                    if first_tok in bt:
                        return True
                    if len(first_tok) >= 4 and first_tok[:4] in bt:
                        return True
                    return False

                anchors = [b for b in zone if _token_hit(b["t"])]
                if not anchors:
                    return "", None
                anchors.sort(key=lambda b: (float(b["y"]), float(b["x"])))
                seed = anchors[0]
                ry = int(round(float(seed["y"]) / row_band))
                row_boxes = [
                    b for b in zone if abs(int(round(float(b["y"]) / row_band)) - ry) <= 1
                ]
                row_boxes.sort(key=lambda b: float(b["x"]))
                parts: list[str] = []
                picked: list[dict] = []
                for b in row_boxes[:6]:
                    part = _strip_name_field_labels(b["t"])
                    if not part or not _box_looks_like_person_name_part(part):
                        continue
                    if _looks_like_date_fragment(part) or part in (
                        "DATE",
                        "BIRTH",
                        "SEX",
                        "NAME",
                        "FIRST",
                        "MIDDLE",
                        "LAST",
                        "FAST",
                        "MIDTE",
                    ):
                        continue
                    parts.append(part)
                    picked.append(b)
                full = _leading_name_words(" ".join(parts)) or " ".join(parts)
                if not full or first_tok not in norm_simple(full):
                    return "", None
                if not _candidate_name_is_plausible(full):
                    return "", None
                return full[:64], _union_bbox(picked) if picked else None

            def _psa_child_name_from_text_line(
                expected_name: str,
                u_simple: list[str],
                u_norm: list[str],
            ) -> str:
                """Best line read in the child block that contains the enrolled first name."""
                exp_tokens = [t for t in norm_simple(expected_name).split(" ") if len(t) >= 2]
                if not exp_tokens:
                    return ""
                parent_idx = _psa_parent_section_index(u_norm)
                best_ratio = -1.0
                best_name = ""
                for i in range(min(parent_idx, len(u_simple))):
                    if _psa_is_parent_field_line(u_norm[i]):
                        break
                    clean = _leading_name_words(_strip_name_field_labels(u_simple[i])) or _strip_name_field_labels(
                        u_simple[i]
                    )
                    if not clean or exp_tokens[0] not in clean:
                        continue
                    if not _box_looks_like_person_name_part(clean):
                        continue
                    hits = [t for t in exp_tokens if t in clean]
                    ratio = len(hits) / max(1, len(exp_tokens))
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best_name = clean
                if best_name and best_ratio >= 0.34:
                    return best_name[:64]
                return ""

            def _psa_is_parent_field_box(t: str) -> bool:
                return _psa_is_parent_field_line(t or "")

            def _psa_parent_section_index(u_norm: list[str]) -> int:
                """First line index where parent / informant blocks begin."""
                for i, nl in enumerate(u_norm):
                    if re.search(r"\b1\b", nl) and "NAME" in nl and "FATHER" not in nl and "MOTHER" not in nl:
                        if not _psa_is_parent_field_line(nl):
                            continue
                    if _psa_is_parent_field_line(nl):
                        return i
                    if re.search(r"\b[4-9]\b", nl) and "FATHER" in nl:
                        return i
                    if re.search(r"\b6\b", nl) and ("FATHER" in nl or "MAIDEN" in nl):
                        return i
                    if re.search(r"\b11\b", nl) and ("FATHER" in nl or "NAME" in nl):
                        return i
                    if any(
                        k in nl
                        for k in (
                            "NAME OF FATHER",
                            "FATHERS NAME",
                            "FATHER S NAME",
                            "NAME OF MOTHER",
                            "MAIDEN NAME OF MOTHER",
                            "INFORMANT",
                            "ATTENDANT",
                        )
                    ):
                        return i
                    if re.search(r"\bFATHER\b", nl) and "CHILD" not in nl:
                        return i
                    if re.search(r"\bMOTHER\b", nl) and "MAIDEN" in nl:
                        return i
                return len(u_norm)

            def _psa_parent_y_cut(normed: list[dict], image_h: int | None) -> float:
                """Earliest y where parent (father/mother) blocks begin — child names must be above this."""
                ih = float(image_h or _infer_image_size_from_boxes(normed)[1] or 1400)
                cuts = [ih * 0.22]
                for b in normed:
                    t = b["t"]
                    if "NAME OF CHILD" in t or re.match(r"^1\.?\s*NAME", t):
                        continue
                    if _psa_is_parent_field_box(t):
                        cuts.append(float(b["y"]) - 6.0)
                    if re.search(r"\b[4-9]\b", t) and "FATHER" in t:
                        cuts.append(float(b["y"]) - 6.0)
                    if re.search(r"\b6\b", t) and ("FATHER" in t or "MAIDEN" in t):
                        cuts.append(float(b["y"]) - 6.0)
                    if "NAME OF FATHER" in t or "FATHERS NAME" in t or "FATHER S NAME" in t:
                        cuts.append(float(b["y"]) - 6.0)
                    if "NAME OF MOTHER" in t or ("MAIDEN" in t and "MOTHER" in t):
                        cuts.append(float(b["y"]) - 6.0)
                    if re.search(r"\b11\b", t) and ("FATHER" in t or "MOTHER" in t or "NAME" in t):
                        cuts.append(float(b["y"]) - 8.0)
                    if re.search(r"\bFATHER\b", t) and "CHILD" not in t:
                        cuts.append(float(b["y"]) - 6.0)
                return max(ih * 0.08, min(cuts))

            def _psa_child_name_y_max(normed: list[dict], image_h: int | None) -> float:
                """Upper y-limit for field 1 (child name) — excludes father/mother blocks."""
                ih = float(image_h or _infer_image_size_from_boxes(normed)[1] or 1400)
                cuts = [ih * 0.22, _psa_parent_y_cut(normed, image_h)]
                for b in normed:
                    t = b["t"]
                    if re.search(r"\b2\b", t) and "SEX" in t:
                        cuts.append(float(b["y"]) - 5.0)
                    if "DATE OF BIRTH" in t or ("DATE" in t and re.search(r"\b3\b", t)):
                        cuts.append(float(b["y"]) - 5.0)
                    if "MAIDEN" in t and "NAME" in t:
                        cuts.append(float(b["y"]) - 5.0)
                return max(ih * 0.08, min(cuts))

            def _psa_name_from_parent_section(
                name: str,
                normed: list[dict],
                image_h: int | None,
                bb: dict | None = None,
            ) -> bool:
                """True when the name row is anchored in the parent section (not field 1 child)."""
                if not name or not normed:
                    return False
                y_max = _psa_hard_child_y_max(normed, image_h)
                if bb and all(k in bb for k in ("x", "y", "w", "h")):
                    y_c = float(bb["y"]) + float(bb["h"]) / 2.0
                    if y_c <= y_max:
                        return False
                tokens = [t for t in norm_simple(name).split() if len(t) >= 3]
                if len(tokens) < 2:
                    return False
                parent_only = 0
                for tok in tokens:
                    above = any(
                        tok in norm_simple(b["t"]) and float(b["y"]) <= y_max for b in normed
                    )
                    below = any(
                        tok in norm_simple(b["t"]) and float(b["y"]) > y_max for b in normed
                    )
                    if below and not above:
                        parent_only += 1
                return parent_only >= 2

            def _psa_child_block_end_index(u_norm: list[str]) -> int:
                """End of child block (before DOB row, mother section, or father)."""
                end = _psa_parent_section_index(u_norm)
                for i, nl in enumerate(u_norm):
                    if i >= end:
                        break
                    if _psa_is_parent_field_line(nl):
                        return i
                    if re.search(r"\b2\b", nl) and "SEX" in nl:
                        return i + 1
                    if "DATE OF BIRTH" in nl or "DATE OF BIRT" in nl:
                        return i
                    if re.search(r"\b3\b", nl) and "DATE" in nl:
                        return i
                    if "MAIDEN NAME" in nl:
                        return i
                    if re.search(r"\b6\b", nl) and "MAIDEN" in nl:
                        return i
                return end

            def _enumerate_psa_child_name_candidates(
                normed: list[dict],
                image_h: int | None,
                image_w: int | None,
            ) -> list[tuple[str, dict, float]]:
                """All plausible person-name rows in PSA field-1 zone (above father/mother)."""
                if not normed:
                    return []
                iw = image_w or _infer_image_size_from_boxes(normed)[0] or 1000
                ih = image_h or _infer_image_size_from_boxes(normed)[1] or 1400
                y_header = ih * 0.08
                y_child_max = _psa_hard_child_y_max(normed, image_h)
                x_child_max = iw * 0.62
                row_band = max(14.0, ih * 0.018)

                zone = [
                    b
                    for b in normed
                    if y_header <= b["y"] <= y_child_max
                    and b["x"] <= x_child_max
                    and _box_looks_like_person_name_part(b["t"])
                    and not _name_line_is_noise(b["t"])
                ]
                if not zone:
                    return []

                rows: dict[int, list[dict]] = {}
                for b in zone:
                    ry = int(round(float(b["y"]) / row_band))
                    rows.setdefault(ry, []).append(b)

                out: list[tuple[str, dict, float]] = []
                for row_boxes in rows.values():
                    row_boxes.sort(key=lambda b: b["x"])
                    parts = [_strip_name_field_labels(b["t"]) for b in row_boxes[:4]]
                    parts = [p for p in parts if p and _box_looks_like_person_name_part(p)]
                    if len(parts) < 2:
                        continue
                    full = " ".join(parts)
                    if not _candidate_name_is_plausible(full):
                        continue
                    y_center = sum(float(b["y"]) + float(b["h"]) / 2.0 for b in row_boxes[:4]) / min(
                        4, len(row_boxes)
                    )
                    out.append((full[:64], _union_bbox(row_boxes[:4]), y_center))
                out.sort(key=lambda item: item[2])
                return out

            def _pick_psa_child_name_for_expected(
                expected_name: str,
                normed: list[dict],
                image_h: int | None,
                image_w: int | None,
            ) -> tuple[str, dict | None]:
                """Prefer the child-zone row that best matches enrollment (not father/mother)."""
                if not expected_name:
                    return "", None
                exp_tokens = [t for t in norm_simple(expected_name).split(" ") if len(t) >= 2]
                if not exp_tokens:
                    return "", None

                candidates = _enumerate_psa_child_name_candidates(normed, image_h, image_w)
                structured, struct_bb = _detect_psa_child_name_from_boxes(normed, image_h, image_w)
                if structured and struct_bb:
                    y_c = float(struct_bb.get("y", 0)) + float(struct_bb.get("h", 0)) / 2.0
                    candidates.append((structured, struct_bb, y_c))

                best_name = ""
                best_bb: dict | None = None
                best_score = -1.0
                for name, bb, y_center in candidates:
                    if not _psa_y_center_in_child_zone(y_center, normed, image_h):
                        continue
                    if _psa_name_from_parent_section(name, normed, image_h):
                        continue
                    ok, ratio, missing, hits = _name_tokens_match(expected_name, name)
                    # Strongly prefer enrollment first+last; upper rows win ties (child is above father).
                    first_ok = exp_tokens[0] in norm_simple(name)
                    last_ok = exp_tokens[-1] in norm_simple(name)
                    if not first_ok:
                        continue
                    score = ratio + (0.35 if first_ok else 0.0) + (0.35 if last_ok else 0.0) - y_center / 100000.0
                    if not first_ok and last_ok and ratio < 0.67:
                        score -= 0.5
                    if score > best_score:
                        best_score = score
                        best_name = name
                        best_bb = bb

                if best_name and best_score >= 0.34 and exp_tokens[0] in norm_simple(best_name):
                    return best_name, best_bb
                return "", None

            def _detect_psa_child_name_from_boxes(
                normed: list[dict],
                image_h: int | None,
                image_w: int | None,
            ) -> tuple[str, dict | None]:
                """
                PSA Form 1A: read field 1 (child name) from FIRST / MIDDLE / LAST columns
                in the upper-left block — never header strips or parent sections.
                """
                if not normed:
                    return "", None
                iw = image_w or _infer_image_size_from_boxes(normed)[0] or 1000
                ih = image_h or _infer_image_size_from_boxes(normed)[1] or 1400
                y_header = ih * 0.08
                y_child_max = _psa_hard_child_y_max(normed, image_h)
                x_child_max = iw * 0.62

                zone = [
                    b
                    for b in normed
                    if y_header <= b["y"] <= y_child_max
                    and b["x"] <= x_child_max
                    and not _name_line_is_noise(b["t"])
                ]
                if not zone:
                    return "", None

                def _values_below_header(hdr: dict, *, col_slack: float) -> list[dict]:
                    hx = hdr["x"]
                    y_lo = hdr["y"] + hdr["h"] * 0.12
                    y_hi = min(hdr["y"] + hdr["h"] * 3.5, y_child_max)
                    vals = [
                        b
                        for b in zone
                        if y_lo <= b["y"] <= y_hi
                        and abs(b["x"] - hx) <= col_slack
                        and _box_looks_like_person_name_part(b["t"])
                    ]
                    vals.sort(key=lambda b: b["y"])
                    return vals

                first_hdrs = [b for b in zone if re.search(r"\bFIRST\b", b["t"])]
                middle_hdrs = [b for b in zone if re.search(r"\bMIDDLE\b", b["t"])]
                last_hdrs = [
                    b for b in zone if re.search(r"\bLAST\b", b["t"]) and "MAIDEN" not in b["t"]
                ]
                col_slack = max(iw * 0.14, 80.0)
                row_band = max(14.0, ih * 0.018)

                first_hdrs.sort(key=lambda b: (b["y"], b["x"]))
                for fh in first_hdrs:
                    fy = float(fh["y"])
                    mh = [b for b in middle_hdrs if abs(float(b["y"]) - fy) <= row_band]
                    lh = [b for b in last_hdrs if abs(float(b["y"]) - fy) <= row_band]
                    if not mh or not lh:
                        continue
                    mh_hdr = min(mh, key=lambda b: abs(float(b["y"]) - fy))
                    lh_hdr = min(lh, key=lambda b: abs(float(b["y"]) - fy))
                    name_parts: list[str] = []
                    picked: list[dict] = []
                    for hdr in (fh, mh_hdr, lh_hdr):
                        vals = _values_below_header(hdr, col_slack=col_slack)
                        if vals:
                            part = _strip_name_field_labels(vals[0]["t"])
                            if part:
                                name_parts.append(part)
                                picked.append(vals[0])
                    if len(name_parts) >= 2:
                        full = " ".join(name_parts)
                        if _candidate_name_is_plausible(full):
                            return full[:64], _union_bbox(picked)

                sex_rows = [
                    b
                    for b in normed
                    if re.search(r"\b2\b", b["t"]) and "SEX" in b["t"] and b["y"] <= y_child_max
                ]
                dob_rows = [
                    b
                    for b in normed
                    if ("DATE OF BIRTH" in b["t"] or "DATE OF BIRT" in b["t"])
                    and b["y"] <= y_child_max
                ]
                name_y_max = y_child_max
                if sex_rows:
                    name_y_max = min(name_y_max, min(float(b["y"]) for b in sex_rows) - 4)
                if dob_rows:
                    name_y_max = min(name_y_max, min(float(b["y"]) for b in dob_rows) - 4)

                name_anchor_y = y_header
                for b in zone:
                    bt = b["t"]
                    if ("NAME" in bt and re.search(r"\b1\b", bt)) or re.match(r"^1\.?\s*NAME", bt):
                        name_anchor_y = float(b["y"])
                        break

                name_boxes = [
                    b
                    for b in zone
                    if name_anchor_y - 8 <= b["y"] < name_y_max
                    and _box_looks_like_person_name_part(b["t"])
                    and not re.fullmatch(r"(FIRST|MIDDLE|LAST|NAME)", b["t"])
                ]
                name_boxes.sort(key=lambda b: (round(b["y"] / row_band), b["x"]))
                if name_boxes:
                    rows: list[list[dict]] = []
                    for b in name_boxes:
                        ry = round(b["y"] / row_band)
                        if not rows or round(rows[-1][0]["y"] / row_band) != ry:
                            rows.append([b])
                        else:
                            rows[-1].append(b)
                    if rows:
                        top_row = rows[0]
                        top_row.sort(key=lambda b: b["x"])
                        flat = top_row[:4]
                        full = " ".join(_strip_name_field_labels(b["t"]) for b in flat)
                        if _candidate_name_is_plausible(full):
                            return full[:64], _union_bbox(flat)

                return "", None

            def _sf9_learner_block_y(
                normed: list[dict],
                image_h: int | None,
            ) -> tuple[float, float]:
                ih = float(image_h or _infer_image_size_from_boxes(normed)[1] or 1400)
                header_rows = [
                    b
                    for b in normed
                    if any(k in b["t"] for k in ("REPORT CARD", "FORM 138", "SF9", "REPORT ON"))
                ]
                y_lo = max((b["y"] + b["h"] for b in header_rows), default=ih * 0.12) + 6.0
                stop_rows = [
                    b
                    for b in normed
                    if ("LEARNING" in b["t"] and "AREA" in b["t"])
                    or re.search(r"\bQUARTER\b", b["t"])
                    or "GENERAL AVERAGE" in b["t"]
                ]
                y_hi = min((b["y"] for b in stop_rows), default=ih * 0.34) - 8.0
                if y_hi <= y_lo:
                    y_hi = ih * 0.34
                return y_lo, y_hi

            def _detect_sf9_report_card_name_from_boxes(
                normed: list[dict],
                image_h: int | None,
                image_w: int | None,
            ) -> tuple[str, dict | None]:
                """SF9 report card: read NAME: value row — never the school title header."""
                if not normed:
                    return "", None
                ih = float(image_h or _infer_image_size_from_boxes(normed)[1] or 1400)
                iw = float(image_w or _infer_image_size_from_boxes(normed)[0] or 1000)
                y_lo, y_hi = _sf9_learner_block_y(normed, image_h)

                for b in normed:
                    if not (y_lo <= b["y"] <= y_hi):
                        continue
                    m = re.search(r"NAME\s*:?\s*(.+)$", b["t"], re.I)
                    if not m:
                        continue
                    val = _normalize_person_name_display(m.group(1))
                    if val and _candidate_name_is_plausible(val):
                        return val[:64], b

                name_labels = [
                    b
                    for b in normed
                    if y_lo <= b["y"] <= y_hi
                    and re.fullmatch(r"NAME\s*:?", norm_simple(b["t"]))
                ]
                name_labels.sort(key=lambda b: (b["y"], b["x"]))
                for lb in name_labels:
                    cy = lb["y"] + lb["h"] / 2.0
                    band = max(14.0, lb["h"] * 1.25)
                    candidates = [
                        b
                        for b in normed
                        if b is not lb
                        and y_lo <= b["y"] <= y_hi
                        and abs((b["y"] + b["h"] / 2.0) - cy) <= band
                        and b["x"] > lb["x"] + max(4.0, lb["w"] * 0.2)
                        and _box_looks_like_person_name_part(b["t"])
                    ]
                    if not candidates:
                        below = [
                            b
                            for b in normed
                            if b["y"] > lb["y"] + lb["h"] * 0.2
                            and b["y"] < lb["y"] + lb["h"] * 2.5
                            and abs(b["x"] - lb["x"]) < max(140.0, iw * 0.22)
                            and _box_looks_like_person_name_part(b["t"])
                        ]
                        candidates = below
                    if not candidates:
                        continue
                    candidates.sort(key=lambda b: (b["y"], b["x"]))
                    picked = candidates[:3]
                    full = _normalize_person_name_display(" ".join(b["t"] for b in picked))
                    if _candidate_name_is_plausible(full):
                        return full[:64], _union_bbox(picked)
                return "", None

            def _extract_sf9_name_from_lines(
                u_simple: list[str],
                u_norm: list[str] | None = None,
            ) -> str:
                for ln in u_simple or []:
                    ul = (ln or "").upper()
                    if "YEAR" in ul and "SECTION" in ul:
                        continue
                    m = re.search(r"NAME\s*:?\s*(.+)$", ln, re.I)
                    if not m:
                        continue
                    val = _normalize_person_name_display(m.group(1))
                    if val and _candidate_name_is_plausible(val):
                        return val[:64]
                return ""

            def _detect_academic_learner_name_from_boxes(
                normed: list[dict],
                image_h: int | None,
                image_w: int | None,
            ) -> tuple[str, dict | None]:
                """
                SF10 / Form 137: read learner name from FIRST / MIDDLE / LAST columns
                in the learner-information block — never DepEd header strips.
                """
                if any("REPORT CARD" in b["t"] for b in normed):
                    return "", None
                if not normed:
                    return "", None
                iw = image_w or _infer_image_size_from_boxes(normed)[0] or 1000
                ih = image_h or _infer_image_size_from_boxes(normed)[1] or 1400
                y_header = ih * 0.17
                y_max = ih * 0.48

                anchor_rows = [
                    b
                    for b in normed
                    if any(
                        k in b["t"]
                        for k in (
                            "LEARNER S INFORMATION",
                            "LEARNERS INFORMATION",
                            "LEARNER INFORMATION",
                            "NAME OF LEARNER",
                            "SF10",
                            "SF 10",
                            "FORM 137",
                            "FORM137",
                            "PERMANENT RECORD",
                            "REPORT CARD",
                            "SF9",
                        )
                    )
                ]
                if anchor_rows:
                    y_header = max(y_header, min(b["y"] for b in anchor_rows) - ih * 0.01)

                scholastic_rows = [
                    b
                    for b in normed
                    if "SCHOLASTIC" in b["t"] or "ELIGIBILITY" in b["t"] or "CERTIFICATION" in b["t"]
                ]
                if scholastic_rows:
                    y_max = min(y_max, min(b["y"] for b in scholastic_rows) - 10)

                zone = [
                    b
                    for b in normed
                    if y_header <= b["y"] <= y_max
                    and not _name_line_is_noise(b["t"])
                    and "DEPARTMENT" not in b["t"]
                    and "EDUCATION" not in b["t"]
                ]
                if not zone:
                    return "", None

                def _values_below_header(hdr: dict, *, col_slack: float) -> list[dict]:
                    hx = hdr["x"]
                    y_lo = hdr["y"] + hdr["h"] * 0.12
                    y_hi = hdr["y"] + hdr["h"] * 4.5
                    vals = [
                        b
                        for b in zone
                        if y_lo <= b["y"] <= y_hi
                        and abs(b["x"] - hx) <= col_slack
                        and _box_looks_like_person_name_part(b["t"])
                    ]
                    vals.sort(key=lambda b: b["y"])
                    return vals

                col_slack = max(iw * 0.13, 72.0)
                first_hdrs = [
                    b for b in zone if re.search(r"\bFIRST\b", b["t"]) and "NAME" in b["t"]
                ]
                middle_hdrs = [
                    b for b in zone if re.search(r"\bMIDDLE\b", b["t"]) and "NAME" in b["t"]
                ]
                last_hdrs = [
                    b
                    for b in zone
                    if re.search(r"\bLAST\b", b["t"])
                    and "NAME" in b["t"]
                    and "MAIDEN" not in b["t"]
                ]

                name_parts: list[str] = []
                picked: list[dict] = []
                for hdrs in (first_hdrs, middle_hdrs, last_hdrs):
                    if not hdrs:
                        continue
                    hdr = min(hdrs, key=lambda b: (b["y"], b["x"]))
                    vals = _values_below_header(hdr, col_slack=col_slack)
                    if vals:
                        part = _strip_name_field_labels(vals[0]["t"])
                        if part and part not in name_parts:
                            name_parts.append(part)
                            picked.append(vals[0])

                if len(name_parts) >= 2:
                    full = " ".join(name_parts)
                    if _candidate_name_is_plausible(full):
                        return full[:64], _union_bbox(picked)

                lrn_rows = [b for b in zone if re.search(r"\bLRN\b", b["t"])]
                birth_rows = [b for b in zone if "BIRTHDATE" in b["t"] or "BIRTH DATE" in b["t"]]
                stop_y = min(
                    [b["y"] for b in lrn_rows + birth_rows] or [y_max],
                    default=y_max,
                )

                row_band = max(16.0, ih * 0.022)
                name_boxes = [
                    b
                    for b in zone
                    if b["y"] < stop_y - 6
                    and _box_looks_like_person_name_part(b["t"])
                    and not re.fullmatch(r"(FIRST|MIDDLE|LAST|NAME|EXTN?\.?)", b["t"])
                ]
                name_boxes.sort(key=lambda b: (round(b["y"] / row_band), b["x"]))
                if name_boxes:
                    rows: list[list[dict]] = []
                    for b in name_boxes:
                        ry = round(b["y"] / row_band)
                        if not rows or round(rows[-1][0]["y"] / row_band) != ry:
                            rows.append([b])
                        else:
                            rows[-1].append(b)
                    value_row = None
                    for row in rows:
                        if len(row) >= 2:
                            value_row = row
                            break
                    if value_row is None and rows:
                        value_row = rows[0]
                    if value_row:
                        value_row.sort(key=lambda b: b["x"])
                        flat = value_row[:4]
                        full = " ".join(_strip_name_field_labels(b["t"]) for b in flat)
                        if _candidate_name_is_plausible(full):
                            return full[:64], _union_bbox(flat)

                return "", None

            def _strip_name_field_labels(text: str) -> str:
                s = norm_simple(text or "")
                for label in (
                    "NAME OF LEARNER",
                    "LEARNERS NAME",
                    "LEARNER S NAME",
                    "LEARNER NAME",
                    "NAME OF CHILD",
                    "CHILD S NAME",
                    "GENDER",
                    "GENFER",
                    "SEX",
                    "MALE",
                    "FEMALE",
                    "NAME",
                ):
                    s = re.sub(rf"\b{re.escape(label)}\b", " ", s)
                return re.sub(r"\s+", " ", s).strip()

            def _psa_child_section_lines(u_simple: list[str], u_norm: list[str]) -> list[str]:
                """Lines for the child block only — excludes father/mother/informant sections."""
                end_idx = _psa_parent_section_index(u_norm)
                skip_headers = (
                    "REPUBLIC",
                    "PHILIPPINE",
                    "STATISTICS",
                    "CERTIFICATE",
                    "LIVE BIRTH",
                    "REGISTRY",
                    "FORM NO",
                    "PSA",
                    "PAGE ",
                    "COPY",
                    "OCRG",
                    "QUADR",
                    "ACCOMPLISHED",
                )
                out: list[str] = []
                for sl, nl in zip(u_simple[:end_idx], u_norm[:end_idx]):
                    if any(h in nl for h in skip_headers):
                        continue
                    if _name_line_is_noise(sl):
                        continue
                    out.append(sl)
                return out

            def _extract_psa_child_name_from_lines(
                u_simple: list[str],
                u_norm: list[str],
                expected_name: str = "",
            ) -> str:
                """Parse PSA field 1 (FIRST / MIDDLE / LAST) from OCR lines — never father/mother."""
                end = _psa_child_block_end_index(u_norm)
                parts: dict[str, str] = {"first": "", "middle": "", "last": ""}
                active: str | None = None

                for i in range(min(end, len(u_norm))):
                    nl = u_norm[i]
                    sl = u_simple[i] if i < len(u_simple) else ""
                    if _psa_is_parent_field_line(nl):
                        break
                    if re.search(r"\b2\b", nl) and "SEX" in nl:
                        break
                    if "DATE OF BIRTH" in nl:
                        break
                    if re.search(r"\b11\b", nl) and "FATHER" in nl:
                        break
                    if re.search(r"\b[4-9]\b", nl) and "FATHER" in nl:
                        break
                    if "NAME OF FATHER" in nl or "FATHERS NAME" in nl:
                        break
                    if _name_line_is_noise(sl):
                        active = None
                        continue
                    if re.search(r"\bFIRST\b", nl):
                        active = "first"
                        rest = _strip_name_field_labels(re.sub(r".*?\bFIRST\b", "", nl).strip())
                        if _box_looks_like_person_name_part(rest):
                            parts["first"] = rest
                        continue
                    if re.search(r"\bMIDDLE\b", nl):
                        active = "middle"
                        rest = _strip_name_field_labels(re.sub(r".*?\bMIDDLE\b", "", nl).strip())
                        if _box_looks_like_person_name_part(rest):
                            parts["middle"] = rest
                        continue
                    if re.search(r"\bLAST\b", nl) and "MAIDEN" not in nl:
                        active = "last"
                        rest = _strip_name_field_labels(re.sub(r".*?\bLAST\b", "", nl).strip())
                        if _box_looks_like_person_name_part(rest):
                            parts["last"] = rest
                        continue
                    if active and not parts[active]:
                        clean = _strip_name_field_labels(sl)
                        if _box_looks_like_person_name_part(clean):
                            parts[active] = clean
                            active = None

                ordered = [parts[k] for k in ("first", "middle", "last") if parts[k]]
                if len(ordered) >= 2:
                    full = " ".join(ordered)
                    if _candidate_name_is_plausible(full):
                        return full[:64]

                early_names: list[str] = []
                for i in range(min(end, len(u_norm))):
                    nl = u_norm[i]
                    if _psa_is_parent_field_line(nl):
                        break
                    if re.search(r"\b2\b", nl) and "SEX" in nl:
                        break
                    if "DATE OF BIRTH" in nl:
                        break
                    clean = _strip_name_field_labels(u_simple[i] if i < len(u_simple) else "")
                    clean = _leading_name_words(clean) or clean
                    if not clean or not _box_looks_like_person_name_part(clean):
                        continue
                    if clean in early_names:
                        continue
                    early_names.append(clean)
                    if len(early_names) >= 3:
                        break
                if len(early_names) >= 2:
                    full = " ".join(early_names[:3])
                    if _candidate_name_is_plausible(full):
                        return full[:64]

                exp_tokens = [t for t in norm_simple(expected_name).split(" ") if len(t) >= 2]
                if exp_tokens:
                    best_ratio = -1.0
                    best_name = ""
                    for ln in _psa_child_section_lines(u_simple, u_norm):
                        clean = _leading_name_words(_strip_name_field_labels(ln)) or _strip_name_field_labels(ln)
                        if not _box_looks_like_person_name_part(clean):
                            continue
                        hits = [t for t in exp_tokens if t in clean]
                        ratio = len(hits) / max(1, len(exp_tokens))
                        if ratio > best_ratio:
                            best_ratio = ratio
                            best_name = clean
                    if best_name and best_ratio >= 0.34:
                        full = best_name
                        if _candidate_name_is_plausible(full):
                            return full[:64]

                return ""

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

            def _name_label_variants_for_doc(doc_kind: str) -> list[str]:
                if doc_kind in ("birth_certificate", "birthcert"):
                    return ["NAME OF CHILD", "CHILD S NAME", "1 NAME", "1. NAME"]
                if doc_kind in ("sf9", "report_card"):
                    return ["NAME"]
                if doc_kind in ("sf10", "form137", "form157"):
                    return [
                        "NAME OF LEARNER",
                        "LEARNERS NAME",
                        "LEARNER S NAME",
                        "LEARNER NAME",
                        "LAST NAME",
                        "FIRST NAME",
                        "MIDDLE NAME",
                    ]
                return ["NAME"]

            def _detect_name_from_boxes(
                normed: list[dict],
                *,
                doc_kind: str,
                image_h: int | None,
                image_w: int | None = None,
            ) -> tuple[str, dict | None]:
                """Read child/learner name from OCR boxes near the correct label (not parent rows)."""
                _academic = doc_kind in ("sf9", "report_card", "sf10", "form137", "form157")
                iw = image_w or _infer_image_size_from_boxes(normed)[0]
                if doc_kind in ("sf9", "report_card"):
                    sf9_name, sf9_bb = _detect_sf9_report_card_name_from_boxes(
                        normed, image_h=image_h, image_w=iw
                    )
                    if sf9_name:
                        return sf9_name, sf9_bb
                if _academic:
                    acad_name, acad_bb = _detect_academic_learner_name_from_boxes(
                        normed, image_h=image_h, image_w=iw
                    )
                    if acad_name:
                        return acad_name, acad_bb

                _birth = doc_kind in ("birth_certificate", "birthcert")
                if _birth:
                    iw = image_w or _infer_image_size_from_boxes(normed)[0]
                    psa_name, psa_bb = _detect_psa_child_name_from_boxes(normed, image_h, iw)
                    if psa_name:
                        return psa_name, psa_bb
                y_cut = None
                if image_h and image_h > 0:
                    if _birth:
                        y_cut = _psa_child_name_y_max(normed, image_h)
                    elif _academic:
                        y_cut = float(image_h) * 0.16
                label_variants = _name_label_variants_for_doc(doc_kind)
                exclude_in_label = (
                    "FATHER",
                    "MOTHER",
                    "INFORMANT",
                    "ATTENDANT",
                    "DEPARTMENT",
                    "EDUCATION",
                    "REPUBLIC",
                    "PERMANENT",
                )
                value_exclude = (
                    "GENDER",
                    "SEX",
                    "FEMALE",
                    "MALE",
                    "DATE",
                    "LRN",
                    "BIRTH",
                    "PLACE",
                    "FATHER",
                    "MOTHER",
                    "DEPARTMENT",
                    "EDUCATION",
                    "REPUBLIC",
                    "SCHOOL",
                    "DIVISION",
                    "REGION",
                    "RECORD",
                    "OFFICIAL",
                )

                def _label_ok(b: dict) -> bool:
                    t = b["t"]
                    if _psa_is_parent_field_box(t):
                        return False
                    if any(x in t for x in exclude_in_label):
                        return False
                    if y_cut is not None and b["y"] > y_cut:
                        return False
                    return any(v in t for v in label_variants)

                labels = [b for b in normed if _label_ok(b)]
                labels.sort(
                    key=lambda b: (
                        -max((len(v) for v in label_variants if v in b["t"]), default=0),
                        b["y"],
                        b["x"],
                    )
                )

                if not labels and _birth:
                    labels = [
                        b
                        for b in normed
                        if "NAME" in b["t"]
                        and not _psa_is_parent_field_box(b["t"])
                        and not any(x in b["t"] for x in exclude_in_label)
                        and (y_cut is None or b["y"] <= y_cut)
                    ]
                    labels.sort(key=lambda b: (b["y"], b["x"]))

                if _birth and labels:
                    field1 = [
                        b
                        for b in labels
                        if re.search(r"\b1\b", b["t"]) or re.match(r"^1\.?\s*NAME", b["t"])
                    ]
                    if field1:
                        labels = sorted(field1, key=lambda b: (b["y"], b["x"]))

                if not labels:
                    return "", None

                lb = labels[0]
                cy = lb["y"] + lb["h"] / 2.0
                band = max(14.0, lb["h"] * 1.1)
                candidates = [
                    b
                    for b in normed
                    if b is not lb
                    and not any(x in b["t"] for x in value_exclude)
                    and abs((b["y"] + b["h"] / 2.0) - cy) <= band
                    and b["x"] > lb["x"] + max(4.0, lb["w"] * 0.35)
                ]
                if not candidates:
                    candidates = [
                        b
                        for b in normed
                        if b is not lb
                        and not any(x in b["t"] for x in value_exclude)
                        and b["y"] > lb["y"] + lb["h"] * 0.3
                        and b["y"] < lb["y"] + lb["h"] * 2.8
                        and abs(b["x"] - lb["x"]) < max(120.0, lb["w"] * 3.0)
                    ]

                if not candidates:
                    combined = _strip_name_field_labels(lb["t"])
                    if combined:
                        return combined[:64], {
                            "x": lb["x"],
                            "y": lb["y"],
                            "w": lb["w"],
                            "h": lb["h"],
                        }
                    return "", None

                candidates.sort(key=lambda b: (b["y"], b["x"]))
                picked = candidates[:4]
                joined = _strip_name_field_labels(" ".join(b["t"] for b in picked))
                if not _candidate_name_is_plausible(joined):
                    return "", None
                x1 = min(b["x"] for b in picked)
                y1 = min(b["y"] for b in picked)
                x2 = max(b["x"] + b["w"] for b in picked)
                y2 = max(b["y"] + b["h"] for b in picked)
                bb = {"x": x1, "y": y1, "w": max(1.0, x2 - x1), "h": max(1.0, y2 - y1)}
                return joined[:64], bb

            def _name_tokens_match(expected_name: str, candidate: str) -> tuple[bool, float, list[str], list[str]]:
                exp_tokens = [t for t in norm_simple(expected_name).split(" ") if len(t) >= 2]
                if not exp_tokens:
                    return True, 1.0, [], []
                cand = norm_simple(candidate)
                if not cand:
                    return False, 0.0, exp_tokens[:6], []
                cand_tokens = [t for t in cand.split() if len(t) >= 2]
                hits = [t for t in exp_tokens if t in cand or t in cand_tokens]
                ratio = len(hits) / max(1, len(exp_tokens))
                missing = [t for t in exp_tokens if t not in hits]
                first_tok, last_tok = exp_tokens[0], exp_tokens[-1]
                ok = first_tok in cand and last_tok in cand and ratio >= 0.67
                return ok, float(ratio), missing[:6], hits

            def _name_tokens_match_certificate(expected_name: str, candidate: str) -> tuple[bool, float, list[str], list[str]]:
                """Good moral / certification: first + last name match; middle may differ."""
                exp_tokens = [t for t in norm_simple(expected_name).split(" ") if len(t) >= 2]
                if not exp_tokens:
                    return True, 1.0, [], []
                cand = norm_simple(candidate)
                if not cand:
                    return False, 0.0, exp_tokens[:6], []
                hits = [t for t in exp_tokens if t in cand]
                ratio = len(hits) / max(1, len(exp_tokens))
                missing = [t for t in exp_tokens if t not in hits]
                first_tok, last_tok = exp_tokens[0], exp_tokens[-1]
                core_ok = first_tok in cand and last_tok in cand
                if core_ok and ratio < 0.67:
                    ratio = max(ratio, round(2.0 / max(1, len(exp_tokens)), 2))
                return core_ok, float(ratio), missing[:6], hits

            def _extract_good_moral_certified_name(u_simple: list[str], u_norm: list[str] | None = None) -> str:
                """Pull student name from 'This is to certify that …' body text."""
                blob = " ".join(u_simple or [])
                patterns = [
                    r"THIS IS TO CERTIFY THAT\s+(.+?)(?:\s+OF\s+GRADE|\s*,\s*A\s+|\s+IS\s+A\s+)",
                    r"CERTIF(?:Y|IES)\s+THAT\s+(.+?)(?:\s+OF\s+GRADE|\s+IS\s+A\s+)",
                    r"HEREBY CERTIF(?:Y|IES)\s+THAT\s+(.+?)(?:\s+OF\s+GRADE|\s+IS\s+A\s+)",
                ]
                for pat in patterns:
                    m = re.search(pat, blob, re.I)
                    if not m:
                        continue
                    name = _strip_name_field_labels(m.group(1))
                    name = re.sub(r"\s+OF\s+GRADE.*$", "", name, flags=re.I).strip()
                    name = re.sub(r"\s+IS\s+A.*$", "", name, flags=re.I).strip()
                    name = re.sub(
                        r"\s*-\s*(HUMSS|STEM|ABM|ICT|EIM|GAS|TVL|BPP|FBS).*$",
                        "",
                        name,
                        flags=re.I,
                    ).strip()
                    if _candidate_name_is_plausible(name):
                        return name[:64]
                for ln in u_simple or []:
                    ul = (ln or "").upper()
                    if "CERTIFY" not in ul and "CERTIFIES" not in ul:
                        continue
                    m = re.search(r"CERTIF(?:Y|IES)\s+THAT\s+(.+)", ln, re.I)
                    if not m:
                        continue
                    tail = m.group(1)
                    name = re.split(
                        r"\s+OF\s+GRADE|\s+IS\s+A\s+|\s*,\s*A\s+",
                        tail,
                        maxsplit=1,
                        flags=re.I,
                    )[0]
                    name = _strip_name_field_labels(name).strip()
                    if _candidate_name_is_plausible(name):
                        return name[:64]
                return ""

            def _extract_good_moral_school_name(
                u_simple: list[str],
                expected_school: str = "",
            ) -> str:
                """Read issuing school from certificate header or 'pupil/graduate of …' body line."""
                import re

                blob = normalize(" ".join(u_simple or []))
                body_patterns = (
                    r"(?:PUPIL\s*/?\s*GRADUATE|GRADUATE|STUDENT)\s+OF\s+(.+?)(?:,\s*)?SCHOOL\s+YEAR",
                    r"IS\s+A\s+(?:PUPIL\s*/?\s*GRADUATE|GRADUATE|STUDENT)\s+OF\s+(.+?)(?:,\s*)?SCHOOL\s+YEAR",
                )
                for pat in body_patterns:
                    m = re.search(pat, blob, re.I)
                    if m:
                        school = re.sub(r"\s+", " ", m.group(1)).strip(" ,.-")
                        if len(school) >= 4:
                            return school[:64]

                skip_header = (
                    "REPUBLIC OF THE PHILIPPINES",
                    "DEPARTMENT OF EDUCATION",
                    "NATIONAL CAPITAL REGION",
                    "SCHOOLS DIVISION",
                    "DIVISION OF",
                    "CITY DISTRICT",
                    "DISTRICT OFFICE",
                    "KAGAWARAN",
                )
                institution_markers = (
                    "HIGH SCHOOL",
                    "JUNIOR HIGH",
                    "SENIOR HIGH",
                    "ELEMENTARY",
                    "ACADEMY",
                    "NATIONAL HIGH",
                    "INTEGRATED SCHOOL",
                )
                header_end = max(1, min(len(u_simple), len(u_simple) // 2 + 2))
                for ln in u_simple[:header_end]:
                    clean = re.sub(r"\s+", " ", (ln or "").strip())
                    if len(clean) < 5:
                        continue
                    nl = normalize(clean)
                    if any(k in nl for k in skip_header):
                        continue
                    if any(k in nl for k in institution_markers):
                        return clean[:64]
                    if re.search(r"\bSCHOOL\b", nl) and len(nl.split()) >= 2:
                        if any(k in nl for k in ("SCHOOL YEAR", "SCHOOL RULES", "VIOLATED SCHOOL")):
                            continue
                        return clean[:64]

                exp_tokens = [
                    t for t in norm_simple(expected_school).split(" ") if len(t) >= 4
                ]
                if exp_tokens:
                    best_ratio = -1.0
                    best_line = ""
                    for ln in u_simple or []:
                        nl = norm_simple(ln)
                        if not nl or any(k in nl for k in skip_header):
                            continue
                        hits = [t for t in exp_tokens if t in nl]
                        ratio = len(hits) / max(1, len(exp_tokens))
                        if ratio > best_ratio:
                            best_ratio = ratio
                            best_line = clean if (clean := re.sub(r"\s+", " ", (ln or "").strip())) else nl
                    if best_line and best_ratio >= 0.34:
                        return best_line[:64]
                return ""

            def _detect_good_moral_school_bbox(
                normed: list[dict],
                image_h: int | None,
                school_name: str,
            ) -> dict | None:
                if not normed or not school_name:
                    return None
                ih = float(image_h or _infer_image_size_from_boxes(normed)[1] or 1400)
                y_max = ih * 0.42
                tokens = [t for t in norm_simple(school_name).split(" ") if len(t) >= 4]
                if not tokens:
                    return None
                hits = [
                    b
                    for b in normed
                    if float(b["y"]) <= y_max and any(t in b["t"] for t in tokens)
                ]
                if not hits:
                    return None
                hits.sort(key=lambda b: (b["y"], b["x"]))
                return _union_bbox(hits[:6])

            def name_match(expected_name: str, u_full: str, u_lines: list[str]) -> tuple[bool, float, list[str]]:
                exp = norm_simple(expected_name)
                if not exp:
                    return True, 1.0, []
                exp_tokens = [t for t in exp.split(" ") if len(t) >= 2]
                if not exp_tokens:
                    return True, 1.0, []
                best_hits: list[str] = []
                best_ratio = -1.0
                for ln in u_lines or []:
                    if not ln or _name_line_is_noise(ln):
                        continue
                    clean = _strip_name_field_labels(ln)
                    if not clean:
                        continue
                    hits = [t for t in exp_tokens if t in clean]
                    ratio = len(hits) / max(1, len(exp_tokens))
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best_hits = hits
                if best_ratio < 0:
                    clean_full = _strip_name_field_labels(u_full)
                    best_hits = [t for t in exp_tokens if t in clean_full]
                    best_ratio = len(best_hits) / max(1, len(exp_tokens))
                missing = [t for t in exp_tokens if t not in best_hits]
                first_tok, last_tok = exp_tokens[0], exp_tokens[-1]
                ok = first_tok in _strip_name_field_labels(u_full) and last_tok in _strip_name_field_labels(u_full) and best_ratio >= 0.67
                return ok, float(best_ratio), missing[:6]

            def name_match_good_moral(
                expected_name: str,
                u_simple: list[str],
                u_norm: list[str],
                normed_boxes: list[dict],
            ) -> tuple[bool, float, list[str], str, dict | None]:
                detected = _extract_good_moral_certified_name(u_simple, u_norm)
                name_bbox = _value_area_for_label(normed_boxes, ["CERTIFY", "CERTIFIES", "THAT"])
                if detected:
                    ok, ratio, missing, _hits = _name_tokens_match_certificate(expected_name, detected)
                    return ok, ratio, missing, detected, name_bbox
                exp_tokens = [t for t in norm_simple(expected_name).split() if len(t) >= 2]
                best_ratio = -1.0
                best_name = ""
                for ln in u_simple or []:
                    if "CERTIFY" not in (ln or "").upper():
                        continue
                    clean = _extract_good_moral_certified_name([ln], [ln])
                    if not clean:
                        clean = _strip_name_field_labels(ln)
                    if not _candidate_name_is_plausible(clean):
                        continue
                    ok, ratio, missing, _hits = _name_tokens_match_certificate(expected_name, clean)
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best_name = clean
                    if ok:
                        return ok, ratio, missing, best_name[:64], name_bbox
                if best_name:
                    ok, ratio, missing, _hits = _name_tokens_match_certificate(expected_name, best_name)
                    return ok, ratio, missing, best_name[:64], name_bbox
                ok, ratio, missing = name_match(expected_name, " ".join(u_simple or []), u_simple)
                if ok:
                    return ok, ratio, missing, "", name_bbox
                return False, ratio, missing, "", name_bbox

            def name_match_birth_certificate(
                expected_name: str,
                u_simple: list[str],
                u_norm: list[str],
                normed_boxes: list[dict],
                image_h: int | None,
            ) -> tuple[bool, float, list[str], str, dict | None]:
                """
                PSA name check: child block + upper-page OCR boxes only.
                Ignores father/mother rows and field labels (GENDER, etc.).
                """
                iw = _infer_image_size_from_boxes(normed_boxes)[0]

                line_hit = _psa_child_name_from_text_line(expected_name, u_simple, u_norm)
                if line_hit and not _psa_reject_parent_name(
                    line_hit, expected_name, normed_boxes, image_h, None
                ):
                    ok, ratio, missing, _hits = _name_tokens_match(expected_name, line_hit)
                    return ok, ratio, missing, line_hit, None

                token_name, token_bb = _psa_child_name_from_enrollment_tokens(
                    expected_name, normed_boxes, image_h, iw
                )
                if token_name and not _psa_reject_parent_name(
                    token_name, expected_name, normed_boxes, image_h, token_bb
                ):
                    ok, ratio, missing, _hits = _name_tokens_match(expected_name, token_name)
                    return ok, ratio, missing, token_name, token_bb

                picked_name, picked_bb = _pick_psa_child_name_for_expected(
                    expected_name, normed_boxes, image_h, iw
                )
                if picked_name and _psa_reject_parent_name(
                    picked_name, expected_name, normed_boxes, image_h, picked_bb
                ):
                    picked_name, picked_bb = "", None
                if picked_name:
                    ok, ratio, missing, _hits = _name_tokens_match(expected_name, picked_name)
                    return ok, ratio, missing, picked_name, picked_bb

                box_name, box_bb = _detect_psa_child_name_from_boxes(normed_boxes, image_h, iw)
                if not box_name:
                    box_name, box_bb = _detect_name_from_boxes(
                        normed_boxes,
                        doc_kind="birth_certificate",
                        image_h=image_h,
                        image_w=iw,
                    )
                if box_name and _psa_name_from_parent_section(box_name, normed_boxes, image_h, box_bb):
                    box_name = ""
                    box_bb = None
                if box_name and _candidate_name_is_plausible(box_name):
                    ok, ratio, missing, _hits = _name_tokens_match(expected_name, box_name)
                    exp_tokens = [t for t in norm_simple(expected_name).split(" ") if len(t) >= 2]
                    if exp_tokens and exp_tokens[0] not in norm_simple(box_name):
                        box_name = ""
                        box_bb = None
                    else:
                        return ok, ratio, missing, box_name, box_bb

                line_name = _extract_psa_child_name_from_lines(u_simple, u_norm, expected_name)
                if line_name and _psa_name_from_parent_section(line_name, normed_boxes, image_h):
                    line_name = ""
                if line_name and _candidate_name_is_plausible(line_name):
                    exp_tokens = [t for t in norm_simple(expected_name).split(" ") if len(t) >= 2]
                    if exp_tokens and exp_tokens[0] not in norm_simple(line_name):
                        line_name = ""
                if line_name and _candidate_name_is_plausible(line_name):
                    ok, ratio, missing, _hits = _name_tokens_match(expected_name, line_name)
                    return ok, ratio, missing, line_name, box_bb

                exp_tokens = [t for t in norm_simple(expected_name).split(" ") if len(t) >= 2]
                if not exp_tokens:
                    return True, 1.0, [], "", None
                child_lines = []
                for ln in _psa_child_section_lines(u_simple, u_norm):
                    clean = _leading_name_words(_strip_name_field_labels(ln)) or _strip_name_field_labels(ln)
                    if clean and _box_looks_like_person_name_part(clean):
                        child_lines.append(clean)

                best_hits: list[str] = []
                best_ratio = 0.0
                best_parts: list[str] = []
                first_tok, last_tok = exp_tokens[0], exp_tokens[-1]
                for ln in child_lines:
                    if _looks_like_date_fragment(ln):
                        continue
                    if first_tok not in ln and last_tok not in ln:
                        continue
                    hits = [t for t in exp_tokens if t in ln]
                    ratio = len(hits) / max(1, len(exp_tokens))
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best_hits = hits
                        best_parts = [ln.strip()]
                    elif ratio == best_ratio and ratio > 0:
                        best_parts.append(ln.strip())

                detected_line = ""
                if best_parts and best_ratio > 0 and first_tok in best_parts[0]:
                    detected_line = " ".join(best_parts[:3])[:64]
                elif not detected_line:
                    detected_line = _extract_psa_child_name_from_lines(
                        u_simple, u_norm, expected_name
                    )
                if detected_line and _psa_name_from_parent_section(detected_line, normed_boxes, image_h, None):
                    detected_line = ""
                if detected_line and first_tok not in norm_simple(detected_line):
                    detected_line = ""
                missing = [t for t in exp_tokens if t not in best_hits]
                joined_child = " ".join(child_lines)
                first_ok = first_tok in joined_child
                last_ok = last_tok in joined_child
                ok = first_ok and last_ok and best_ratio >= 0.67
                if ok and not detected_line and best_parts:
                    detected_line = best_parts[0][:64]
                if detected_line and not _candidate_name_is_plausible(detected_line):
                    detected_line = ""
                return ok, float(best_ratio), missing[:6], detected_line, None

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
                for i, ln in enumerate(u_lines):
                    if "SCHOOL YEAR" not in ln and not re.search(r"\bSY\b", ln):
                        continue
                    chunk = ln
                    if i + 1 < len(u_lines):
                        chunk = f"{chunk} {u_lines[i + 1]}"
                    if a in chunk and b in chunk:
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
            run_grade_check = False
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

            def _box_matches_label(box_text: str, variant: str) -> bool:
                v = str(variant or "").strip().upper()
                t = str(box_text or "").upper()
                if not v or not t:
                    return False
                if len(v) <= 5:
                    return re.search(rf"\b{re.escape(v)}\b", t) is not None
                return v in t

            def _value_area_for_label(
                normed: list[dict],
                label_variants: list[str],
                *,
                max_neighbors: int = 4,
                y_min: float | None = None,
                y_max: float | None = None,
            ) -> dict | None:
                """Find the bounding area of the value(s) next to a label keyword."""
                labels = [
                    b
                    for b in normed
                    if any(_box_matches_label(b["t"], v) for v in label_variants)
                    and (y_min is None or b["y"] >= y_min)
                    and (y_max is None or b["y"] <= y_max)
                ]
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

            def _academic_learner_zone_y(
                normed: list[dict],
                image_h: int | None,
            ) -> tuple[float | None, float | None]:
                ih = float(image_h or _infer_image_size_from_boxes(normed)[1] or 1400)
                if any("REPORT CARD" in b["t"] for b in normed):
                    return _sf9_learner_block_y(normed, image_h)
                y_min = ih * 0.17
                y_max = ih * 0.48
                scholastic_rows = [
                    b for b in normed if "SCHOLASTIC" in b["t"] or "ELIGIBILITY" in b["t"]
                ]
                if scholastic_rows:
                    y_max = min(y_max, min(b["y"] for b in scholastic_rows) - 10)
                return y_min, y_max

            def _find_lrn_box(normed: list[dict], image_h: int | None = None) -> dict | None:
                """Use the LRN value area in the learner block; fallback to any 12-digit token there."""
                y_min, y_max = _academic_learner_zone_y(normed, image_h)
                bb = _value_area_for_label(
                    normed,
                    ["LRN", "IRN", "URN", "LEARNER REFERENCE", "REFERENCE NUMBER", "(LRN)"],
                    y_min=y_min,
                    y_max=y_max,
                )
                if bb:
                    return bb
                for b in normed:
                    if y_min is not None and b["y"] < y_min:
                        continue
                    if y_max is not None and b["y"] > y_max:
                        continue
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
                lrn_digits = re.sub(r"\D+", "", str(detected_lrn or ""))
                ok_lrn = len(lrn_digits) == 12 and exp_lrn == lrn_digits
                row = {"field": "LRN", "expected": exp_lrn, "detected": detected_lrn or "", "ok": ok_lrn}
                _attach_bbox(row, _find_lrn_box(normed_boxes, img_h))
                checks.append(row)
                if not ok_lrn:
                    issues.append("Mismatch: LRN in the document does not match the student's input.")
                    penalize(0.25)

            if run_name_check and exp_name:
                detected_name = ""
                name_bbox: dict | None = None
                if _birth_doc:
                    ok_name, ratio, missing, detected_name, name_bbox = name_match_birth_certificate(
                        exp_name, simple_lines, norm_lines, normed_boxes, img_h
                    )
                elif _academic_doc:
                    doc_kind = doc_type if doc_type in ("sf9", "report_card", "sf10", "form137", "form157") else "sf9"
                    box_name, name_bbox = _detect_name_from_boxes(
                        normed_boxes, doc_kind=doc_kind, image_h=img_h
                    )
                    if box_name:
                        ok_name, ratio, missing, _hits = _name_tokens_match(exp_name, box_name)
                        detected_name = _normalize_person_name_display(box_name)
                    else:
                        line_name = _extract_academic_name_from_labeled_text(norm_text)
                        if line_name:
                            ok_name, ratio, missing, _hits = _name_tokens_match(exp_name, line_name)
                            detected_name = _normalize_person_name_display(line_name)
                        elif doc_kind in ("sf9", "report_card"):
                            line_name = _extract_sf9_name_from_lines(simple_lines, norm_lines)
                            if line_name:
                                ok_name, ratio, missing, _hits = _name_tokens_match(exp_name, line_name)
                                detected_name = line_name
                        if not detected_name:
                            clean_lines = [
                                _strip_name_field_labels(ln)
                                for ln in simple_lines
                                if not _name_line_is_noise(ln) and _strip_name_field_labels(ln)
                            ]
                            ok_name, ratio, missing = name_match(exp_name, norm_text, clean_lines)
                            if not ok_name:
                                exp_tokens = [t for t in norm_simple(exp_name).split(" ") if len(t) >= 2]
                                best_line_ratio = -1.0
                                for ln in clean_lines:
                                    if not _candidate_name_is_plausible(ln):
                                        continue
                                    hits = [t for t in exp_tokens if t in ln]
                                    line_ratio = len(hits) / max(1, len(exp_tokens))
                                    if line_ratio > best_line_ratio:
                                        best_line_ratio = line_ratio
                                        detected_name = ln.strip()[:64]
                                if best_line_ratio <= 0:
                                    detected_name = ""
                            elif not detected_name:
                                exp_tokens = [t for t in norm_simple(exp_name).split(" ") if len(t) >= 2]
                                for ln in clean_lines:
                                    if not _candidate_name_is_plausible(ln):
                                        continue
                                    if exp_tokens and all(t in ln for t in [exp_tokens[0], exp_tokens[-1]]):
                                        detected_name = ln.strip()[:64]
                                        break
                elif _moral_doc:
                    ok_name, ratio, missing, detected_name, name_bbox = name_match_good_moral(
                        exp_name, simple_lines, norm_lines, normed_boxes
                    )
                else:
                    ok_name, ratio, missing = name_match(exp_name, norm_text, simple_lines)
                    if not ok_name:
                        exp_tokens = [t for t in norm_simple(exp_name).split(" ") if len(t) >= 2]
                        best_line_ratio = -1.0
                        for ln in simple_lines or []:
                            if not ln or _name_line_is_noise(ln):
                                continue
                            clean = _strip_name_field_labels(ln)
                            hits = [t for t in exp_tokens if t in clean]
                            line_ratio = len(hits) / max(1, len(exp_tokens))
                            if line_ratio > best_line_ratio:
                                best_line_ratio = line_ratio
                                detected_name = clean[:64]
                    elif not detected_name:
                        exp_tokens = [t for t in norm_simple(exp_name).split(" ") if len(t) >= 2]
                        for ln in simple_lines or []:
                            clean = _strip_name_field_labels(ln)
                            if exp_tokens and all(t in clean for t in [exp_tokens[0], exp_tokens[-1]]):
                                detected_name = clean[:64]
                                break
                if not _candidate_name_is_plausible(detected_name):
                    detected_name = ""
                if _birth_doc and detected_name and exp_name:
                    if _psa_reject_parent_name(
                        detected_name,
                        exp_name,
                        normed_boxes,
                        img_h,
                        name_bbox,
                    ):
                        detected_name = ""
                        ok_name = False
                        exp_toks = [t for t in norm_simple(exp_name).split(" ") if len(t) >= 2]
                        missing = [t for t in exp_toks if t not in norm_simple(detected_name)]
                row = {
                    "field": "Name",
                    "expected": exp_name,
                    "detected": detected_name,
                    "ok": ok_name,
                    "match_ratio": round(float(ratio), 2),
                    "missing_tokens": missing,
                }
                if name_bbox:
                    _attach_bbox(row, name_bbox)
                else:
                    doc_kind = doc_type if doc_type in ("sf9", "report_card", "sf10", "form137", "form157", "birth_certificate", "birthcert") else "other"
                    if doc_kind in ("birth_certificate", "birthcert"):
                        _attach_bbox(row, _detect_name_from_boxes(normed_boxes, doc_kind=doc_kind, image_h=img_h)[1])
                    elif doc_kind in ("sf9", "report_card", "sf10", "form137", "form157"):
                        _attach_bbox(row, _detect_name_from_boxes(normed_boxes, doc_kind=doc_kind, image_h=img_h)[1])
                    elif _moral_doc:
                        _attach_bbox(
                            row,
                            name_bbox
                            or _value_area_for_label(normed_boxes, ["CERTIFY", "CERTIFIES", "THAT"]),
                        )
                    else:
                        _attach_bbox(row, _value_area_for_label(normed_boxes, ["NAME"]))
                checks.append(row)
                if not ok_name:
                    if _moral_doc and detected_name:
                        issues.append(
                            "Mismatch: Student name on the certificate does not match enrollment (first/last name)."
                        )
                    elif _moral_doc:
                        issues.append("Mismatch: Student name not clearly found in the certificate text.")
                    else:
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
            detected_sy = ""
            if run_school_year_check:
                found_years = _extract_school_years_from_text(norm_text)
                if found_years:
                    detected_sy = found_years[0]
                    if exp_sy and exp_sy in found_years:
                        detected_sy = exp_sy
            if run_school_year_check and sy_ok is not None:
                row = {
                    "field": "School year",
                    "expected": exp_sy,
                    "detected": detected_sy,
                    "ok": bool(sy_ok),
                    "match_ratio": 1.0 if sy_ok else 0.0,
                }
                if _academic_doc:
                    y_min, y_max = _academic_learner_zone_y(normed_boxes, img_h)
                    _attach_bbox(
                        row,
                        _value_area_for_label(
                            normed_boxes,
                            ["SCHOOL YEAR", "SY"],
                            y_min=y_min,
                            y_max=y_max,
                        ),
                    )
                else:
                    _attach_bbox(row, _value_area_for_label(normed_boxes, ["SCHOOL YEAR", "SY"]))
                checks.append(row)
                if not sy_ok:
                    issues.append("Mismatch: School year not found or does not match the student's input.")
                    penalize(0.12)

            if run_prev_school_check and exp_prev_school:
                school_tokens = [t for t in norm_simple(exp_prev_school).split(" ") if len(t) >= 4]
                detected_school = ""
                if _moral_doc:
                    detected_school = _extract_good_moral_school_name(simple_lines, exp_prev_school)
                best_hits: list[str] = []
                best_ratio = -1.0
                best_line = detected_school
                if school_tokens:
                    for ln in simple_lines or []:
                        hits = [t for t in school_tokens if t in ln]
                        ratio = len(hits) / max(1, len(school_tokens))
                        if ratio > best_ratio:
                            best_ratio = ratio
                            best_hits = hits
                            if not detected_school and ratio >= 0.34:
                                best_line = ln.strip()[:64]
                    if best_ratio < 0:
                        best_hits = [t for t in school_tokens if t in norm_text]
                        best_ratio = len(best_hits) / max(1, len(school_tokens))
                    if detected_school:
                        det_hits = [t for t in school_tokens if t in norm_simple(detected_school)]
                        det_ratio = len(det_hits) / max(1, len(school_tokens))
                        if det_ratio >= best_ratio:
                            best_ratio = det_ratio
                            best_hits = det_hits
                            best_line = detected_school[:64]
                    ok = best_ratio >= 0.35
                    row = {
                        "field": "Previous school",
                        "expected": exp_prev_school,
                        "detected": best_line[:64] if best_line else "",
                        "ok": ok,
                        "match_ratio": round(float(best_ratio), 2),
                    }
                    if _moral_doc and best_line:
                        school_bb = _detect_good_moral_school_bbox(normed_boxes, img_h, best_line)
                        if school_bb:
                            _attach_bbox(row, school_bb)
                        else:
                            _attach_bbox(
                                row,
                                _value_area_for_label(
                                    normed_boxes,
                                    ["HIGH SCHOOL", "JUNIOR", "SENIOR", "ACADEMY", "SCHOOL"],
                                    y_max=(float(img_h) * 0.42) if img_h else None,
                                ),
                            )
                    else:
                        _attach_bbox(row, _value_area_for_label(normed_boxes, ["SCHOOL"]))
                    checks.append(row)
                    if not ok and doc_type in ("sf9", "sf10", "form137", "form157", "report_card"):
                        issues.append("Mismatch: Previous school name not clearly found in the document.")
                        penalize(0.08)
                    elif not ok and _moral_doc:
                        issues.append("Mismatch: Previous school name not clearly found on the certificate.")
                        penalize(0.06)
                    elif _moral_doc and detected_school:
                        for dc in doc_checks:
                            if dc.get("field") == "School name keyword" and not dc.get("ok"):
                                dc["ok"] = True

            def grade_match_linewise(expected_grade: str, u_lines: list[str]) -> tuple[bool | None, str]:
                g = re.sub(r"\D", "", (expected_grade or "").strip())
                if not g:
                    return None, ""
                year_section = [
                    ln for ln in u_lines if "YEAR" in ln and "SECTION" in ln
                ]
                for ln in year_section:
                    m = re.search(rf"YEAR\s*/?\s*SECTION.*?{g}\b", ln, re.I)
                    if m:
                        return True, m.group(0).strip()[:48]
                    if re.search(rf"\b{g}\s*-\s*\w", ln):
                        return True, ln.strip()[:48]
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
                    if _academic_doc:
                        y_min, y_max = _academic_learner_zone_y(normed_boxes, img_h)
                        _attach_bbox(
                            row,
                            _value_area_for_label(
                                normed_boxes,
                                ["GRADE", "GR"],
                                y_min=y_min,
                                y_max=y_max,
                            ),
                        )
                    else:
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

    if slot_mismatch_info:
        checks.insert(
            0,
            {
                "field": "Document type",
                "expected": slot_mismatch_info["expected"],
                "detected": slot_mismatch_info["detected"],
                "ok": False,
            },
        )
        doc_checks.insert(
            0,
            {
                "field": f"Upload slot requires {slot_mismatch_info['expected']}",
                "ok": False,
            },
        )

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
    payload["document_slot_mismatch"] = slot_mismatch_info is not None
    if slot_mismatch_info:
        payload["document_slot_expected"] = slot_mismatch_info["expected"]
        payload["document_slot_detected"] = slot_mismatch_info["detected"]
    payload["v"] = 23

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

    filepath = _staging_upload_path(file)
    file.save(filepath)

    try:
        quality = _image_quality_check(filepath, doc_type)
        quality_level = _level_pack(
            level=1,
            title="Image quality",
            passed=bool(quality.get("pass")),
            score=int(quality.get("score") or 0),
            summary=str(quality.get("message") or ""),
            issues=list(quality.get("issues") or []),
        )
        if not quality.get("pass"):
            sec = {
                "levels": [quality_level],
                "overall_pass": False,
                "highest_level_passed": 0,
            }
            return jsonify(
                {
                    "pass": False,
                    "level": 1,
                    "quality": quality,
                    "security_levels": sec,
                    "message": quality.get("message"),
                }
            )

        readability = _upload_document_readability_check(filepath, doc_type)
        readability_level = _level_pack(
            level=2,
            title="Document readability",
            passed=bool(readability.get("pass")),
            score=100 if readability.get("pass") else max(0, min(100, int((readability.get("word_count") or 0) * 4))),
            summary=str(readability.get("message") or ""),
            issues=list(readability.get("issues") or []),
        )
        sec = {
            "levels": [quality_level, readability_level],
            "overall_pass": bool(readability.get("pass")),
            "highest_level_passed": 2 if readability.get("pass") else 1,
        }
        if not readability.get("pass"):
            return jsonify(
                {
                    "pass": False,
                    "level": 2,
                    "quality": quality,
                    "readability": readability,
                    "security_levels": sec,
                    "message": readability.get("message"),
                }
            )

        return jsonify(
            {
                "pass": True,
                "level": 2,
                "quality": quality,
                "readability": readability,
                "security_levels": sec,
                "message": "Image quality and document readability OK.",
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

    if not _ocr_any_available():
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
    
    filepath = _staging_upload_path(file)
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

        text, avg_conf, boxes, ocr_meta = _ocr_read_document(filepath, doc_type)

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

        payload = _evaluate(
            text,
            avg_conf,
            doc_type,
            boxes=boxes,
            img_h=img_h,
            expected=expected,
            filepath=filepath,
            img_w=img_w,
        )
        payload["ocr_engine"] = ocr_meta.get("engine")
        payload["ocr_primary"] = ocr_meta.get("primary_engine")
        payload["ocr_fallback_used"] = bool(ocr_meta.get("fallback_used"))
        payload["ocr_passes"] = ocr_meta.get("passes") or []
        effective_doc_type = str(payload.get("resolved_doc_type") or doc_type).strip().lower()
        if img_w and img_h:
            payload["image_width"] = img_w
            payload["image_height"] = img_h

        is_photo_verify = effective_doc_type in PHOTO_DOC_TYPES
        tamper_score, tamper_signals = _tamper_check(filepath)
        payload["tamper_applicable"] = True
        payload["tamper_score"] = tamper_score
        payload["tamper_signals"] = tamper_signals

        # Synthetic / AI-generated suspicion signals (heuristics; NOT definitive).
        syn_score, syn_signals = _synthetic_check(filepath, ocr_confidence=avg_conf, word_count=word_count)
        payload["synthetic_applicable"] = True
        payload["synthetic_score"] = syn_score
        payload["synthetic_signals"] = syn_signals

        # If the document looks digitally generated, cap the headline integrity score.
        try:
            ss = float(syn_score)
        except Exception:
            ss = 1.0
        if ss < 0.92:
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

        if effective_doc_type in ("birth_certificate", "birthcert", "good_moral", "goodmoral"):
            _append_seal_logo_doc_check(
                payload, filepath, effective_doc_type, ocr_text=text or ""
            )
            if effective_doc_type in ("birth_certificate", "birthcert"):
                _upgrade_birth_cert_header_doc_checks(payload, text or "", boxes, img_h)
            _refresh_verify_confidence(
                payload,
                doc_type=effective_doc_type,
                ocr_confidence=avg_conf,
                word_count=word_count,
                detected_lrn=payload.get("detected_lrn"),
                is_photo=is_photo_verify,
            )

        # Integrity (Level 2/3) is separate from document-match confidence.
        # confidence / ai_score / weighted overall all use the document-match score only.
        payload["match_score"] = float(payload.get("confidence", 0.0))

        if tamper_score < 0.35:
            # High risk: force failure and add a visible issue.
            payload["status"] = "failed"
            payload["issues"] = (payload.get("issues") or []) + ["High tamper risk: possible image manipulation"]

        if is_photo_verify:
            quality = _image_quality_check(filepath, effective_doc_type)
            quality_enforced_at_upload = False
        else:
            quality_enforced_at_upload = True

        payload["quality"] = quality
        payload["security_levels"] = _build_security_levels(
            quality=quality,
            doc_type=effective_doc_type,
            payload=payload,
            tamper_score=tamper_score,
            tamper_cells=cells_all,
            tamper_fields=fields_all,
            quality_enforced_at_upload=quality_enforced_at_upload,
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
