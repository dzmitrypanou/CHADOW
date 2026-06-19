#!/usr/bin/env python3
"""
Extract tactical minimaps from a Mir Tankov / WoT game client and place them
under assets/tactics/maps/{game}/{mode}/{map_code}.webp

Draws spawn points and capture bases from arena_defs.

Requires: Python 3.9+, Pillow, scripts/_wot_extract (wot-map-extractor clone).
Default client path: C:\\Games\\Tanki
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
EXTRACTOR = ROOT / "scripts" / "_wot_extract"
DEFAULT_CLIENT = Path(r"C:\Games\Tanki")
ASSETS_ROOT = ROOT / "assets" / "tactics" / "maps"
METADATA_PATH = ROOT / "scripts" / "lesta_maps_metadata.json"
ASSETS_DIR = EXTRACTOR / "assets"
MAP_IMAGE_SIZE = 512
STANDARD_SPAWN_SIZE = 50
STANDARD_CAP_SIZE = 100

# Project map codes that reuse another arena's minimap.
VARIANT_ARENA = {
    "germany_att": "105_germany",
    "ruinberg_att": "08_ruinberg",
    "siegfried_line_att": "14_siegfried_line",
    "steppes_def": "35_steppes",
    "epic_random_valley_att": "212_epic_random_valley",
}

# Same suffix after stripping numeric prefix — keep arenas separate.
ARENA_CODE_OVERRIDES = {
    "45_north_america": "highway",
    "44_north_america": "north_america",
}

CANONICAL_NAMES = {
    "north_america": ("Лайв Окс", "Live Oaks"),
    "highway": ("Хайвей", "Highway"),
    "kharkiv": ("Харьков", "Kharkov"),
    "munchen": ("Уайдпарк", "Widepark"),
}

SPAWN_CHAIN_BY_MODE = {
    "random": ["standard_battle", "att_def", "assault", "encounter_battle", "onslaught"],
    "encounter": ["encounter_battle", "att_def", "assault", "standard_battle", "onslaught"],
    "assault": ["assault", "att_def", "encounter_battle", "standard_battle", "onslaught"],
    "custom": ["standard_battle", "att_def", "encounter_battle", "assault", "onslaught"],
}

SKIP_ARENA_PREFIXES = ("100", "qa_", "te_", "tank_", "customization_", "h33_", "h34_")
SKIP_ARENA_SUFFIXES = ("_hw22",)
SKIP_CODES = {
    "cgf_test",
    "ai_test_automation",
    "3d_styles_test",
    "nextgen_test",
    "greenland",
    "br_battle_city2",
    "br_battle_city2-1",
    "br_battle_city3",
    "br_battle_city4",
    "normandy_nom",
    "siegfried_line_nom",
    "er_alaska",
    "cosmic_2026",
    "bf_epic_desert",
    "bf_epic_normandy",
    "epic_random_valley",
    "epic_random_valley_att",
    "epic_suburbia",
}

LESTA_ONLY = {
    "battle_for_moscow",
    "caucasus",
    "kamchatka",
    "minsk",
    "er_clime",
    "japort",
}

WOT_ONLY = {
    "sweden",
    "westfeld",
    "monastery",
    "eiffel_tower_ctf",
    "dday",
    "lost_paradise_v",
    "campania_big",
    "last_frontier_v",
}

ENCOUNTER = {
    "airfield",
    "cliff",
    "desert",
    "ensk",
    "erlenberg",
    "fishing_bay",
    "fjord",
    "hills",
    "himmelsdorf",
    "karelia",
    "lakeville",
    "malinovka",
    "mannerheim_line",
    "munchen",
    "north_america",
    "prohorovka",
    "redshire",
    "ruinberg",
    "siegfried_line",
    "steppes",
    "tundra",
    "germany",
    "poland",
    "stalingrad",
    "asia_great_wall",
    "asia_miao",
    "canada_a",
    "lost_city_ctf",
    "murovanka",
    "kaliningrad",
}

ASSAULT = {
    "karelia",
    "murovanka",
    "ruinberg",
    "siegfried_line",
    "germany",
    "steppes",
    "erlenberg",
    "poland",
    "tundra",
    "cliff",
    "himmelsdorf",
    "mannerheim_line",
    "north_america",
    "highway",
    "er_clime",
}


def is_variant_code(code: str) -> bool:
    return bool(
        re.search(r"(_att|_def|_ny)$", code)
        or code.startswith("bf_epic_")
        or code.startswith("epic_")
    )


def modes_for_arena(gameplay_tags: set[str], code: str) -> list[str]:
    if is_variant_code(code):
        return []
    modes: list[str] = []
    has_ctf = "ctf" in gameplay_tags or not gameplay_tags
    has_dom = "domination" in gameplay_tags
    has_ass = "assault" in gameplay_tags or "assault2" in gameplay_tags
    if has_ctf:
        modes.append("random")
    if has_dom and code in ENCOUNTER:
        modes.append("encounter")
    if has_ass and code in ASSAULT:
        modes.append("assault")
    return modes or (["random"] if has_ctf else [])


def games_for_code(code: str) -> list[str]:
    games = []
    if code not in LESTA_ONLY:
        games.append("wot")
    if code not in WOT_ONLY:
        games.append("lesta")
    return games


def gameplay_for_mode(mode: str, code: str) -> str:
    if mode == "encounter":
        return "encounter_battle"
    if mode == "assault" or code.endswith("_att") or code.endswith("_def"):
        return "assault"
    return "standard_battle"


def spawn_sources_for_mode(mode: str, code: str) -> list[str]:
    chain = list(SPAWN_CHAIN_BY_MODE.get(mode, SPAWN_CHAIN_BY_MODE["random"]))
    if code.endswith("_att") or code.endswith("_def"):
        preferred = ["assault", "att_def"]
        chain = preferred + [item for item in chain if item not in preferred]
    seen: set[str] = set()
    out: list[str] = []
    for item in chain:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def has_spawn_data(map_info: dict, gameplay_mode: str) -> bool:
    return has_map_marker_data(map_info, gameplay_mode)


def canonical_names(code: str, ru: str, en: str) -> tuple[str, str]:
    if code in CANONICAL_NAMES:
        return CANONICAL_NAMES[code]
    return ru, en


def read_gameplay_tags(client: Path, arena: str, XmlUnpacker) -> set[str]:
    scripts_pkg = client / "res" / "packages" / "scripts.pkg"
    try:
        with zipfile.ZipFile(scripts_pkg) as zf:
            with zf.open(f"scripts/arena_defs/{arena}.xml") as handle:
                root = XmlUnpacker().read(handle)
    except Exception:
        return set()
    gameplay = root.find("gameplayTypes")
    if gameplay is None:
        return set()
    return {child.tag for child in gameplay}


def arena_to_code(arena: str) -> str:
    if arena in ARENA_CODE_OVERRIDES:
        return ARENA_CODE_OVERRIDES[arena]
    return re.sub(r"^\d+_", "", arena)


def bounding_box(map_info: dict, gameplay_mode: str) -> tuple[list[int], list[int]] | None:
    if gameplay_mode == "onslaught" and map_info.get("onslaught_upper_right") and map_info.get("onslaught_bottom_left"):
        return map_info["onslaught_upper_right"], map_info["onslaught_bottom_left"]
    upper = map_info.get("upper_right")
    bottom = map_info.get("bottom_left")
    if not upper or not bottom:
        return None
    return upper, bottom


def map_coord_to_pixel(x: float, y: float, upper: list[int], bottom: list[int], offset: int) -> tuple[int, int]:
    width = upper[0] - bottom[0]
    height = upper[1] - bottom[1]
    if width == 0 or height == 0:
        return 0, 0
    new_x = ((x - bottom[0]) / width) * MAP_IMAGE_SIZE - offset
    new_y = (1 - ((y - bottom[1]) / height)) * MAP_IMAGE_SIZE - offset
    return round(new_x), round(new_y)


def normalize_coords(value) -> list[list[float]]:
    if not value:
        return []
    if isinstance(value[0], (int, float)):
        return [value]
    return [coord for coord in value if coord and len(coord) >= 2]


def empty_markers() -> dict[str, list]:
    return {
        "green_spawn": [],
        "red_spawn": [],
        "green_cap": [],
        "red_cap": [],
        "cap_point": [],
    }


def extend_unique_coords(target: list, coords: list[list[float]]) -> None:
    seen = {tuple(c) for c in target}
    for coord in coords:
        key = tuple(coord)
        if key not in seen:
            target.append(coord)
            seen.add(key)


MARKER_FIELDS = (
    "green_spawn",
    "red_spawn",
    "green_cap",
    "red_cap",
    "cap_point",
)

MARKER_PROFILE_BY_MODE = {
    "random": {"green_spawn", "red_spawn", "green_cap", "red_cap"},
    "encounter": {"green_spawn", "red_spawn", "cap_point"},
    "assault": {"green_spawn", "red_spawn", "green_cap"},
}

SPAWN_SOURCE_PRIORITY = ("standard_battle", "encounter_battle", "att_def")
ASSAULT_SOURCES = ("assault", "att_def")

GRAY_CAP_RGB = {
    (41, 160, 0): (120, 120, 120),
    (41, 159, 0): (118, 118, 118),
    (41, 158, 0): (116, 116, 116),
    (29, 211, 0): (170, 170, 170),
}


def recolor_cap_asset(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            replacement = GRAY_CAP_RGB.get((red, green, blue))
            if replacement is not None:
                pixels[x, y] = (*replacement, alpha)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, format="PNG")


def ensure_gray_cap_assets(assets_dir: Path) -> None:
    for index, suffix in enumerate(("", "2"), start=1):
        target = assets_dir / f"gray_cap{suffix}.png"
        if target.is_file():
            continue
        source = assets_dir / f"green_cap{suffix}.png"
        if not source.is_file():
            raise SystemExit(f"Missing cap asset template: {source}")
        recolor_cap_asset(source, target)


def merge_from_sources(
    map_info: dict,
    sources: list[str],
    fields: tuple[str, ...],
    *,
    accumulate: frozenset[str] = frozenset(),
) -> dict[str, list]:
    merged = empty_markers()
    for gameplay in sources:
        data = map_info.get(gameplay) or {}
        for field in fields:
            coords = normalize_coords(data.get(field))
            if not coords:
                continue
            if field in accumulate:
                extend_unique_coords(merged[field], coords)
            elif not merged[field]:
                extend_unique_coords(merged[field], coords)
    return merged


def merge_assault_markers(map_info: dict) -> dict[str, list]:
    spawns = merge_from_sources(
        map_info,
        list(ASSAULT_SOURCES),
        ("green_spawn", "red_spawn"),
        accumulate=frozenset({"green_spawn", "red_spawn"}),
    )
    caps = merge_from_sources(
        map_info,
        list(ASSAULT_SOURCES),
        ("green_cap",),
        accumulate=frozenset({"green_cap"}),
    )
    merged = empty_markers()
    merged["green_spawn"] = spawns["green_spawn"]
    merged["red_spawn"] = spawns["red_spawn"]
    merged["green_cap"] = caps["green_cap"]
    return merged


def merge_mode_markers(map_info: dict, mode: str, code: str) -> dict[str, list]:
    if mode == "assault":
        return merge_assault_markers(map_info)
    if mode == "encounter":
        return merge_from_sources(
            map_info,
            ["encounter_battle"],
            ("green_spawn", "red_spawn", "cap_point"),
        )
    caps = merge_from_sources(
        map_info,
        ["standard_battle"],
        ("green_cap", "red_cap"),
    )
    spawns = merge_from_sources(
        map_info,
        list(SPAWN_SOURCE_PRIORITY),
        ("green_spawn", "red_spawn"),
        accumulate=frozenset({"green_spawn", "red_spawn"}),
    )
    merged = empty_markers()
    merged["green_spawn"] = spawns["green_spawn"]
    merged["red_spawn"] = spawns["red_spawn"]
    merged["green_cap"] = caps["green_cap"]
    merged["red_cap"] = caps["red_cap"]
    return merged


def cap_coords_for_mode(
    tactical_mode: str,
    green_cap: list,
    red_cap: list,
    cap_point: list,
) -> list[list[float]]:
    if tactical_mode == "encounter":
        return cap_point[:1]
    coords = list(green_cap)
    if tactical_mode == "random":
        coords.extend(red_cap)
    return coords


def paste_marker_data(
    image: Image.Image,
    map_info: dict,
    markers: dict[str, list],
    assets_dir: Path,
    gameplay_mode: str = "standard_battle",
    tactical_mode: str = "random",
) -> Image.Image:
    profile = MARKER_PROFILE_BY_MODE.get(tactical_mode, MARKER_PROFILE_BY_MODE["random"])
    green_spawn = markers.get("green_spawn") or [] if "green_spawn" in profile else []
    red_spawn = markers.get("red_spawn") or [] if "red_spawn" in profile else []
    green_cap = markers.get("green_cap") or [] if "green_cap" in profile else []
    red_cap = markers.get("red_cap") or [] if "red_cap" in profile else []
    cap_point = markers.get("cap_point") or [] if "cap_point" in profile else []

    if not (green_spawn or red_spawn or green_cap or red_cap or cap_point):
        return image

    box = bounding_box(map_info, gameplay_mode)
    if box is None:
        return image
    upper, bottom = box
    height = upper[1] - bottom[1]
    if height <= 0:
        return image

    spawn_size = max(8, round(MAP_IMAGE_SIZE / height * STANDARD_SPAWN_SIZE))
    cap_size = max(10, round(MAP_IMAGE_SIZE / height * STANDARD_CAP_SIZE))
    spawn_offset = round(spawn_size / 2)
    cap_offset = round(cap_size / 2)
    out = image.copy()
    pasted = False

    def paste_asset(asset_name: str, coord: list[float], size: int, offset: int) -> None:
        nonlocal pasted
        asset_path = assets_dir / f"{asset_name}.png"
        if not asset_path.is_file():
            return
        marker = Image.open(asset_path).convert("RGBA")
        marker = marker.resize((size, size), Image.LANCZOS)
        pos = map_coord_to_pixel(coord[0], coord[1], upper, bottom, offset)
        out.paste(marker, pos, marker)
        pasted = True

    for coord in green_spawn:
        paste_asset("green_spawn", coord, spawn_size, spawn_offset)
    for coord in red_spawn:
        paste_asset("red_spawn", coord, spawn_size, spawn_offset)

    capture_bases = cap_coords_for_mode(tactical_mode, green_cap, red_cap, cap_point)
    for index, coord in enumerate(capture_bases[:2]):
        asset_name = "gray_cap" if index == 0 else "gray_cap2"
        paste_asset(asset_name, coord, cap_size, cap_offset)

    return out if pasted else image


def paste_map_markers(
    image: Image.Image,
    map_info: dict,
    gameplay_mode: str,
    assets_dir: Path,
) -> Image.Image:
    mode_data = map_info.get(gameplay_mode) or {}
    markers = empty_markers()
    extend_unique_coords(markers["green_spawn"], normalize_coords(mode_data.get("green_spawn")))
    extend_unique_coords(markers["red_spawn"], normalize_coords(mode_data.get("red_spawn")))
    extend_unique_coords(markers["green_cap"], normalize_coords(mode_data.get("green_cap")))
    extend_unique_coords(markers["red_cap"], normalize_coords(mode_data.get("red_cap")))
    extend_unique_coords(markers["cap_point"], normalize_coords(mode_data.get("cap_point")))
    return paste_marker_data(image, map_info, markers, assets_dir, gameplay_mode)


def has_map_marker_data(map_info: dict, gameplay_mode: str) -> bool:
    mode_data = map_info.get(gameplay_mode) or {}
    return bool(
        mode_data.get("green_spawn")
        or mode_data.get("red_spawn")
        or mode_data.get("green_cap")
        or mode_data.get("red_cap")
        or mode_data.get("cap_point")
    )


def extract_map_info(arena: str, MapInfoCreator) -> dict | None:
    try:
        return MapInfoCreator().extract(arena)
    except Exception:
        return None


def render_map_for_mode(
    base: Image.Image,
    map_info: dict | None,
    mode: str,
    code: str,
    assets_dir: Path,
) -> Image.Image:
    if map_info is None:
        return base
    markers = merge_mode_markers(map_info, mode, code)
    if not any(markers.values()):
        return base
    gameplay = gameplay_for_mode(mode, code)
    return paste_marker_data(base, map_info, markers, assets_dir, gameplay, mode)


def should_skip_arena(arena: str, ru_name: str) -> bool:
    if any(arena.startswith(p) for p in SKIP_ARENA_PREFIXES):
        return True
    if any(arena.endswith(s) for s in SKIP_ARENA_SUFFIXES):
        return True
    code = arena_to_code(arena)
    if code in SKIP_CODES:
        return True
    if is_variant_code(code):
        return True
    if ru_name.startswith("100") or ru_name.startswith("?"):
        return True
    if "/name" in ru_name:
        return True
    return False


def load_extractor(client: Path):
    if not EXTRACTOR.is_dir():
        raise SystemExit(
            f"Missing {EXTRACTOR}. Run: git clone https://github.com/synopss/wot-map-extractor.git scripts/_wot_extract"
        )
    sys.path.insert(0, str(EXTRACTOR))
    import gettext  # noqa: WPS433
    import settings  # noqa: WPS433

    settings.WOT_PATH_DEFAULT = str(client)
    from MapInfoCreator import MapInfoCreator  # noqa: WPS433
    from XmlUnpacker import XmlUnpacker  # noqa: WPS433

    MapInfoCreator.scripts_dir = str(client / "res" / "packages" / "scripts.pkg")

    def load_gt(lang: str):
        path = client / "res" / "text" / lang / "lc_messages" / "arenas.mo"
        if path.is_file():
            return gettext.GNUTranslations(open(path, "rb"))
        return None

    ru_gt = load_gt("ru")
    en_gt = load_gt("en") or load_gt("be")

    def localize(gt, arena: str) -> str:
        if gt is None:
            return arena
        try:
            return gt.gettext(f"{arena}/name")
        except Exception:
            return arena

    scripts_pkg = client / "res" / "packages" / "scripts.pkg"
    if not scripts_pkg.is_file():
        raise SystemExit(f"Game client not found: {scripts_pkg}")

    with zipfile.ZipFile(scripts_pkg) as zf:
        list_path = next(n for n in zf.namelist() if n.endswith("_list_.xml"))
        root = XmlUnpacker().read(zf.open(list_path))

    arenas: dict[str, dict] = {}
    for node in root.findall("map"):
        if node.find("name") is None:
            continue
        arena = node.find("name").text.strip()
        ru = localize(ru_gt, arena)
        if should_skip_arena(arena, ru):
            continue
        code = arena_to_code(arena)
        en = localize(en_gt, arena) if en_gt else ru
        ru, en = canonical_names(code, ru, en if en and en != ru else ru)
        arenas[arena] = {
            "arena": arena,
            "code": code,
            "display_name_ru": ru,
            "display_name_en": en if en and en != ru else ru,
        }

    for code, source_arena in VARIANT_ARENA.items():
        if source_arena in arenas and code not in {v["code"] for v in arenas.values()}:
            src = arenas[source_arena]
            arenas[f"__alias__{code}"] = {
                "arena": source_arena,
                "code": code,
                "display_name_ru": src["display_name_ru"],
                "display_name_en": src["display_name_en"],
                "alias": True,
            }

    return arenas, MapInfoCreator, client


def extract_mmap_image(client: Path, arena: str) -> Image.Image | None:
    pkg_path = client / "res" / "packages" / f"{arena}.pkg"
    if not pkg_path.is_file():
        return None
    mmap_path = f"spaces/{arena}/mmap.dds"
    comp7_path = f"spaces/{arena}/mmap_comp7.dds"
    with zipfile.ZipFile(pkg_path) as zf:
        names = set(zf.namelist())
        path = comp7_path if comp7_path in names else mmap_path
        if path not in names:
            return None
        with zf.open(path) as handle:
            return Image.open(handle).convert("RGBA")


def map_side_length(map_info: dict | None) -> int | None:
    if not map_info:
        return None
    upper = map_info.get("upper_right")
    bottom = map_info.get("bottom_left")
    if not upper or not bottom:
        return None
    size = max(abs(upper[0] - bottom[0]), abs(upper[1] - bottom[1]))
    return int(size) if size >= 100 else None


def run(client: Path, dry_run: bool = False, draw_spawns: bool = True) -> dict:
    arenas, MapInfoCreator, client = load_extractor(client)
    packages_dir = client / "res" / "packages"

    stats = {"arenas": 0, "files": 0, "skipped": 0, "codes": {}}
    metadata: dict[str, dict] = {}
    written_files: set[Path] = set()

    arena_cache: dict[str, Image.Image | None] = {}
    info_cache: dict[str, dict | None] = {}
    tags_cache: dict[str, set[str]] = {}

    def get_tags(arena: str) -> set[str]:
        if arena not in tags_cache:
            from XmlUnpacker import XmlUnpacker  # noqa: WPS433

            tags_cache[arena] = read_gameplay_tags(client, arena, XmlUnpacker)
        return tags_cache[arena]

    def get_image(arena: str) -> Image.Image | None:
        if arena not in arena_cache:
            arena_cache[arena] = extract_mmap_image(client, arena)
        return arena_cache[arena]

    def get_info(arena: str) -> dict | None:
        if arena not in info_cache:
            info_cache[arena] = extract_map_info(arena, MapInfoCreator)
        return info_cache[arena]

    assets_dir = ASSETS_DIR
    if draw_spawns and not assets_dir.is_dir():
        raise SystemExit(f"Missing spawn assets: {assets_dir}")
    if draw_spawns:
        ensure_gray_cap_assets(assets_dir)

    for entry in sorted(arenas.values(), key=lambda item: item["code"]):
        code = entry["code"]
        arena = entry["arena"]
        if not (packages_dir / f"{arena}.pkg").is_file():
            stats["skipped"] += 1
            continue

        image = get_image(arena)
        if image is None:
            stats["skipped"] += 1
            continue

        map_info = get_info(arena)
        side_length = map_side_length(map_info)
        games = games_for_code(code)
        modes = modes_for_arena(get_tags(arena), code)
        if not games:
            stats["skipped"] += 1
            continue

        metadata[code] = {
            "arena": arena,
            "display_name_ru": entry["display_name_ru"],
            "display_name_en": entry["display_name_en"],
            "side_length": side_length,
            "games": games,
            "modes": modes,
        }
        stats["arenas"] += 1
        stats["codes"][code] = {"games": games, "modes": modes}

        for game in games:
            for mode in modes:
                dest = ASSETS_ROOT / game / mode / f"{code}.webp"
                if dry_run:
                    print(f"would write {dest}")
                    continue
                output = (
                    render_map_for_mode(image, map_info, mode, code, assets_dir)
                    if draw_spawns
                    else image
                )
                save_webp(output, dest)
                written_files.add(dest)
                stats["files"] += 1

    if not dry_run:
        for path in ASSETS_ROOT.rglob("*.webp"):
            if path not in written_files:
                path.unlink()
        METADATA_PATH.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    return stats


def save_webp(image: Image.Image, dest: Path, quality: int = 88) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    image.save(dest, format="WEBP", quality=quality, method=6)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract Mir Tankov minimaps into chadow.ru assets")
    parser.add_argument("--client", type=Path, default=DEFAULT_CLIENT, help="Path to Tanki/WoT client")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-spawns", action="store_true", help="Skip respawn markers overlay")
    args = parser.parse_args()

    client = args.client.resolve()
    if not client.is_dir():
        raise SystemExit(f"Client directory not found: {client}")

    stats = run(client, dry_run=args.dry_run, draw_spawns=not args.no_spawns)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
