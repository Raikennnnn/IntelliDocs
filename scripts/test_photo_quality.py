#!/usr/bin/env python3
"""Run on the droplet to debug 2x2 photo upload quality checks.

Usage:
  cd /var/www/intellidocs
  ai/.venv/bin/python scripts/test_photo_quality.py /path/to/photo.jpg
"""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "ai"))

import app as A  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: test_photo_quality.py <image-path>", file=sys.stderr)
        return 2
    path = sys.argv[1]
    if not os.path.isfile(path):
        print(f"File not found: {path}", file=sys.stderr)
        return 2

    q = A._image_quality_check(path, "photo_2x2")
    print(json.dumps(q, indent=2))
    return 0 if q.get("pass") else 1


if __name__ == "__main__":
    raise SystemExit(main())
