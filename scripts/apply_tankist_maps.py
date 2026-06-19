#!/usr/bin/env python3
"""Download minimaps from tankist.net for Mir Tankov (lesta) tactics assets only.

tankist.net mirrors the Lesta/Mir Tankov client — never write those images into wot/.
WoT maps must come from scripts/extract_lesta_maps.py --game wot (World_of_Tanks_EU client).
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPAWNS_PATH = ROOT / "config" / "tactics_tankist_spawns.json"
METADATA_PATH = ROOT / "scripts" / "lesta_maps_metadata.json"
ASSETS_ROOT = ROOT / "assets" / "tactics" / "maps"
ASSETS_DIR = ROOT / "scripts" / "_wot_extract" / "assets"
MAP_IMAGE_SIZE = 512

sys.path.insert(0, str(ROOT / "scripts"))
from tankist_markers import (  # noqa: E402
    MAP_IMAGE_SIZE,
    marker_sizes,
    tankist_points_to_markers,
    coord_to_pixel,
)

USER_AGENT = "chadow-tactics-sync/1.0 (+https://chadow.ru)"
TACTICS_MODES = ("random", "encounter", "assault")
# tankist.net = Mir Tankov only; WoT uses extract_lesta_maps.py --game wot
GAMES = ("lesta",)


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def tankist_minimap_url(version: str, rel_path: str) -> str:
    rel = (rel_path or "").lstrip("/")
    ver = (version or "").strip()
    if not rel or not ver:
        return ""
    from urllib.parse import quote

    ver_enc = "/".join(quote(part) for part in ver.split("/"))
    rel_enc = "/".join(quote(part) for part in rel.split("/"))
    return f"https://tankist.net/static/maps/{ver_enc}/{rel_enc}"


def load_image_from_url(url: str) -> Image.Image | None:
    if not url:
        return None
    try:
        data = fetch_bytes(url)
        return Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception as exc:
        print(f"  ! failed to load {url}: {exc}")
        return None


def paste_asset(
    canvas: Image.Image,
    assets_dir: Path,
    asset_name: str,
    x: float,
    y: float,
    bounds: dict,
    size: int,
    offset: int,
) -> bool:
    asset_path = assets_dir / f"{asset_name}.png"
    if not asset_path.is_file():
        return False
    marker = Image.open(asset_path).convert("RGBA")
    marker = marker.resize((size, size), Image.LANCZOS)
    px, py = coord_to_pixel(x, y, bounds, MAP_IMAGE_SIZE)
    pos = (px - offset, py - offset)
    canvas.paste(marker, pos, marker)
    return True


def paste_tankist_markers(
    image: Image.Image,
    points: list,
    bounds: dict,
    tactical_mode: str,
    assets_dir: Path,
    side_length: int | None,
    *,
    swap_spawns: bool = False,
) -> Image.Image:
    markers = tankist_points_to_markers(points, tactical_mode)
    if not any(markers.values()):
        return image

    spawn_size, cap_size, spawn_offset, cap_offset = marker_sizes(side_length)
    out = image.copy()
    pasted = False

    profile = {
        "random": {"green_spawn", "red_spawn", "green_cap", "red_cap"},
        "encounter": {"green_spawn", "red_spawn", "cap_point"},
        "assault": {"green_spawn", "red_spawn", "green_cap"},
    }.get(tactical_mode, set())

    for coord in markers.get("green_spawn") or []:
        if "green_spawn" not in profile:
            continue
        if tactical_mode == "random":
            asset = "red_cap" if swap_spawns else "green_cap"
            if paste_asset(out, assets_dir, asset, coord[0], coord[1], bounds, cap_size, cap_offset):
                pasted = True
        elif paste_asset(out, assets_dir, "green_spawn", coord[0], coord[1], bounds, spawn_size, spawn_offset):
            pasted = True

    for coord in markers.get("red_spawn") or []:
        if "red_spawn" not in profile:
            continue
        if tactical_mode == "random":
            asset = "green_cap" if swap_spawns else "red_cap"
            if paste_asset(out, assets_dir, asset, coord[0], coord[1], bounds, cap_size, cap_offset):
                pasted = True
        elif paste_asset(out, assets_dir, "red_spawn", coord[0], coord[1], bounds, spawn_size, spawn_offset):
            pasted = True

    for coord in markers.get("cap_point") or []:
        if paste_asset(out, assets_dir, "encounter_cap", coord[0], coord[1], bounds, cap_size, cap_offset):
            pasted = True

    for index, coord in enumerate((markers.get("green_cap") or [])[:2]):
        if "green_cap" not in profile:
            continue
        asset = "red_cap" if swap_spawns else ("green_cap" if index == 0 else "green_cap2")
        if paste_asset(out, assets_dir, asset, coord[0], coord[1], bounds, cap_size, cap_offset):
            pasted = True

    for coord in markers.get("red_cap") or []:
        if "red_cap" not in profile:
            continue
        asset = "green_cap" if swap_spawns else "red_cap"
        if paste_asset(out, assets_dir, asset, coord[0], coord[1], bounds, cap_size, cap_offset):
            pasted = True

    return out if pasted else image


def resize_to_square(image: Image.Image, size: int = MAP_IMAGE_SIZE) -> Image.Image:
    if image.width == size and image.height == size:
        return image
    return image.resize((size, size), Image.LANCZOS)


def load_metadata_codes() -> dict[str, dict]:
    if not METADATA_PATH.is_file():
        return {}
    data = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply tankist.net maps and spawns to tactics assets")
    parser.add_argument("--game", choices=["lesta", "wot", "all"], default="lesta",
                        help="Target game (default: lesta). wot/all rejected — use extract_lesta_maps.py for WoT")
    parser.add_argument("--code", help="Only this map code")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--with-markers",
        action="store_true",
        help="Bake spawn/base markers into images (legacy; default is clean minimaps only)",
    )
    args = parser.parse_args()

    if args.game in ("wot", "all"):
        raise SystemExit(
            "tankist.net maps are Mir Tankov (lesta) only. "
            "Extract WoT maps with: python scripts/extract_lesta_maps.py --game wot --no-spawns"
        )

    if not SPAWNS_PATH.is_file():
        raise SystemExit(f"Missing {SPAWNS_PATH}. Run: python scripts/fetch_tankist_spawns.py")
    if not ASSETS_DIR.is_dir():
        raise SystemExit(f"Missing marker assets: {ASSETS_DIR}")

    spawns_data = json.loads(SPAWNS_PATH.read_text(encoding="utf-8"))
    tankist_maps: dict = spawns_data.get("maps") or {}
    metadata = load_metadata_codes()
    games = GAMES if args.game == "all" else (args.game,)

    written = 0
    skipped = 0

    for code, entry in sorted(tankist_maps.items()):
        if args.code and code != args.code:
            continue
        meta = metadata.get(code) or {}
        meta_modes = meta.get("modes") or []
        side_length = meta.get("side_length")
        bounds = entry.get("bounds") or {}
        version = entry.get("version") or "1.42.0.0"
        mode_data = entry.get("modes") or {}

        for tactics_mode in TACTICS_MODES:
            if meta_modes and tactics_mode not in meta_modes:
                continue
            mode_entry = mode_data.get(tactics_mode)
            if not mode_entry:
                skipped += 1
                continue

            rel = mode_entry.get("minimap_rel") or ""
            url = tankist_minimap_url(version, rel)
            base = load_image_from_url(url)
            if base is None:
                skipped += 1
                continue

            base = resize_to_square(base)
            points = mode_entry.get("points") or []
            if args.with_markers:
                rendered = paste_tankist_markers(
                    base,
                    points,
                    bounds,
                    tactics_mode,
                    ASSETS_DIR,
                    side_length,
                )
                swapped = paste_tankist_markers(
                    base,
                    points,
                    bounds,
                    tactics_mode,
                    ASSETS_DIR,
                    side_length,
                    swap_spawns=True,
                ) if tactics_mode == "random" else None
            else:
                rendered = base
                swapped = None

            for game in games:
                out_dir = ASSETS_ROOT / game / tactics_mode
                out_path = out_dir / f"{code}.webp"
                sw_path = out_dir / f"{code}_sw.webp"
                if args.dry_run:
                    print(f"would write {out_path}")
                    if swapped is not None:
                        print(f"would write {sw_path}")
                    continue
                out_dir.mkdir(parents=True, exist_ok=True)
                rendered.save(out_path, "WEBP", quality=88, method=6)
                written += 1
                if swapped is not None:
                    swapped.save(sw_path, "WEBP", quality=88, method=6)
                    written += 1
                elif sw_path.is_file() and not args.with_markers:
                    sw_path.unlink(missing_ok=True)
                print(f"OK {game}/{tactics_mode}/{code}.webp")

    print(f"Done: {written} files written, {skipped} mode entries skipped")


if __name__ == "__main__":
    main()
