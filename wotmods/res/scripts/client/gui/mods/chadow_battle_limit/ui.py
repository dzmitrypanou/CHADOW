# -*- coding: utf-8 -*-
import Keys

from . import config
from .controller import BattleLimitController
from .text import to_scaleform
from . import ui_dialogs
from .ui_dialogs import DIALOG_TITLE

TAG = config.TAG

try:
    from wg_async import wg_await, wg_async
    from gui.impl.dialogs import dialogs
    from gui.impl.dialogs.builders import WarningDialogBuilder
    from gui.impl.pub.dialog_window import DialogButtons as DButtons
    _HAS_IMPL_DIALOGS = True
except ImportError:
    _HAS_IMPL_DIALOGS = False
    DButtons = None

_settings_active = False
_settings_refreshing = False
_draft_limit = u''
_draft_notifications = True


def is_settings_active():
    return _settings_active


def _initial_draft(controller):
    if controller is None:
        return u''
    if controller.hardBlockRandom:
        return u'0'
    if controller.isActive():
        return unicode(controller.maxBattles)
    return u''


def _draft_display():
    text = _draft_limit.strip()
    if not text:
        return u'_'
    return text


def _status_message(controller):
    if controller is None:
        return u'Мод не инициализирован.'
    if controller.hardBlockRandom:
        return (
            u'Случайные бои полностью заблокированы.\n'
            u'Рейтинговые, клановые и другие режимы доступны.'
        )
    if not controller.isActive():
        return (
            u'Лимит случайных боёв выключен.\n'
            u'Сыграно за сессию: %d.' % controller.battlesPlayed
        )
    remaining = controller.remainingBattles()
    return (
        u'Только случайные бои: %d за сессию.\n'
        u'Сыграно: %d из %d. Осталось: %d.' % (
            controller.maxBattles,
            controller.battlesPlayed,
            controller.maxBattles,
            remaining if remaining is not None else 0,
        )
    )


def _settings_message(controller):
    return u'\n'.join([
        _status_message(controller),
        u'',
        u'Боёв за сессию (0=блок):  [ %s ]' % _draft_display(),
        u'Введите цифры на клавиатуре, затем нажмите «Принять».',
        u'Сброс счётчика: кнопка «Сбросить» или Alt+Shift+R.',
    ])


def format_button_value(controller):
    if controller is None:
        return u'-'
    if controller.hardBlockRandom:
        return u'0'
    if not controller.isActive():
        return u'OFF'
    return u'%d/%d' % (controller.battlesPlayed, controller.maxBattles)


def button_tooltip(controller):
    lines = [
        u'CHADOW: Battles Limit Mode',
        u'Scales icon: settings (Alt+Shift+M)',
    ]
    if controller is None:
        return to_scaleform(u'\n'.join(lines))
    if controller.hardBlockRandom:
        lines.append(u'Random battles fully blocked')
    elif controller.isActive():
        remaining = controller.remainingBattles()
        if remaining is not None:
            lines.append(u'Remaining: %d' % remaining)
    return to_scaleform(u'\n'.join(lines))


def refresh_hangar_widget():
    try:
        from . import ui_hooks
        ui_hooks.refresh_widget()
    except Exception as error:
        print('%s widget refresh failed: %s' % (TAG, error))


def _close_settings_state():
    global _settings_active, _settings_refreshing
    _settings_active = False
    _settings_refreshing = False
    ui_dialogs.mark_settings_dialog_closed()


def _schedule_settings_refresh(controller):
    global _settings_refreshing
    if _settings_refreshing:
        return
    _settings_refreshing = True
    try:
        import BigWorld
        BigWorld.callback(0.05, lambda: _reopen_settings(controller))
    except Exception:
        _reopen_settings(controller)


def _reopen_settings(controller):
    global _settings_refreshing
    _settings_refreshing = False
    if _settings_active and controller is not None:
        _open_settings_scaleform(controller, keep_draft=True)


def handle_settings_key(controller, event):
    global _draft_limit
    if not _settings_active or _settings_refreshing or controller is None:
        return False
    if not event.isKeyDown():
        return False

    key = event.key
    if key == Keys.KEY_ESCAPE:
        _close_settings_state()
        return False

    if key == Keys.KEY_R and event.isAltDown() and event.isShiftDown():
        controller.resetCounter(notify=True)
        refresh_hangar_widget()
        _open_settings_scaleform(controller, keep_draft=False)
        return True

    if key in (Keys.KEY_BACKSPACE, Keys.KEY_DELETE):
        _draft_limit = _draft_limit[:-1]
        _schedule_settings_refresh(controller)
        return True

    top_digits = (
        Keys.KEY_0, Keys.KEY_1, Keys.KEY_2, Keys.KEY_3, Keys.KEY_4,
        Keys.KEY_5, Keys.KEY_6, Keys.KEY_7, Keys.KEY_8, Keys.KEY_9,
    )
    if key in top_digits:
        if len(_draft_limit) >= 3:
            return True
        _draft_limit += unicode(top_digits.index(key))
        _schedule_settings_refresh(controller)
        return True

    for digit in range(10):
        numpad_key = getattr(Keys, 'KEY_NUMPAD%d' % digit, None)
        if numpad_key is not None and key == numpad_key:
            if len(_draft_limit) >= 3:
                return True
            _draft_limit += unicode(digit)
            _schedule_settings_refresh(controller)
            return True

    return False


def _open_settings_scaleform(controller, keep_draft=False):
    global _settings_active, _draft_limit, _draft_notifications

    if controller is None:
        return

    if not keep_draft:
        _draft_limit = _initial_draft(controller)
        _draft_notifications = bool(controller._data.get('showNotifications', True))

    _settings_active = True

    def _on_dismiss():
        if not _settings_refreshing:
            _close_settings_state()

    def _handle(action, notifications_enabled):
        global _draft_notifications
        if _settings_refreshing:
            return

        _draft_notifications = bool(notifications_enabled)

        if action == 'accept':
            controller.setShowNotifications(_draft_notifications, notify=False)
            text = _draft_limit.strip()
            if text:
                controller.applyLimitValue(text, notify=True)
            else:
                controller.disableLimits(notify=True)
            refresh_hangar_widget()
            _open_settings_scaleform(controller, keep_draft=False)
            return

        if action == 'reset':
            controller.setShowNotifications(_draft_notifications, notify=False)
            controller.resetCounter(notify=True)
            refresh_hangar_widget()
            _open_settings_scaleform(controller, keep_draft=False)
            return

        if _settings_refreshing:
            return

        _close_settings_state()

    checkbox_label = u'Notifications: ON' if _draft_notifications else u'Notifications: OFF'

    ui_dialogs.show_settings_dialog(
        DIALOG_TITLE,
        _settings_message(controller),
        u'Принять',
        u'Сбросить',
        checkbox_label,
        _draft_notifications,
        _handle,
        on_dismiss=_on_dismiss,
    )


def _build_dialog(title, message, buttons):
    builder = WarningDialogBuilder()
    builder.setFormattedTitle(to_scaleform(title))
    builder.setFormattedMessage(to_scaleform(message))
    for button_id, label, is_default in buttons:
        builder.addButton(button_id, None, is_default, rawLabel=to_scaleform(label))
    return builder.build(_dialog_parent())


def _dialog_parent():
    try:
        from helpers import dependency
        from skeletons.gui.impl import IGuiLoader
        from frameworks.wulf import WindowLayer
        guiLoader = dependency.instance(IGuiLoader)
        layer = guiLoader.windowsManager.getLayer(WindowLayer.VIEW)
        if layer is not None:
            return layer.getView()
    except Exception:
        pass
    return None


if _HAS_IMPL_DIALOGS:

    @wg_async
    def open_settings_panel(_source=None):
        controller = BattleLimitController.instance
        if controller is None:
            return
        _open_settings_scaleform(controller)

else:

    def open_settings_panel(_source=None):
        controller = BattleLimitController.instance
        if controller is None:
            return
        _open_settings_scaleform(controller)
