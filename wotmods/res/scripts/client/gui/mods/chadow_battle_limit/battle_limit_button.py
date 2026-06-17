# -*- coding: utf-8 -*-
"""Hangar counter button hosted in the vehicle-compare slot when compare is unused."""

from .controller import BattleLimitController
from . import ui

CHADOW_BUTTON_ALIAS = 'ChadowBattleLimitButtonAlias'
_chadow_slot_mode = False


def is_chadow_slot_mode():
    return _chadow_slot_mode


def set_chadow_slot_mode(enabled):
    global _chadow_slot_mode
    _chadow_slot_mode = bool(enabled)


def counter_value(controller):
    if controller is None:
        return 0
    if controller.hardBlockRandom:
        return 0
    if not controller.isActive():
        return 0
    return max(controller.battlesPlayed, 0)


def counter_label(controller):
    if controller is None:
        return u'—'
    if controller.hardBlockRandom:
        return u'0'
    if not controller.isActive():
        return u'∞'
    return u'%d/%d' % (controller.battlesPlayed, controller.maxBattles)


def open_settings(_source=None):
    ui.open_settings_panel(_source)


try:
    from gui.Scaleform.daapi.view.meta.ButtonWithCounterMeta import ButtonWithCounterMeta

    class ChadowBattleLimitButton(ButtonWithCounterMeta):
        def _populate(self):
            super(ChadowBattleLimitButton, self)._populate()
            self.refresh()

        def handleClick(self):
            open_settings(self)

        def refresh(self):
            controller = BattleLimitController.instance
            try:
                self.as_setCountS(counter_value(controller))
            except Exception:
                pass

    _HAS_BUTTON_CLASS = True
except Exception:
    ChadowBattleLimitButton = None
    _HAS_BUTTON_CLASS = False
