#!/usr/bin/env python3
"""Build config/tactics_map_names.json from scripts/_arena_list.json."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARENA_LIST = ROOT / "scripts" / "_arena_list.json"
OUT_PATH = ROOT / "config" / "tactics_map_names.json"

EN = {
    "karelia": "Karelia",
    "malinovka": "Malinovka",
    "himmelsdorf": "Himmelsdorf",
    "prohorovka": "Prokhorovka",
    "lakeville": "Lakeville",
    "ensk": "Ensk",
    "murovanka": "Murovanka",
    "erlenberg": "Erlenberg",
    "hills": "Mines",
    "cliff": "Cliff",
    "monastery": "Abbey",
    "desert": "Sand River",
    "steppes": "Steppes",
    "caucasus": "Caucasus",
    "fjord": "Fjords",
    "redshire": "Redshire",
    "fishing_bay": "Fisherman's Bay",
    "mannerheim_line": "Mannerheim Line",
    "ruinberg": "Ruinberg",
    "siegfried_line": "Siegfried Line",
    "westfeld": "Westfield",
    "el_hallouf": "El Hallouf",
    "airfield": "Airfield",
    "munchen": "Widepark",
    "north_america": "Live Oaks",
    "highway": "Highway",
    "canada_a": "Quiet Coast",
    "asia_great_wall": "Empire's Border",
    "tundra": "Tundra",
    "asia_miao": "Pearl River",
    "dday": "Overlord",
    "czech": "Industrial District",
    "eiffel_tower_ctf": "Paris",
    "sweden": "Windstorm",
    "campania_big": "Province",
    "poland": "Studzianki",
    "minsk": "Minsk",
    "er_clime": "Malinovski Gap",
    "lost_city_ctf": "Lost City",
    "kharkiv": "Kharkov",
    "germany": "Berlin",
    "japort": "Old Port",
    "stalingrad": "Stalingrad",
    "kamchatka": "Kamchatka",
    "kaliningrad": "Kaliningrad",
    "battle_for_moscow": "Battle for Moscow",
    "lost_paradise_v": "Oyster Bay",
    "last_frontier_v": "Outpost",
}


def main() -> None:
    arena_list = json.loads(ARENA_LIST.read_text(encoding="utf-8"))
    by_code: dict[str, dict[str, str]] = {}
    by_arena: dict[str, dict[str, str]] = {}

    for item in arena_list:
        arena = str(item.get("arena", "")).strip().lower()
        code = str(item.get("code", "")).strip().lower()
        ru = str(item.get("ru", "")).strip()
        en = str(item.get("en", "")).strip()
        if not code or not ru or ru.startswith("?") or "/name" in ru:
            continue
        if code == "north_america" and arena == "45_north_america":
            code = "highway"
        if not en or en == ru:
            en = EN.get(code, ru)
        entry = {"ru": ru, "en": en}
        by_code[code] = entry
        if arena:
            by_arena[arena] = entry

    by_code["karelia"] = {"ru": "Орловский выступ", "en": "Karelia"}
    by_code["highway"] = {"ru": "Хайвей", "en": "Highway"}
    by_code["north_america"] = {"ru": "Лайв Окс", "en": "Live Oaks"}
    by_code["kharkiv"] = {"ru": "Харьков", "en": "Kharkov"}
    by_code["munchen"] = {"ru": "Уайдпарк", "en": "Widepark"}

    out = {"by_code": by_code, "by_arena": by_arena}
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_PATH} ({len(by_code)} codes, {len(by_arena)} arenas)")


if __name__ == "__main__":
    main()
