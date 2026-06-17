# -*- coding: utf-8 -*-
from .text import to_scaleform, to_system_message

_MORE = '__more__'
_CLOSE = '__close__'
DIALOG_TITLE = u'CHADOW: Battles Limit Mode'


def _make_buttons(submit_label, close_label):
    try:
        from gui.Scaleform.daapi.view.dialogs import ConfirmDialogButtons
        return ConfirmDialogButtons(to_scaleform(submit_label), to_scaleform(close_label))
    except Exception:
        return None


def _make_meta(title, message, buttons_meta):
    try:
        from gui.Scaleform.daapi.view.dialogs import SimpleDialogMeta
        from gui.Scaleform.framework import ScopeTemplates
        return SimpleDialogMeta(
            to_scaleform(title),
            to_scaleform(message),
            buttons_meta,
            scope=ScopeTemplates.LOBBY_SUB_SCOPE,
        )
    except Exception as error:
        print('[chadow.battle_limit] dialog meta failed: %s' % error)
        return None


def show_confirm(title, message, buttons, handler, on_cancel=None):
    if len(buttons) < 1:
        return False

    submit_id, submit_label = buttons[0]
    if len(buttons) > 1:
        close_id, close_label = buttons[1]
    else:
        close_id, close_label = _CLOSE, u'Close'

    buttons_meta = _make_buttons(submit_label, close_label)
    meta = _make_meta(title, message, buttons_meta) if buttons_meta is not None else None
    if meta is None:
        show_menu(title, message, buttons, handler)
        return False

    close_is_cancel = close_id in (_CLOSE, 'close', 'chadow_close')

    def _callback(result):
        try:
            if result is None:
                if on_cancel:
                    on_cancel()
                return
            if result is True:
                handler(submit_id)
                return
            if result is False:
                if close_is_cancel:
                    if on_cancel:
                        on_cancel()
                else:
                    handler(close_id)
                return
        except Exception as error:
            print('[chadow.battle_limit] dialog handler failed: %s' % error)

    try:
        from gui import DialogsInterface
        DialogsInterface.showDialog(meta, _callback)
        return True
    except Exception as error:
        print('[chadow.battle_limit] confirm dialog failed: %s' % error)

    show_menu(title, message, buttons, handler)
    return False


def show_choice(title, message, buttons, handler, on_cancel=None):
    items = list(buttons)

    def _show_page(start):
        remaining = items[start:]
        if not remaining:
            return

        if len(remaining) == 1:
            page = [remaining[0], (_CLOSE, u'Close')]
        elif len(remaining) == 2:
            page = list(remaining)
        else:
            page = [remaining[0], (_MORE, u'Ещё…')]

        page_message = message if start == 0 else u''

        def _on_pick(choice):
            if choice == _MORE:
                _show_page(start + 1)
                return
            if choice in (_CLOSE, 'close', 'chadow_close'):
                return
            handler(choice)

        show_confirm(title, page_message, page, _on_pick, on_cancel=on_cancel)

    if not items:
        return
    _show_page(0)


def show_menu(title, message, buttons, handler):
    lines = [to_system_message(message), '']
    for index, (btn_id, label) in enumerate(buttons, 1):
        lines.append('%d) %s' % (index, to_system_message(label)))
    lines.append('')
    lines.append(to_system_message(
        u'Hotkeys: Alt+Shift+M — settings, Alt+Shift+1..9 — limit, '
        u'Alt+Shift+0 — full ban, Alt+Shift+B — presets, Alt+Shift+R — reset.'
    ))

    from gui import SystemMessages
    from gui.SystemMessages import SM_TYPE
    SystemMessages.pushMessage(
        u'\n'.join(lines),
        type=SM_TYPE.Information,
        messageData={'header': to_system_message(title)},
    )
