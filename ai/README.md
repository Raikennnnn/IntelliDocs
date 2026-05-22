## IntelliDocs AI Verification (Simple OCR)

This folder contains a small Flask service that performs OCR on an uploaded document image and returns:
- `status`: `verified` | `failed`
- `confidence`: average OCR confidence (0.0–1.0)
- `extracted_text`: first part of extracted text

### Run (Windows)

From `C:\xampp\htdocs\IntelliDocs\ai`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

It runs at `http://127.0.0.1:5000`.

### Endpoints

- `GET /health`
- `POST /verify` (multipart form-data)
  - `image`: file
  - `doc_type`: string (e.g. `form137`, `good_moral`, `birth_certificate`)

