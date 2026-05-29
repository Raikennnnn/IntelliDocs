from flask import Flask, request, jsonify, make_response
import os
import shutil
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
    return None


try:
    import easyocr  # noqa: F401

    _easyocr_reader = easyocr.Reader(["en"])
    _ocr_engine = "easyocr"
except Exception:
    _easyocr_reader = None

if _easyocr_reader is None:
    try:
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401

        _tesseract_exe = _resolve_tesseract_exe()
        if _tesseract_exe:
            import pytesseract as _pt

            _pt.pytesseract.tesseract_cmd = _tesseract_exe
            _ocr_engine = "tesseract"
        else:
            _ocr_engine = "none"
    except Exception:
        _ocr_engine = "none"

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
            "Install Tesseract OCR for Windows (UB Mannheim build), or set TESSERACT_CMD to the full path of tesseract.exe. "
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


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


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

    high = sum(1 for x in merged if str(x.get("risk")) == "high")
    warn = sum(1 for x in merged if str(x.get("risk")) == "warning")
    if high == 0 and warn == 0:
        return s, []

    # Penalize: high-risk regions are strong evidence of inconsistent compression / edits.
    penalty = min(0.72, high * 0.20 + warn * 0.09)
    s = _clamp01(s - penalty)
    return s, []


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
        """Prefer header-region LRN values from OCR boxes (reduces false positives)."""
        if not _boxes or not _img_h:
            return None
        try:
            import re

            top_y2 = int(_img_h * 0.33)
            # Collect candidate tokens near top third
            for b in _boxes:
                t = str(b.get("text", "") or "").strip()
                if not t:
                    continue
                try:
                    y = int(b.get("y", 999999))
                except Exception:
                    y = 999999
                if y > top_y2:
                    continue
                m = re.search(r"\b([0-9]{12})\b", t)
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
                to_whom = has_any(["TO WHOM IT MAY CONCERN"])
                cert_kw = has_any(["CERTIFICATION", "CERTIFICATE"])
                name_kw = has_any(["NAME"])
                school_kw = has_any(["SCHOOL", "ACADEMY", "HIGH SCHOOL", "SENIOR HIGH"])
                date_kw = has_any(["DATE", "ISSUED", "THIS", "DAY OF"]) or has_date_like()
                principal_kw = has_any(["PRINCIPAL", "REGISTRAR", "HEAD", "SIGNED"])

                doc_checks = [
                    {"field": "Good moral / moral character keyword", "ok": bool(moral_kw)},
                    {"field": "\"To Whom It May Concern\" phrase", "ok": bool(to_whom)},
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
        goodmoral_keywords = ["GOOD MORAL", "GOOD MORAL CHARACTER", "MORAL CHARACTER", "CERTIFICATION", "TO WHOM IT MAY CONCERN"]
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
    if expected and (not is_photo) and doc_type not in ("birth_certificate", "birthcert"):
        try:
            import re

            def norm_simple(s: str) -> str:
                ss = normalize(s or "")
                ss = re.sub(r"[^A-Z0-9 ]+", " ", ss)
                ss = re.sub(r"\s+", " ", ss).strip()
                return ss

            def name_match(expected_name: str, u: str) -> tuple[bool, float, list[str]]:
                exp = norm_simple(expected_name)
                if not exp:
                    return True, 1.0, []
                # Token-based containment (robust to middle name/initial differences)
                exp_tokens = [t for t in exp.split(" ") if len(t) >= 2]
                if not exp_tokens:
                    return True, 1.0, []
                hits = [t for t in exp_tokens if t in u]
                ratio = len(hits) / max(1, len(exp_tokens))
                missing = [t for t in exp_tokens if t not in hits]
                ok = ratio >= 0.6
                return ok, ratio, missing[:6]

            def sex_match(expected_sex: str, u: str) -> bool | None:
                es = (expected_sex or "").strip().upper()
                if not es:
                    return None
                if es.startswith("M"):
                    return ("MALE" in u) or bool(re.search(r"\bM\b", u))
                if es.startswith("F"):
                    return ("FEMALE" in u) or bool(re.search(r"\bF\b", u))
                return None

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

            exp_name = str(expected.get("name") or "").strip()
            exp_lrn = re.sub(r"\D+", "", str(expected.get("lrn") or ""))
            exp_sex = str(expected.get("sex") or "").strip()
            exp_sy = str(expected.get("school_year") or "").strip()
            exp_prev_school = str(expected.get("prev_school") or "").strip()

            if exp_lrn:
                ok_lrn = bool(detected_lrn) and exp_lrn == str(detected_lrn)
                checks.append({"field": "LRN", "expected": exp_lrn, "detected": detected_lrn or "", "ok": ok_lrn})
                if not ok_lrn:
                    issues.append("Mismatch: LRN in the document does not match the student's input.")
                    penalize(0.25)

            if exp_name:
                ok_name, ratio, missing = name_match(exp_name, norm_text)
                checks.append(
                    {
                        "field": "Name",
                        "expected": exp_name,
                        "detected": "",
                        "ok": ok_name,
                        "match_ratio": round(float(ratio), 2),
                        "missing_tokens": missing,
                    }
                )
                if not ok_name:
                    issues.append("Mismatch: Student name not clearly found in the document text.")
                    penalize(0.18)

            sm = sex_match(exp_sex, norm_text)
            if sm is not None:
                checks.append({"field": "Sex", "expected": exp_sex, "detected": "", "ok": bool(sm)})
                if not sm:
                    issues.append("Mismatch: Sex/Gender in the document does not match the student's input.")
                    penalize(0.12)

            sy_ok = school_year_match(exp_sy, norm_text)
            if sy_ok is not None:
                checks.append({"field": "School year", "expected": exp_sy, "detected": "", "ok": bool(sy_ok)})
                if not sy_ok:
                    issues.append("Mismatch: School year not found or does not match the student's input.")
                    penalize(0.12)

            if exp_prev_school:
                # Soft check: look for at least one significant token from the school name.
                school_tokens = [t for t in norm_simple(exp_prev_school).split(" ") if len(t) >= 4]
                if school_tokens:
                    hits = [t for t in school_tokens if t in norm_text]
                    ratio = len(hits) / max(1, len(school_tokens))
                    ok = ratio >= 0.35
                    checks.append(
                        {
                            "field": "Previous school",
                            "expected": exp_prev_school,
                            "detected": "",
                            "ok": ok,
                            "match_ratio": round(float(ratio), 2),
                        }
                    )
                    if not ok and doc_type in ("sf9", "sf10", "form137", "form157", "report_card"):
                        issues.append("Mismatch: Previous school name not clearly found in the document.")
                        penalize(0.08)
        except Exception:
            pass

    if checks:
        payload["field_checks"] = checks

    if doc_checks:
        payload["doc_checks"] = doc_checks

    return payload


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
        }
        if not any(v for v in expected.values()):
            expected = None

        payload = _evaluate(text, avg_conf, doc_type, boxes=boxes, img_h=img_h, expected=expected)
        if img_w and img_h:
            payload["image_width"] = img_w
            payload["image_height"] = img_h

        # Photo-only requirements (2x2, ID photo) do not need tamper analysis.
        if doc_type in {"photo_2x2", "2x2", "id_photo", "photo"}:
            tamper_score, tamper_signals = 1.0, []
            payload["tamper_applicable"] = False
        else:
            tamper_score, tamper_signals = _tamper_check(filepath)
            payload["tamper_applicable"] = True
        payload["tamper_score"] = tamper_score
        payload["tamper_signals"] = tamper_signals

        # Synthetic / AI-generated suspicion signals (heuristics; NOT definitive).
        if doc_type in {"photo_2x2", "2x2", "id_photo", "photo"}:
            payload["synthetic_applicable"] = False
            payload["synthetic_score"] = 1.0
            payload["synthetic_signals"] = []
        else:
            syn_score, syn_signals = _synthetic_check(filepath, ocr_confidence=avg_conf, word_count=word_count)
            payload["synthetic_applicable"] = True
            payload["synthetic_score"] = syn_score
            payload["synthetic_signals"] = syn_signals

        # SF9/report card: add cell-level tamper hints (JPEG ELA + numeric boxes).
        if doc_type in ("sf9", "report_card"):
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
        if doc_type in ("sf10", "form137", "form157"):
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

        if doc_type in ("birth_certificate", "birthcert"):
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

        if doc_type in ("good_moral", "goodmoral"):
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

        # Apply tamper score as a cap/penalty so a clear-but-edited image doesn't look "high confidence".
        try:
            base_conf = float(payload.get("confidence", 0.0))
        except Exception:
            base_conf = 0.0
        capped = min(_clamp01(base_conf), _clamp01(0.40 + 0.60 * tamper_score))
        payload["confidence"] = capped

        if tamper_score < 0.35:
            # High risk: force failure and add a visible issue.
            payload["status"] = "failed"
            payload["issues"] = (payload.get("issues") or []) + ["High tamper risk: possible image manipulation"]

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
