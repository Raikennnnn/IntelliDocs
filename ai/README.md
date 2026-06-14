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


### Run on the droplet (Ubuntu/Debian Linux)

The frontend no longer calls the Python service directly. The browser uploads to
PHP (`/api/ai/verify-upload` or `/api/ai/verify-document`), and PHP forwards the
request to this service over `127.0.0.1`. So the service only needs to listen on
localhost on the droplet — keep it off the public internet.

1) Install the OCR engine (required — without it every verify returns HTTP 503):

```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr python3-venv python3-pip
```

2) Install Python deps:

```bash
cd /var/www/IntelliDocs/ai      # adjust to your deploy path
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
```

3) Verify OCR is detected:

```bash
python3 -c "import pytesseract, shutil; print(shutil.which('tesseract'))"
```

4) Run it as a managed service so it stays up. Create
`/etc/systemd/system/intellidocs-ai.service`:

```ini
[Unit]
Description=IntelliDocs AI OCR service
After=network.target

[Service]
WorkingDirectory=/var/www/IntelliDocs/ai
Environment=AI_HOST=127.0.0.1
Environment=AI_PORT=5000
ExecStart=/var/www/IntelliDocs/ai/.venv/bin/gunicorn -w 2 -b 127.0.0.1:5000 app:app
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now intellidocs-ai
curl http://127.0.0.1:5000/health    # should show "ocr_engine":"tesseract"
```

If PHP and Python run on different hosts/ports, set `AI_BASE_URL` in the project
`env` file (read by `api/env_loader.php`), e.g. `AI_BASE_URL=http://127.0.0.1:5000`.

> Tip: `app.run(... debug=False)` by default now. You can run it directly with
> `AI_PORT=5000 python3 app.py` for quick testing, but use gunicorn+systemd for
> production so it restarts on reboot/crash.
