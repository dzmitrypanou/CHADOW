# -*- coding: utf-8 -*-
from . import config
from .controller import BattleLimitController
from .text import to_scaleform, to_system_message
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

BTN_LIMIT = 'chadow_limit'
BTN_RESET = 'chadow_reset'
BTN_NOTIFY = 'chadow_notify'
BTN_BLOCK = 'chadow_block'
BTN_OFF = 'chadow_off'
BTN_BAN = 'chadow_ban'
BTN_CUSTOM = 'chadow_custom'
BTN_CLOSE = DButtons.CANCEL if _HAS_IMPL_DIALOGS else 'close'

_LIMIT_CHOICES = (
    (BTN_CUSTOM, u'Ввести вручную'),
    (1, u'1 бой'),
    (3, u'3 боя'),
    (5, u'5 боёв'),
    (10, u'10 боёв'),
    (15, u'15 боёв'),
    (20, u'20 боёв'),
    (30, u'30 боёв'),
    (50, u'50 боёв'),
    (BTN_BAN, u'0 — полный запрет'),
    (BTN_OFF, u'Выкл'),
    (BTN_CLOSE, u'Close'),
)


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


def _battles_word(count):
    remainder100 = count % 100
    remainder10 = count % 10
    if 11 <= remainder100 <= 14:
        return u'боёв'
    if remainder10 == 1:
        return u'бой'
    if 2 <= remainder10 <= 4:
        return u'боя'
    return u'боёв'


def _status_message(controller):
    if controller is None:
        return u'Мод не инициализирован.'
    if controller.hardBlockRandom:
        return (
            u'Случайный бой полностью заблокирован (0 боёв).\n'
            u'Рейтинговые, клановые и другие режимы доступны.'
        )
    if not controller.isActive():
        return (
            u'Лимит случайных боёв отключён.\n'
            u'Сыграно в сессии: %d.' % controller.battlesPlayed
        )
    remaining = controller.remainingBattles()
    return (
        u'Только случайный бой: %d %s за сессию.\n'
        u'Сыграно: %d из %d.\n'
        u'Осталось: %d.' % (
            controller.maxBattles,
            _battles_word(controller.maxBattles),
            controller.battlesPlayed,
            controller.maxBattles,
            remaining if remaining is not None else 0,
        )
    )


def _notify_state(controller):
    if controller is None:
        return u'Уведомления'
    enabled = bool(controller._data.get('showNotifications', True))
    return u'Уведомления: %s' % (u'вкл' if enabled else u'выкл')


def _block_state(controller):
    if controller is None:
        return u'Запрет случайного'
    return u'Запрет случайного: %s' % (u'вкл' if controller.hardBlockRandom else u'выкл')


def format_button_value(controller):
    if controller is None:
        return u'—'
    if controller.hardBlockRandom:
        return u'0'
    if not controller.isActive():
        return u'∞'
    return u'%d/%d' % (controller.battlesPlayed, controller.maxBattles)


def button_tooltip(controller):
    lines = [
        u'CHADOW: Battles Limit Mode',
        u'Кнопка слева от статистики — настройки (Alt+Shift+M)',
    ]
    if controller is None:
        return to_scaleform(u'\n'.join(lines))
    if controller.hardBlockRandom:
        lines.append(u'Случайный бой заблокирован полностью (0 боёв)')
        return to_scaleform(u'\n'.join(lines))
    if controller.isActive():
        remaining = controller.remainingBattles()
        if remaining is not None:
            lines.append(u'Осталось: %d' % remaining)
    return to_scaleform(u'\n'.join(lines))


def refresh_hangar_widget():
    try:
        from . import ui_hooks
        ui_hooks.refresh_widget()
    except Exception as error:
        print('%s widget refresh failed: %s' % (TAG, error))


def _apply_limit(controller, value):
    if controller is None:
        return
    if value == BTN_CUSTOM:
        controller.startManualLimitInput(on_applied=refresh_hangar_widget)
        return
    if value == BTN_BAN:
        controller.enableHardBlock(notify=True)
    elif value == BTN_OFF:
        controller.disableLimits(notify=True)
    else:
        controller.setMaxBattles(value, notify=True)
    refresh_hangar_widget()


def _toggle_notifications(controller):
    if controller is None:
        return
    current = bool(controller._data.get('showNotifications', True))
    controller._data['showNotifications'] = not current
    config.save(controller._data)


def _toggle_hard_block(controller):
    if controller is None:
        return
    controller.setHardBlockRandom(not controller.hardBlockRandom, notify=True)
    refresh_hangar_widget()


def _build_dialog(title, message, buttons):
    builder = WarningDialogBuilder()
    builder.setFormattedTitle(to_scaleform(title))
    builder.setFormattedMessage(to_scaleform(message))
    for button_id, label, is_default in buttons:
        builder.addButton(button_id, None, is_default, rawLabel=to_scaleform(label))
    return builder.build(_dialog_parent())


def _open_settings_scaleform(controller):
    def _handle_main(choice):
        if choice in (BTN_CLOSE, 'close', 'chadow_close'):
            return
        if choice == BTN_LIMIT:
            _open_limit_picker_scaleform(controller)
            return
        if choice == BTN_RESET and controller is not None:
            controller.resetCounter(notify=True)
            refresh_hangar_widget()
            _open_settings_scaleform(controller)
            return
        if choice == BTN_BLOCK:
            _toggle_hard_block(controller)
            _open_settings_scaleform(controller)
            return
        if choice == BTN_NOTIFY:
            _toggle_notifications(controller)
            _open_settings_scaleform(controller)
            return

    ui_dialogs.show_choice(
        DIALOG_TITLE,
        _status_message(controller),
        (
            (BTN_LIMIT, u'Сменить лимит'),
            (BTN_RESET, u'Сбросить счётчик'),
            (BTN_BLOCK, _block_state(controller)),
            (BTN_NOTIFY, _notify_state(controller)),
            (BTN_CLOSE, u'Close'),
        ),
        _handle_main,
    )


def _open_limit_picker_scaleform(controller):
    def _handle_limit(choice):
        if choice in (BTN_CLOSE, 'close', 'chadow_close'):
            return
        if choice in (BTN_OFF, BTN_BAN, BTN_CUSTOM) or isinstance(choice, (int, long)):
            _apply_limit(controller, choice)
            if choice != BTN_CUSTOM:
                _open_settings_scaleform(controller)
            return
        try:
            _apply_limit(controller, int(choice))
            _open_settings_scaleform(controller)
        except (TypeError, ValueError):
            return

    ui_dialogs.show_choice(
        DIALOG_TITLE,
        u'Выберите максимум случайных боёв за сессию или введите вручную.',
        _LIMIT_CHOICES,
        _handle_limit,
    )


if _HAS_IMPL_DIALOGS:

    @wg_async
    def _show_limit_picker(controller):
        buttons = []
        for index, (value, label) in enumerate(_LIMIT_CHOICES):
            if value == BTN_CLOSE:
                continue
            buttons.append((value, label, index == 0))
        buttons.append((BTN_CLOSE, u'Close', False))
        result = yield wg_await(dialogs.show(_build_dialog(
            DIALOG_TITLE,
            u'Выберите максимум случайных боёв за сессию или введите вручную.',
            buttons,
        )))
        choice = getattr(result, 'result', None)
        if choice in (None, BTN_CLOSE, DButtons.CANCEL):
            return
        if choice == BTN_CUSTOM:
            _apply_limit(controller, choice)
            return
        if choice in (BTN_OFF, BTN_BAN):
            _apply_limit(controller, choice)
            return
        try:
            limit = int(choice)
        except (TypeError, ValueError):
            return
        _apply_limit(controller, limit)

    @wg_async
    def open_settings_panel(_source=None):
        controller = BattleLimitController.instance
        while True:
            result = yield wg_await(dialogs.show(_build_dialog(
                DIALOG_TITLE,
                _status_message(controller),
                (
                    (BTN_LIMIT, u'Сменить лимит', True),
                    (BTN_RESET, u'Сбросить счётчик', False),
                    (BTN_BLOCK, _block_state(controller), False),
                    (BTN_NOTIFY, _notify_state(controller), False),
                    (BTN_CLOSE, u'Close', False),
                ),
            )))
            choice = getattr(result, 'result', None)
            if choice in (None, BTN_CLOSE, DButtons.CANCEL):
                return
            if choice == BTN_LIMIT:
                yield wg_await(_show_limit_picker(controller))
                continue
            if choice == BTN_RESET:
                if controller is not None:
                    controller.resetCounter(notify=True)
                    refresh_hangar_widget()
                continue
            if choice == BTN_BLOCK:
                _toggle_hard_block(controller)
                continue
            if choice == BTN_NOTIFY:
                _toggle_notifications(controller)
                continue
            return

else:

    def open_settings_panel(_source=None):
        controller = BattleLimitController.instance
        if controller is None:
            return
        _open_settings_scaleform(controller)
