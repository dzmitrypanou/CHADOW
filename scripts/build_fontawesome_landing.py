#!/usr/bin/env python3
"""Build a minimal Font Awesome bundle for the landing page."""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FA_CSS = ROOT / "css" / "vendor" / "fontawesome.min.css"
SOLID_SRC = ROOT / "css" / "vendor" / "webfonts" / "fa-solid-900.ttf"
BRANDS_SRC = ROOT / "css" / "vendor" / "webfonts" / "fa-brands-400.ttf"
OUT_CSS = ROOT / "css" / "vendor" / "fontawesome-landing.min.css"
SOLID_OUT = ROOT / "css" / "vendor" / "webfonts" / "fa-solid-landing.woff2"
BRANDS_OUT = ROOT / "css" / "vendor" / "webfonts" / "fa-brands-landing.woff2"

SOLID_ICONS = [
    "map",
    "arrow-right",
    "chart-bar",
    "users",
    "sitemap",
    "crosshairs",
    "rocket",
    "user",
    "sign-in-alt",
    "sign-out-alt",
    "university",
]
BRAND_ICONS = ["twitch", "vk"]


def extract_codepoint(css: str, icon: str) -> str:
    match = re.search(
        rf"\.fa-{re.escape(icon)}:before\{{content:\"\\([^\"]+)\"",
        css,
    )
    if not match:
        raise SystemExit(f"Missing icon rule: fa-{icon}")
    return match.group(1)


def subset_font(src: Path, dest: Path, codepoints: list[str]) -> None:
    unicodes = ",".join(f"U+{cp.upper()}" for cp in codepoints)
    subprocess.run(
        [
            "pyftsubset",
            str(src),
            f"--output-file={dest}",
            f"--unicodes={unicodes}",
            "--flavor=woff2",
            "--layout-features=*",
        ],
        check=True,
    )


def main() -> None:
    css = FA_CSS.read_text(encoding="utf-8")
    solid_cps = [extract_codepoint(css, icon) for icon in SOLID_ICONS]
    brand_cps = [extract_codepoint(css, icon) for icon in BRAND_ICONS]

    subset_font(SOLID_SRC, SOLID_OUT, solid_cps)
    subset_font(BRANDS_SRC, BRANDS_OUT, brand_cps)

    icon_rules = []
    for icon in SOLID_ICONS:
        cp = extract_codepoint(css, icon)
        icon_rules.append(f'.fa-{icon}:before{{content:"\\{cp}"}}')
    for icon in BRAND_ICONS:
        cp = extract_codepoint(css, icon)
        icon_rules.append(f'.fa-{icon}:before{{content:"\\{cp}"}}')

    landing_css = (
        '@font-face{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:900;'
        'font-display:swap;src:url(/css/vendor/webfonts/fa-solid-landing.woff2) format("woff2")}'
        '@font-face{font-family:"Font Awesome 6 Brands";font-style:normal;font-weight:400;'
        'font-display:swap;src:url(/css/vendor/webfonts/fa-brands-landing.woff2) format("woff2")}'
        '.fa,.fas,.far,.fab,.fal,.fad{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;'
        'display:var(--fa-display,inline-block);font-style:normal;font-variant:normal;line-height:1;text-rendering:auto}'
        '.fas,.fa-solid{font-family:"Font Awesome 6 Free";font-weight:900}'
        '.fab,.fa-brands{font-family:"Font Awesome 6 Brands";font-weight:400}'
        + "".join(icon_rules)
    )
    OUT_CSS.write_text(landing_css, encoding="utf-8")
    print(f"Wrote {OUT_CSS} ({OUT_CSS.stat().st_size} bytes)")
    print(f"Wrote {SOLID_OUT} ({SOLID_OUT.stat().st_size} bytes)")
    print(f"Wrote {BRANDS_OUT} ({BRANDS_OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
