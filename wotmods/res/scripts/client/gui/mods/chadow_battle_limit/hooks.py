from gui.Scaleform.daapi.view.lobby.header.LobbyHeader import LobbyHeader

from chadow_battle_limit.controller import BattleLimitController

_origCheckFightButtonDisabled = LobbyHeader._checkFightButtonDisabled
_origUpdatePrebattleControls = LobbyHeader._updatePrebattleControls

TOOLTIP_BODY = (
    u'Достигнут лимит боёв за сессию (%d/%d).\n'
    u'Alt+Shift+R — сбросить счётчик\n'
    u'Alt+Shift+0 — отключить лимит\n'
    u'Alt+Shift+1..9 — выбрать лимит'
)


def _getController():
    return BattleLimitController.instance


def patchedCheckFightButtonDisabled(self, canDo, isLocked):
    controller = _getController()
    if controller is not None and controller.isLimitReached():
        return True
    return _origCheckFightButtonDisabled(self, canDo, isLocked)


def patchedUpdatePrebattleControls(self, *args, **kwargs):
    result = _origUpdatePrebattleControls(self, *args, **kwargs)
    controller = _getController()
    if controller is None or not controller.isLimitReached():
        return result
    if hasattr(self, 'as_disableFightButtonS'):
        self.as_disableFightButtonS(True)
    if hasattr(self, 'as_setFightBtnTooltipS'):
        tooltip = TOOLTIP_BODY % (controller.battlesPlayed, controller.maxBattles)
        self.as_setFightBtnTooltipS(tooltip, False)
    return result


def install():
    LobbyHeader._checkFightButtonDisabled = patchedCheckFightButtonDisabled
    LobbyHeader._updatePrebattleControls = patchedUpdatePrebattleControls


def uninstall():
    LobbyHeader._checkFightButtonDisabled = _origCheckFightButtonDisabled
    LobbyHeader._updatePrebattleControls = _origUpdatePrebattleControls
