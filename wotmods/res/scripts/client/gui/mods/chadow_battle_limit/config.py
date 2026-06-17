import json
import os

import BigWorld

TAG = '[chadow.battle_limit]'
CONFIG_NAME = 'chadow.battle_limit.json'
PRESET_LIMITS = (1, 3, 5, 10, 15, 20, 30, 50)


def _gameRoot():
    prefs = BigWorld.wg_getPreferencesFilePath()
    if prefs:
        return os.path.dirname(os.path.abspath(prefs))
    return os.path.abspath('.')


def configPath():
    return os.path.join(_gameRoot(), 'mods', 'configs', CONFIG_NAME)


def _defaults():
    return {
        'enabled': True,
        'maxBattles': 5,
        'battlesPlayed': 0,
        'showNotifications': True,
    }


def load():
    path = configPath()
    data = _defaults()
    if not os.path.isfile(path):
        return data
    try:
        with open(path, 'r') as handle:
            stored = json.load(handle)
        if isinstance(stored, dict):
            data.update(stored)
    except Exception as error:
        print('%s config load failed: %s' % (TAG, error))
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
