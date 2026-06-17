# -*- coding: utf-8 -*-
from . import config
from .controller import BattleLimitController

TAG = config.TAG

try:
    from wg_async import wg_await, wg_async
    from gui.impl.dialogs import dialogs
    from gui.impl.dialogs.builders import WarningDialogBuilder
    from gui.impl.pub.dialog_window import DialogButtons as DButtons
    _HAS_IMPL_DIALOGS = True
except ImportError:
    _HAS_IMPL_DIALOGS = False

BTN_LIMIT = 'chadow_limit'
BTN_RESET = 'chadow_reset'
BTN_NOTIFY = 'chadow_notify'
BTN_BLOCK = 'chadow_block'
BTN_CLOSE = DButtons.CANCEL if _HAS_IMPL_DIALOGS else 'close'

_LIMIT_PAGES = (
    ((1, u'1 бой'), (3, u'3 боя'), (5, u'5 боёв'), ('more', u'Ещё…')),
    ((10, u'10 боёв'), (15, u'15 боёв'), (20, u'20 боёв'), ('more', u'Ещё…')),
    ((30, u'30 боёв'), (50, u'50 боёв'), (0, u'Выкл'), (BTN_CLOSE, u'Назад')),
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
            u'Случайный бой полностью заблокирован.\n'
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
        return u'БАН'
    if not controller.isActive():
        return u'∞'
    return u'%d/%d' % (controller.battlesPlayed, controller.maxBattles)


def button_tooltip(controller):
    lines = [u'Chadow: лимит случайных боёв', u'Нажмите для настроек']
    if controller is None:
        return u'\n'.join(lines)
    if controller.hardBlockRandom:
        lines.append(u'Случайный бой заблокирован полностью')
        return u'\n'.join(lines)
    if controller.isActive():
        remaining = controller.remainingBattles()
        if remaining is not None:
            lines.append(u'Осталось: %d' % remaining)
    return u'\n'.join(lines)


def refresh_hangar_widget():
    try:
        from . import ui_hooks
        ui_hooks.refresh_widget()
    except Exception as error:
        print('%s widget refresh failed: %s' % (TAG, error))


def _apply_limit(controller, value):
    if controller is None:
        return
    controller.setMaxBattles(value, notify=False)
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
    controller.setHardBlockRandom(not controller.hardBlockRandom, notify=False)


def _build_dialog(title, message, buttons):
    builder = WarningDialogBuilder()
    builder.setFormattedTitle(title)
    builder.setFormattedMessage(message)
    for button_id, label, is_default in buttons:
        builder.addButton(button_id, None, is_default, rawLabel=label)
    return builder.build(_dialog_parent())


if _HAS_IMPL_DIALOGS:

    @wg_async
    def _show_limit_picker(controller):
        page_index = 0
        while True:
            page = _LIMIT_PAGES[page_index]
            buttons = []
            for index, (value, label) in enumerate(page):
                buttons.append((value, label, index == 0))
            result = yield wg_await(dialogs.show(_build_dialog(
                u'Лимит случайных боёв',
                u'Выберите максимум случайных боёв за текущую сессию.',
                buttons,
            )))
            choice = getattr(result, 'result', None)
            if choice in (None, BTN_CLOSE, DButtons.CANCEL):
                return
            if choice == 'more':
                page_index = min(page_index + 1, len(_LIMIT_PAGES) - 1)
                continue
            try:
                limit = int(choice)
            except (TypeError, ValueError):
                return
            _apply_limit(controller, limit)
            return

    @wg_async
    def open_settings_panel(_source=None):
        controller = BattleLimitController.instance
        while True:
            result = yield wg_await(dialogs.show(_build_dialog(
                u'Chadow: лимит боёв',
                _status_message(controller),
                (
                    (BTN_LIMIT, u'Сменить лимит', True),
                    (BTN_RESET, u'Сбросить счётчик', False),
                    (BTN_BLOCK, _block_state(controller), False),
                    (BTN_NOTIFY, _notify_state(controller), False),
                    (BTN_CLOSE, u'Закрыть', False),
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
        from gui import SystemMessages
        from gui.SystemMessages import SM_TYPE
        SystemMessages.pushMessage(
            _status_message(controller) + u'\n\nИспользуйте Alt+Shift+1..9 или Alt+Shift+B.',
            type=SM_TYPE.Information,
            messageData={'header': u'Chadow: лимит боёв'},
        )
