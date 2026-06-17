# -*- coding: utf-8 -*-
# Chadow.ru — лимит боёв за сессию. Блокирует кнопку «В бой» после N боёв.

MOD_VERSION = '{{VERSION}}'

from chadow_battle_limit import config
from chadow_battle_limit.controller import BattleLimitController
from chadow_battle_limit import hooks

TAG = config.TAG
_controller = None


def init():
    global _controller
    BattleLimitController.instance = BattleLimitController()
    _controller = BattleLimitController.instance
    hooks.install()
    _controller.bind()
    print('%s loaded v%s (limit=%s, played=%s)' % (
        TAG,
        MOD_VERSION,
        _controller.maxBattles,
        _controller.battlesPlayed,
    ))


def fini():
    global _controller
    if _controller is not None:
        _controller.unbind()
        _controller = None
        BattleLimitController.instance = None
    hooks.uninstall()
    print('%s unloaded' % TAG)
