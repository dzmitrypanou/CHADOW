#!/usr/bin/env python3
"""Подготовка дампа u2668592_abs.sql для импорта в chadow."""
from __future__ import annotations

import re
import sys
from pathlib import Path


def prepare_dump(text: str) -> str:
    for table in ("ad_images", "ads"):
        text = re.sub(
            rf"-- Table structure for table `{table}`.*?(?=-- Table structure for table `)",
            "",
            text,
            flags=re.DOTALL,
        )

    text = re.sub(
        r",?\s*CONSTRAINT `[^`]+` FOREIGN KEY \([^)]+\) REFERENCES `[^`]+` \([^)]+\)"
        r"(?: ON DELETE (?:CASCADE|RESTRICT|SET NULL))?",
        "",
        text,
    )
    text = re.sub(r",\s*\n\s*\)", "\n)", text)
    return text


def main() -> int:
    root = Path(__file__).resolve().parent
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else root.parent.parent / "Downloads" / "u2668592_abs.sql"
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "chadow_import.sql"

    if not src.is_file():
        print(f"Файл не найден: {src}", file=sys.stderr)
        return 1

    prepared = prepare_dump(src.read_text(encoding="utf-8"))
    dst.write_text(prepared, encoding="utf-8")
    print(f"OK: {dst} ({dst.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
