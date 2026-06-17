import Keys

from PlayerEvents import g_playerEvents
from adisp import adisp_async, adisp_process
from gui import InputHandler, SystemMessages
from gui.SystemMessages import SM_TYPE
from gui.shared import g_eventBus, events, EVENT_BUS_SCOPE

from . import config
from .compat import is_random_queue, lobby_context_instance
from .text import to_scaleform, to_system_message, to_system_message_bytes

PRESET_LIMITS = config.PRESET_LIMITS


class BattleLimitController(object):
    instance = None

    def __init__(self):
        self._data = config.load()
        self._lobbyContext = None
        self._lobbyBound = False
        self._confirmator = self._confirmFightButtonPress
        self._lastBattleQueue = None
        self._limitInputActive = False
        self._limitInputBuffer = u''
        self._limitInputOnApplied = None

    @property
    def enabled(self):
        return bool(self._data.get('enabled', True))

    @property
    def randomOnly(self):
        return bool(self._data.get('randomOnly', True))

    @property
    def hardBlockRandom(self):
        return bool(self._data.get('hardBlockRandom', False))

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
        return self.enabled and self.maxBattles > 0 and not self.hardBlockRandom

    def appliesToCurrentQueue(self):
        if not self.randomOnly:
            return True
        return is_random_queue()

    def shouldBlockFight(self):
        if not self.appliesToCurrentQueue():
            return False
        if self.hardBlockRandom:
            return True
        return self.isLimitReached()

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
        if limit > 0:
            self._data['hardBlockRandom'] = False
        config.save(self._data)
        self.refreshFightButton()
        self._refreshHangarWidget()
        if notify and self._data.get('showNotifications', True):
            if limit <= 0 and not self.hardBlockRandom:
                self._notify(u'Лимит боёв отключён. Случайный бой снова доступен.')
            else:
                self._notify(u'Лимит сессии: %d %s (только случайный бой).' % (
                    limit, self._battlesWord(limit)))

    def enableHardBlock(self, notify=True):
        self._data['hardBlockRandom'] = True
        self._data['enabled'] = True
        self._data['maxBattles'] = 0
        config.save(self._data)
        self.refreshFightButton()
        self._refreshHangarWidget()
        if notify and self._data.get('showNotifications', True):
            self._notify(
                u'Случайный бой заблокирован (0 боёв). Другие режимы доступны.',
                SM_TYPE.Warning,
            )

    def disableLimits(self, notify=True):
        self._data['hardBlockRandom'] = False
        self._data['maxBattles'] = 0
        self._data['enabled'] = False
        config.save(self._data)
        self.refreshFightButton()
        self._refreshHangarWidget()
        if notify and self._data.get('showNotifications', True):
            self._notify(u'Лимит боёв отключён. Случайный бой снова доступен.')

    def setHardBlockRandom(self, enabled, notify=True):
        if enabled:
            self.enableHardBlock(notify=notify)
            return
        if self._data.get('hardBlockRandom'):
            self.disableLimits(notify=notify)
            return
        self._data['hardBlockRandom'] = False
        config.save(self._data)
        self.refreshFightButton()
        self._refreshHangarWidget()
        if notify and self._data.get('showNotifications', True):
            self._notify(u'Полный запрет случайного боя снят.')

    def resetCounter(self, notify=True):
        self._data['battlesPlayed'] = 0
        config.save(self._data)
        self.refreshFightButton()
        self._refreshHangarWidget()
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
                    u'Лимит достигнут (%d/%d). Случайный бой заблокирован.' % (
                        self.battlesPlayed, self.maxBattles),
                    SM_TYPE.Warning
                )
            else:
                self._notify(
                    u'Случайный бой: %d из %d. Осталось: %d.' % (
                        self.battlesPlayed, self.maxBattles, remaining)
                )
        self.refreshFightButton()
        self._refreshHangarWidget()

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
            self.disableLimits()
            return
        self.setMaxBattles(PRESET_LIMITS[nextIndex])

    def refreshFightButton(self):
        g_eventBus.handleEvent(
            events.FightButtonEvent(events.FightButtonEvent.FIGHT_BUTTON_UPDATE),
            scope=EVENT_BUS_SCOPE.LOBBY
        )

    def _ensureLobbyBind(self):
        if self._lobbyBound:
            return True
        try:
            lobby = lobby_context_instance()
            lobby.addFightButtonConfirmator(self._confirmator)
            self._lobbyContext = lobby
            self._lobbyBound = True
            return True
        except Exception as error:
            print('%s lobby bind pending: %s' % (config.TAG, error))
            return False

    def bind(self):
        self._ensureLobbyBind()
        g_playerEvents.onBattleResultsReceived += self._onBattleResultsReceived
        g_playerEvents.onAccountBecomePlayer += self._onAccountBecomePlayer
        g_playerEvents.onAvatarBecomePlayer += self._onAvatarBecomePlayer
        InputHandler.g_instance.onKeyDown += self._onKeyDown
        InputHandler.g_instance.onKeyUp += self._onKeyUp

    def unbind(self):
        if self._lobbyBound and self._lobbyContext is not None:
            try:
                self._lobbyContext.deleteFightButtonConfirmator(self._confirmator)
            except Exception:
                pass
        self._lobbyContext = None
        self._lobbyBound = False
        g_playerEvents.onBattleResultsReceived -= self._onBattleResultsReceived
        g_playerEvents.onAccountBecomePlayer -= self._onAccountBecomePlayer
        g_playerEvents.onAvatarBecomePlayer -= self._onAvatarBecomePlayer
        InputHandler.g_instance.onKeyDown -= self._onKeyDown
        InputHandler.g_instance.onKeyUp -= self._onKeyUp

    def reloadConfig(self):
        self._data = config.load()
        self.refreshFightButton()
        self._refreshHangarWidget()

    @staticmethod
    def _refreshHangarWidget():
        try:
            from .ui import refresh_hangar_widget
            refresh_hangar_widget()
        except Exception:
            pass

    @adisp_async
    @adisp_process
    def _confirmFightButtonPress(self, callback):
        if self.shouldBlockFight():
            callback(False)
            return
        callback(True)

    def _shouldCountBattle(self):
        if not self.randomOnly:
            return True
        return is_random_queue(self._lastBattleQueue)

    def _onBattleResultsReceived(self, isPlayerVehicle, _results):
        if not isPlayerVehicle:
            return
        if not self._shouldCountBattle():
            return
        self.incrementBattles()

    def _onAvatarBecomePlayer(self):
        try:
            from .compat import get_queue_type
            self._lastBattleQueue = get_queue_type()
        except Exception:
            self._lastBattleQueue = None

    def _onAccountBecomePlayer(self):
        config.refreshGameRoot()
        self._ensureLobbyBind()
        self.reloadConfig()

    def startManualLimitInput(self, on_applied=None):
        self._limitInputActive = True
        self._limitInputBuffer = u''
        self._limitInputOnApplied = on_applied
        self._notify(
            u'Введите лимит цифрами (1–999). Enter — применить, Esc — отмена.',
        )

    def cancelManualLimitInput(self, notify=False):
        self._limitInputActive = False
        self._limitInputBuffer = u''
        self._limitInputOnApplied = None
        if notify:
            self._notify(u'Ввод лимита отменён.')

    def _handleManualLimitInput(self, event):
        if not self._limitInputActive:
            return False
        key = event.key
        if key == Keys.KEY_ESCAPE:
            self.cancelManualLimitInput(notify=True)
            return True
        if key in (Keys.KEY_RETURN, getattr(Keys, 'KEY_NUMPADENTER', Keys.KEY_RETURN)):
            text = self._limitInputBuffer.strip()
            callback = self._limitInputOnApplied
            self.cancelManualLimitInput()
            if not text:
                self._notify(u'Лимит не задан.')
                return True
            try:
                limit = int(text)
            except (TypeError, ValueError):
                self._notify(u'Некорректное число.')
                return True
            limit = max(min(limit, 999), 1)
            self.setMaxBattles(limit)
            if callback:
                try:
                    callback()
                except Exception:
                    pass
            return True
        if key in (Keys.KEY_BACKSPACE, Keys.KEY_DELETE):
            self._limitInputBuffer = self._limitInputBuffer[:-1]
            return True
        top_digits = (
            Keys.KEY_0, Keys.KEY_1, Keys.KEY_2, Keys.KEY_3, Keys.KEY_4,
            Keys.KEY_5, Keys.KEY_6, Keys.KEY_7, Keys.KEY_8, Keys.KEY_9,
        )
        if key in top_digits:
            if len(self._limitInputBuffer) >= 3:
                return True
            self._limitInputBuffer += unicode(top_digits.index(key))
            return True
        numpad = [getattr(Keys, 'KEY_NUMPAD%d' % i, None) for i in range(10)]
        if key in numpad:
            if len(self._limitInputBuffer) >= 3:
                return True
            self._limitInputBuffer += unicode(numpad.index(key))
            return True
        return False

    def _onKeyDown(self, event):
        if self._handleManualLimitInput(event):
            return
        if not event.isKeyDown():
            return
        if not (event.isAltDown() and event.isShiftDown()):
            return
        key = event.key
        if key == Keys.KEY_R:
            self.resetCounter()
            return
        if key == Keys.KEY_M:
            try:
                from .ui import open_settings_panel
                open_settings_panel()
            except Exception as error:
                print('%s settings panel failed: %s' % (config.TAG, error))
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
            self.enableHardBlock()
            return
        if 1 <= digit <= 9:
            self.setMaxBattles(digit)

    def _onKeyUp(self, event):
        self._handleManualLimitInput(event)

    def _notify(self, text, messageType=SM_TYPE.Information):
        try:
            from .ui_dialogs import DIALOG_TITLE
            header = DIALOG_TITLE
        except ImportError:
            header = u'CHADOW: Battles Limit Mode'
        SystemMessages.pushMessage(
            to_system_message_bytes(text),
            type=messageType,
            messageData={'header': to_system_message_bytes(header)},
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
