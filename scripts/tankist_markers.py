"""Helpers for Tankist.net map coordinates and tactical marker conversion."""
from __future__ import annotations

import re
from typing import Any

MAP_IMAGE_SIZE = 512
STANDARD_SPAWN_SIZE = 50
STANDARD_CAP_SIZE = 100

TANKIST_MODE_TO_TACTICS = {
    "ctf": "random",
    "domination": "encounter",
    "assault2": "assault",
}

ARENA_CODE_OVERRIDES = {
    "45_north_america": "highway",
    "44_north_america": "north_america",
}


def arena_to_code(arena: str) -> str:
    arena = (arena or "").strip().lower()
    if arena in ARENA_CODE_OVERRIDES:
        return ARENA_CODE_OVERRIDES[arena]
    return re.sub(r"^\d+_", "", arena)


def empty_markers() -> dict[str, list[list[float]]]:
    return {
        "green_spawn": [],
        "red_spawn": [],
        "green_cap": [],
        "red_cap": [],
        "cap_point": [],
    }


def tankist_points_to_markers(points: list[dict[str, Any]], tactical_mode: str) -> dict[str, list[list[float]]]:
    markers = empty_markers()
    for point in points or []:
        point_type = str(point.get("point_type") or "").lower()
        team = str(point.get("team") or "").lower().replace(" ", "_")
        try:
            coord = [float(point["x"]), float(point["y"])]
        except (KeyError, TypeError, ValueError):
            continue

        if point_type == "spawn":
            if team in ("team1", "1", "ally", "allies"):
                markers["green_spawn"].append(coord)
            elif team in ("team2", "2", "enemy", "enemies"):
                markers["red_spawn"].append(coord)
        elif point_type == "base":
            if team in ("team1", "1", "ally", "allies"):
                markers["green_cap"].append(coord)
            elif team in ("team2", "2", "enemy", "enemies"):
                markers["red_cap"].append(coord)
        elif point_type == "control_point":
            markers["cap_point"].append(coord)

    if tactical_mode == "random":
        if not markers["green_spawn"] and markers["green_cap"]:
            markers["green_spawn"] = [list(c) for c in markers["green_cap"][:1]]
        if not markers["red_spawn"] and markers["red_cap"]:
            markers["red_spawn"] = [list(c) for c in markers["red_cap"][:1]]

    return markers


def coord_to_pixel(
    x: float,
    y: float,
    bounds: dict[str, float],
    size: int = MAP_IMAGE_SIZE,
) -> tuple[int, int]:
    min_x = float(bounds.get("min_x", 0))
    min_y = float(bounds.get("min_y", 0))
    max_x = float(bounds.get("max_x", 0))
    max_y = float(bounds.get("max_y", 0))
    dx = max_x - min_x
    dy = max_y - min_y
    if not dx or not dy:
        return 0, 0
    px = ((x - min_x) / dx) * size
    py = (1 - ((y - min_y) / dy)) * size
    return round(px), round(py)


def marker_sizes(side_length: int | None) -> tuple[int, int, int, int]:
    height = side_length or 1000
    spawn_size = max(8, round(MAP_IMAGE_SIZE / height * STANDARD_SPAWN_SIZE))
    cap_size = max(10, round(MAP_IMAGE_SIZE / height * STANDARD_CAP_SIZE))
    return spawn_size, cap_size, round(spawn_size / 2), round(cap_size / 2)
