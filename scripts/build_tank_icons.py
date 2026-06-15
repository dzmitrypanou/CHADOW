#!/usr/bin/env python3
"""Build favicon and logo SVGs from OG tank crop."""
from __future__ import annotations

import base64
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "assets" / "icons"


def b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def composite_svg(header_b64: str, label: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="{label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A1022"/>
      <stop offset="100%" stop-color="#1A3C72"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#bg)"/>
  <image xlink:href="data:image/png;base64,{header_b64}" x="0" y="0" width="512" height="512" preserveAspectRatio="xMidYMid slice"/>
</svg>
"""


def mark_svg(tank_b64: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 461 573" role="img" aria-label="Chadow tank">
  <image xlink:href="data:image/png;base64,{tank_b64}" width="461" height="573"/>
</svg>
"""


def main() -> None:
    tank_png = ICONS / "tank-mark.png"
    header_png = ICONS / "logo-header.png"
    if not tank_png.is_file() or not header_png.is_file():
        raise SystemExit("Run crop step first: tank-mark.png and logo-header.png required")

    header_b64 = b64(header_png)
    tank_b64 = b64(tank_png)
    composite = composite_svg(header_b64, "Chadow")

    (ROOT / "favicon.svg").write_text(composite, encoding="utf-8")
    (ICONS / "logo-header.svg").write_text(composite_svg(header_b64, "Chadow logo"), encoding="utf-8")
    (ICONS / "apple-touch-icon.svg").write_text(composite, encoding="utf-8")
    (ICONS / "icon.svg").write_text(composite, encoding="utf-8")
    (ICONS / "tank-mark.svg").write_text(mark_svg(tank_b64), encoding="utf-8")
    print("Icons written to", ICONS)


if __name__ == "__main__":
    main()
