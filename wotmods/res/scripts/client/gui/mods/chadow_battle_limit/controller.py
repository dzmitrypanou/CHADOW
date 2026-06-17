import Keys

from PlayerEvents import g_playerEvents
from adisp import adisp_async, adisp_process
from gui import InputHandler, SystemMessages
from gui.SystemMessages import SM_TYPE
from gui.shared import g_eventBus, events, EVENT_BUS_SCOPE
from helpers import dependency
from skeletons.gui.shared.utils import ILobbyContext

from chadow_battle_limit import config

TAG = config.TAG
PRESET_LIMITS = config.PRESET_LIMITS


class BattleLimitController(object):
    instance = None

    def __init__(self):
        self._data = config.load()
        self._lobbyContext = dependency.instance(ILobbyContext)
        self._confirmator = self._confirmFightButtonPress

    @property
    def enabled(self):
        return bool(self._data.get('enabled', True))

    @property
    def maxBattles(self):
        try:
            value = int(self._data.get('maxBattles', 0))
        except (TypeError, ValueError):
            value = 0
        return max(value, 0)

    @property
    def battlesPlayed(self):
        try:
            value = int(self._data.get('battlesPlayed', 0))
        except (TypeError, ValueError):
            value = 0
        return max(value, 0)

    def isActive(self):
        return self.enabled and self.maxBattles > 0

    def isLimitReached(self):
        if not self.isActive():
            return False
        return self.battlesPlayed >= self.maxBattles

    def remainingBattles(self):
        if not self.isActive():
            return None
        return max(self.maxBattles - self.battlesPlayed, 0)

    def setMaxBattles(self, value, notify=True):
        try:
            limit = int(value)
        except (TypeError, ValueError):
            limit = 0
        limit = max(limit, 0)
        self._data['maxBattles'] = limit
        self._data['enabled'] = limit > 0
        config.save(self._data)
        self.refreshFightButton()
        if notify and self._data.get('showNotifications', True):
            if limit <= 0:
                self._notify(u'Лимит боёв отключён. Кнопка «В бой» снова доступна.')
            else:
                self._notify(u'Лимит сессии: %d %s.' % (limit, self._battlesWord(limit)))

    def resetCounter(self, notify=True):
        self._data['battlesPlayed'] = 0
        config.save(self._data)
        self.refreshFightButton()
        if notify and self._data.get('showNotifications', True):
            self._notify(u'Счётчик боёв сброшен.')

    def incrementBattles(self):
        if not self.isActive():
            return
        self._data['battlesPlayed'] = self.battlesPlayed + 1
        config.save(self._data)
        remaining = self.remainingBattles()
        if self._data.get('showNotifications', True):
            if self.isLimitReached():
                self._notify(
                    u'Лимит достигнут (%d/%d). Кнопка «В бой» заблокирована.' % (
                        self.battlesPlayed, self.maxBattles),
                    SM_TYPE.Warning
                )
            else:
                self._notify(
                    u'Сыграно %d из %d. Осталось: %d.' % (
                        self.battlesPlayed, self.maxBattles, remaining)
                )
        self.refreshFightButton()

    def cyclePreset(self):
        if not PRESET_LIMITS:
            return
        current = self.maxBattles
        try:
            index = PRESET_LIMITS.index(current)
            nextIndex = (index + 1) % (len(PRESET_LIMITS) + 1)
        except ValueError:
            nextIndex = 0
        if nextIndex >= len(PRESET_LIMITS):
            self.setMaxBattles(0)
            return
        self.setMaxBattles(PRESET_LIMITS[nextIndex])

    def refreshFightButton(self):
        g_eventBus.handleEvent(
            events.FightButtonEvent(events.FightButtonEvent.FIGHT_BUTTON_UPDATE),
            scope=EVENT_BUS_SCOPE.LOBBY
        )

    def bind(self):
        self._lobbyContext.addFightButtonConfirmator(self._confirmator)
        g_playerEvents.onBattleResultsReceived += self._onBattleResultsReceived
        g_playerEvents.onAccountBecomePlayer += self._onAccountBecomePlayer
        InputHandler.g_instance.onKeyDown += self._onKeyDown

    def unbind(self):
        self._lobbyContext.deleteFightButtonConfirmator(self._confirmator)
        g_playerEvents.onBattleResultsReceived -= self._onBattleResultsReceived
        g_playerEvents.onAccountBecomePlayer -= self._onAccountBecomePlayer
        InputHandler.g_instance.onKeyDown -= self._onKeyDown

    def reloadConfig(self):
        self._data = config.load()
        self.refreshFightButton()

    @adisp_async
    @adisp_process
    def _confirmFightButtonPress(self, callback):
        if self.isLimitReached():
            callback(False)
            return
        callback(True)

    def _onBattleResultsReceived(self, isPlayerVehicle, _results):
        if not isPlayerVehicle:
            return
        self.incrementBattles()

    def _onAccountBecomePlayer(self):
        self.reloadConfig()

    def _onKeyDown(self, event):
        if not event.isKeyDown():
            return
        if not (event.isAltDown() and event.isShiftDown()):
            return
        key = event.key
        if key == Keys.KEY_R:
            self.resetCounter()
            return
        if key == Keys.KEY_B:
            self.cyclePreset()
            return
        digitKeys = (
            Keys.KEY_0, Keys.KEY_1, Keys.KEY_2, Keys.KEY_3, Keys.KEY_4,
            Keys.KEY_5, Keys.KEY_6, Keys.KEY_7, Keys.KEY_8, Keys.KEY_9,
        )
        if key not in digitKeys:
            return
        digit = digitKeys.index(key)
        if digit == 0:
            self.setMaxBattles(0)
            return
        if 1 <= digit <= 9:
            self.setMaxBattles(digit)

    def _notify(self, text, messageType=SM_TYPE.Information):
        SystemMessages.pushMessage(
            text,
            type=messageType,
            messageData={'header': u'Chadow: лимит боёв'}
        )

    @staticmethod
    def _battlesWord(count):
        remainder100 = count % 100
        remainder10 = count % 10
        if 11 <= remainder100 <= 14:
            return u'боёв'
        if remainder10 == 1:
            return u'бой'
        if 2 <= remainder10 <= 4:
            return u'боя'
        return u'боёв'
