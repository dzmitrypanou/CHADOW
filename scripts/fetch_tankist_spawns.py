#!/usr/bin/env python3
"""Fetch map spawn coordinates from tankist.net/maps into config/tactics_tankist_spawns.json."""
from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "config" / "tactics_tankist_spawns.json"
BASE_URL = "https://tankist.net"
USER_AGENT = "chadow-tactics-sync/1.0 (+https://chadow.ru)"

sys.path.insert(0, str(ROOT / "scripts"))
from tankist_markers import TANKIST_MODE_TO_TACTICS, arena_to_code  # noqa: E402


def fetch(url: str, timeout: int = 45) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_attr_block(block: str, name: str) -> str:
    pattern = rf'{name}="([^"]*)"'
    match = re.search(pattern, block, flags=re.I)
    return html.unescape(match.group(1)) if match else ""


def parse_map_slugs(list_html: str) -> list[str]:
    slugs = []
    seen = set()
    for match in re.finditer(r'href="/maps/([^"?#]+)"', list_html):
        slug = match.group(1).strip().lower()
        if not slug or slug in seen:
            continue
        seen.add(slug)
        slugs.append(slug)
    return slugs


def parse_map_page(page_html: str, arena: str) -> dict | None:
    card_match = re.search(
        r'<section[^>]*class="[^"]*js-wot-map-card[^"]*"([^>]*)>',
        page_html,
        flags=re.I | re.S,
    )
    if not card_match:
        return None

    card_attrs = card_match.group(1)
    entry = {
        "arena": arena,
        "code": arena_to_code(arena),
        "name_ru": parse_attr_block(card_attrs, "data-map-name"),
        "version": parse_attr_block(card_attrs, "data-map-version"),
        "bounds": {
            "min_x": float(parse_attr_block(card_attrs, "data-bounds-min-x") or 0),
            "min_y": float(parse_attr_block(card_attrs, "data-bounds-min-y") or 0),
            "max_x": float(parse_attr_block(card_attrs, "data-bounds-max-x") or 0),
            "max_y": float(parse_attr_block(card_attrs, "data-bounds-max-y") or 0),
        },
        "modes": {},
    }

    for input_match in re.finditer(
        r'<input[^>]*class="[^"]*js-map-mode-input[^"]*"([^>]*)/>',
        page_html,
        flags=re.I | re.S,
    ):
        attrs = input_match.group(1)
        tankist_mode = parse_attr_block(attrs, "value").strip().lower()
        tactics_mode = TANKIST_MODE_TO_TACTICS.get(tankist_mode)
        if not tactics_mode:
            continue
        raw_coords = parse_attr_block(attrs, "data-coordinates")
        if not raw_coords:
            continue
        try:
            points = json.loads(raw_coords)
        except json.JSONDecodeError:
            continue
        if not isinstance(points, list):
            continue
        entry["modes"][tactics_mode] = {
            "tankist_mode": tankist_mode,
            "label_ru": parse_attr_block(attrs, "data-mode-label"),
            "minimap_rel": parse_attr_block(attrs, "data-minimap-rel"),
            "points": points,
        }

    if not entry["modes"]:
        return None
    return entry


def main() -> None:
    print("Fetching map list…")
    list_html = fetch(f"{BASE_URL}/maps")
    slugs = parse_map_slugs(list_html)
    print(f"Found {len(slugs)} map pages")

    maps: dict[str, dict] = {}
    errors: list[str] = []

    for index, slug in enumerate(slugs, start=1):
        url = f"{BASE_URL}/maps/{slug}"
        try:
            page_html = fetch(url)
            parsed = parse_map_page(page_html, slug)
            if not parsed:
                errors.append(f"{slug}: no tactical modes")
                continue
            code = parsed["code"]
            if code in maps:
                existing = maps[code]
                existing_modes = set(existing.get("modes", {}))
                new_modes = set(parsed.get("modes", {}))
                if new_modes.issubset(existing_modes):
                    continue
            maps[code] = parsed
            print(f"[{index}/{len(slugs)}] {slug} -> {code} ({', '.join(parsed['modes'])})")
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            errors.append(f"{slug}: {exc}")
        time.sleep(0.15)

    payload = {
        "source": BASE_URL,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "maps": maps,
        "errors": errors,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_PATH} ({len(maps)} maps, {len(errors)} skipped/errors)")


if __name__ == "__main__":
    main()
