# -*- coding: utf-8 -*-
# Chadow.ru — лимит боёв за сессию. Блокирует кнопку «В бой» после N боёв.

MOD_VERSION = '{{VERSION}}'

import os
import sys

_MODS_DIR = os.path.dirname(os.path.abspath(__file__))
if _MODS_DIR not in sys.path:
    sys.path.insert(0, _MODS_DIR)

from chadow_battle_limit import config
from chadow_battle_limit.controller import BattleLimitController
from chadow_battle_limit import hooks
from chadow_battle_limit import ui_hooks

TAG = config.TAG
_controller = None


def init():
    global _controller
    try:
        BattleLimitController.instance = BattleLimitController()
        _controller = BattleLimitController.instance
        hooks.install()
        ui_hooks.install()
        _controller.bind()
        print('%s loaded v%s (limit=%s, played=%s, randomOnly=%s, hardBlock=%s)' % (
            TAG,
            MOD_VERSION,
            _controller.maxBattles,
            _controller.battlesPlayed,
            _controller.randomOnly,
            _controller.hardBlockRandom,
        ))
    except Exception:
        import traceback
        print('%s init failed:' % TAG)
        traceback.print_exc()
        raise


def fini():
    global _controller
    if _controller is not None:
        _controller.unbind()
        _controller = None
        BattleLimitController.instance = None
    ui_hooks.uninstall()
    hooks.uninstall()
    print('%s unloaded' % TAG)
