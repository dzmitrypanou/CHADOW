#!/usr/bin/env python3
"""
Extract tactical minimaps from a Mir Tankov or World of Tanks game client and place them
under assets/tactics/maps/{game}/{mode}/{map_code}.webp

These are separate games — never mix their assets:
  lesta → C:\\Games\\Tanki (Мир танков)
  wot   → C:\\Games\\World_of_Tanks_EU (World of Tanks)

Draws spawn points and capture bases from arena_defs (optional, --no-spawns for clean maps).
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
DEFAULT_WOT_CLIENT = Path(r"C:\Games\World_of_Tanks_EU")
GAME_CLIENTS = {
    "lesta": DEFAULT_CLIENT,
    "wot": DEFAULT_WOT_CLIENT,
}
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
    "karelia": ("Орловский выступ", "Karelia"),
}

MAP_NAMES_PATH = ROOT / "config" / "tactics_map_names.json"
MAP_NAMES_CACHE: dict[str, dict[str, str]] | None = None


def load_map_names_index() -> dict[str, dict[str, dict[str, str]]]:
    global MAP_NAMES_CACHE
    if MAP_NAMES_CACHE is not None:
        return MAP_NAMES_CACHE
    if not MAP_NAMES_PATH.is_file():
        MAP_NAMES_CACHE = {"by_code": {}, "by_arena": {}}
        return MAP_NAMES_CACHE
    data = json.loads(MAP_NAMES_PATH.read_text(encoding="utf-8"))
    MAP_NAMES_CACHE = {
        "by_code": data.get("by_code") or {},
        "by_arena": data.get("by_arena") or {},
    }
    return MAP_NAMES_CACHE


def map_lookup_code(code: str) -> str:
    code = code.lower().strip()
    if code.endswith("_sw"):
        code = code[:-3]
    m = re.match(r"^\d+_(.+)$", code)
    if m:
        return m.group(1)
    return code


def map_name_entry(code: str) -> dict[str, str] | None:
    code = code.lower().strip()
    if not code:
        return None
    index = load_map_names_index()
    by_code = index.get("by_code") or {}
    by_arena = index.get("by_arena") or {}
    if code in by_code:
        return by_code[code]
    if code in by_arena:
        return by_arena[code]
    lookup = map_lookup_code(code)
    if lookup != code and lookup in by_code:
        return by_code[lookup]
    return None

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

# WoT client arenas that are not real random-battle maps (events, hangars, variants).
WOT_EXCLUDED = {
    "ensk_big",
    "ruinberg_sm24",
    "dday_sm24",
    "germany_sm24",
    "graf_zeppelin",
    "graf_zeppelin_scc",
    "siegfried_line_ls26_1",
    "hangar_v4",
    "hangar_v4_last_stand",
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


def game_allowed_for_code(code: str, game: str) -> bool:
    if game == "lesta" and code in WOT_ONLY:
        return False
    if game == "wot" and code in LESTA_ONLY:
        return False
    if game == "wot" and code in WOT_EXCLUDED:
        return False
    return True


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
    entry = map_name_entry(code)
    if entry:
        return entry.get("ru") or ru, entry.get("en") or en
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


def assault_gameplay_data(map_info: dict) -> dict:
    assault = map_info.get("assault") or {}
    if assault.get("green_spawn") or assault.get("red_spawn") or assault.get("green_cap"):
        return assault
    return map_info.get("att_def") or {}


def markers_from_fields(data: dict, fields: tuple[str, ...]) -> dict[str, list]:
    merged = empty_markers()
    for field in fields:
        extend_unique_coords(merged[field], normalize_coords(data.get(field)))
    return merged

def merge_assault_markers(map_info: dict) -> dict[str, list]:
    return markers_from_fields(
        assault_gameplay_data(map_info),
        ("green_spawn", "red_spawn", "green_cap"),
    )


def merge_random_markers(map_info: dict, code: str) -> dict[str, list]:
    merged = markers_from_fields(
        map_info.get("standard_battle") or {},
        ("green_cap", "red_cap"),
    )
    for source in spawn_sources_for_mode("random", code):
        data = map_info.get(source) or {}
        if not (data.get("green_spawn") or data.get("red_spawn")):
            continue
        spawns = markers_from_fields(data, ("green_spawn", "red_spawn"))
        merged["green_spawn"] = spawns["green_spawn"]
        merged["red_spawn"] = spawns["red_spawn"]
        break
    return merged


def merge_mode_markers(map_info: dict, mode: str, code: str) -> dict[str, list]:
    if mode == "assault":
        return merge_assault_markers(map_info)
    if mode == "encounter":
        return markers_from_fields(
            map_info.get("encounter_battle") or {},
            ("green_spawn", "red_spawn", "cap_point"),
        )
    return merge_random_markers(map_info, code)

def paste_marker_data(
    image: Image.Image,
    map_info: dict,
    markers: dict[str, list],
    assets_dir: Path,
    gameplay_mode: str = "standard_battle",
    tactical_mode: str = "random",
    *,
    swap_spawns: bool = False,
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
        if tactical_mode == "random":
            asset_name = "red_cap" if swap_spawns else "green_cap"
            paste_asset(asset_name, coord, cap_size, cap_offset)
        else:
            paste_asset("green_spawn", coord, spawn_size, spawn_offset)
    for coord in red_spawn:
        if tactical_mode == "random":
            asset_name = "green_cap" if swap_spawns else "red_cap"
            paste_asset(asset_name, coord, cap_size, cap_offset)
        else:
            paste_asset("red_spawn", coord, spawn_size, spawn_offset)

    for coord in cap_point:
        paste_asset("encounter_cap", coord, cap_size, cap_offset)

    for index, coord in enumerate(green_cap[:2]):
        if swap_spawns:
            asset_name = "red_cap"
        else:
            asset_name = "green_cap" if index == 0 else "green_cap2"
        paste_asset(asset_name, coord, cap_size, cap_offset)

    for coord in red_cap:
        asset_name = "green_cap" if swap_spawns else "red_cap"
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
    *,
    swap_spawns: bool = False,
) -> Image.Image:
    if map_info is None:
        return base
    markers = merge_mode_markers(map_info, mode, code)
    if not any(markers.values()):
        return base
    gameplay = gameplay_for_mode(mode, code)
    return paste_marker_data(
        base,
        map_info,
        markers,
        assets_dir,
        gameplay,
        mode,
        swap_spawns=swap_spawns,
    )


def should_draw_markers(mode: str, draw_spawns: bool) -> bool:
    return draw_spawns and mode == "random"


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


def merge_metadata_entry(existing: dict, incoming: dict, game: str) -> dict:
    games = sorted(set(existing.get("games") or []) | {game})
    merged = dict(incoming)
    merged["games"] = games
    if existing.get("side_length") and not merged.get("side_length"):
        merged["side_length"] = existing["side_length"]
    return merged


def run(
    client: Path,
    game: str,
    dry_run: bool = False,
    draw_spawns: bool = True,
    *,
    write_metadata: bool = True,
    metadata_base: dict | None = None,
) -> tuple[dict, dict]:
    if game not in GAME_CLIENTS:
        raise ValueError(f"Unknown game: {game}")

    arenas, MapInfoCreator, client = load_extractor(client)
    packages_dir = client / "res" / "packages"

    stats = {"game": game, "client": str(client), "arenas": 0, "files": 0, "skipped": 0, "codes": {}}
    metadata: dict[str, dict] = dict(metadata_base or {})
    written_files: set[Path] = set()
    game_root = ASSETS_ROOT / game

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

    for entry in sorted(arenas.values(), key=lambda item: item["code"]):
        code = entry["code"]
        arena = entry["arena"]
        if not game_allowed_for_code(code, game):
            stats["skipped"] += 1
            continue
        if not (packages_dir / f"{arena}.pkg").is_file():
            stats["skipped"] += 1
            continue

        image = get_image(arena)
        if image is None:
            stats["skipped"] += 1
            continue

        map_info = get_info(arena)
        side_length = map_side_length(map_info)
        modes = modes_for_arena(get_tags(arena), code)
        if not modes:
            stats["skipped"] += 1
            continue

        row = {
            "arena": arena,
            "display_name_ru": entry["display_name_ru"],
            "display_name_en": entry["display_name_en"],
            "side_length": side_length,
            "games": [game],
            "modes": modes,
        }
        if code in metadata:
            metadata[code] = merge_metadata_entry(metadata[code], row, game)
        else:
            metadata[code] = row
        stats["arenas"] += 1
        stats["codes"][code] = {"games": [game], "modes": modes}

        for mode in modes:
            dest = game_root / mode / f"{code}.webp"
            if dry_run:
                print(f"would write {dest}")
                continue
            if should_draw_markers(mode, draw_spawns):
                output = render_map_for_mode(image, map_info, mode, code, assets_dir)
                save_webp(output, dest)
                written_files.add(dest)
                swapped_dest = game_root / mode / f"{code}_sw.webp"
                swapped = render_map_for_mode(
                    image,
                    map_info,
                    mode,
                    code,
                    assets_dir,
                    swap_spawns=True,
                )
                save_webp(swapped, swapped_dest)
                written_files.add(swapped_dest)
            else:
                save_webp(image, dest)
                written_files.add(dest)
            stats["files"] += 1

    if not dry_run:
        if game_root.is_dir():
            for path in game_root.rglob("*.webp"):
                if path not in written_files:
                    path.unlink()
        if write_metadata:
            METADATA_PATH.write_text(
                json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    return stats, metadata


def save_webp(image: Image.Image, dest: Path, quality: int = 88) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    image.save(dest, format="WEBP", quality=quality, method=6)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract WoT/Lesta minimaps into chadow.ru assets")
    parser.add_argument(
        "--game",
        choices=("lesta", "wot", "all"),
        default="all",
        help="Target game catalog (default: extract both clients separately)",
    )
    parser.add_argument(
        "--client",
        type=Path,
        default=None,
        help="Override game client path (only with --game lesta or --game wot)",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-spawns", action="store_true", help="Skip respawn markers overlay")
    args = parser.parse_args()

    draw_spawns = not args.no_spawns
    targets = list(GAME_CLIENTS.items()) if args.game == "all" else [(args.game, args.client or GAME_CLIENTS[args.game])]

    combined_metadata: dict[str, dict] = {}
    if METADATA_PATH.is_file():
        loaded = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        if isinstance(loaded, dict):
            combined_metadata = loaded

    all_stats: dict[str, dict] = {}
    for index, (game, default_client) in enumerate(targets):
        client = (args.client or default_client).resolve()
        if not client.is_dir():
            raise SystemExit(f"Client directory not found for {game}: {client}")
        if args.game != "all" and args.client is not None and game != args.game:
            continue

        stats, metadata = run(
            client,
            game,
            dry_run=args.dry_run,
            draw_spawns=draw_spawns,
            write_metadata=False,
            metadata_base=combined_metadata,
        )
        combined_metadata = metadata
        all_stats[game] = stats

        if not args.dry_run and index == len(targets) - 1:
            METADATA_PATH.write_text(
                json.dumps(combined_metadata, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    print(json.dumps(all_stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
