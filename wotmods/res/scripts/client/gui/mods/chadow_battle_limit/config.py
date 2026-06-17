import json
import os

import BigWorld

TAG = '[chadow.battle_limit]'
CONFIG_NAME = 'chadow.battle_limit.json'
PRESET_LIMITS = (1, 3, 5, 10, 15, 20, 30, 50)

_cached_game_root = None


def _looksLikeGameRoot(path):
    if not path or not os.path.isdir(path):
        return False
    for marker in ('version.xml', 'game_info.xml', 'paths.xml', 'Tanki.exe'):
        if os.path.isfile(os.path.join(path, marker)):
            return True
    return os.path.isdir(os.path.join(path, 'mods'))


def _rootCandidates():
    seen = set()
    candidates = []

    def add(path):
        if not path:
            return
        try:
            normalized = os.path.abspath(path)
        except Exception:
            return
        if normalized in seen:
            return
        seen.add(normalized)
        candidates.append(normalized)

    try:
        getter = getattr(BigWorld, 'wg_getPreferencesFilePath', None)
        if callable(getter):
            prefs = getter()
            if prefs:
                add(os.path.dirname(prefs))
    except Exception:
        pass

    try:
        getter = getattr(BigWorld, 'wg_getProductDirectory', None)
        if callable(getter):
            add(getter())
    except Exception:
        pass

    add(os.getcwd())
    add(os.path.abspath('.'))

    return candidates


def _detectGameRoot():
    for candidate in _rootCandidates():
        if _looksLikeGameRoot(candidate):
            return candidate
    for candidate in _rootCandidates():
        return candidate
    return os.path.abspath('.')


def refreshGameRoot():
    global _cached_game_root
    _cached_game_root = None
    return _gameRoot()


def _gameRoot():
    global _cached_game_root
    if _cached_game_root and _looksLikeGameRoot(_cached_game_root):
        return _cached_game_root
    root = _detectGameRoot()
    if _looksLikeGameRoot(root):
        _cached_game_root = root
    return root


def configPath():
    return os.path.join(_gameRoot(), 'mods', 'configs', CONFIG_NAME)


def _defaults():
    return {
        'enabled': True,
        'maxBattles': 0,
        'battlesPlayed': 0,
        'showNotifications': True,
        'randomOnly': True,
        'hardBlockRandom': False,
    }


def load():
    data = _defaults()
    for attempt in range(2):
        path = configPath()
        if not os.path.isfile(path):
            if attempt == 0:
                refreshGameRoot()
                continue
            return data
        try:
            with open(path, 'r') as handle:
                stored = json.load(handle)
            if isinstance(stored, dict):
                data.update(stored)
        except Exception as error:
            print('%s config load failed: %s' % (TAG, error))
        return data
    return data


def save(data):
    path = configPath()
    folder = os.path.dirname(path)
    if not os.path.isdir(folder):
        try:
            os.makedirs(folder)
        except OSError:
            pass
    try:
        with open(path, 'w') as handle:
            json.dump(data, handle, indent=2)
    except Exception as error:
        print('%s config save failed: %s' % (TAG, error))
