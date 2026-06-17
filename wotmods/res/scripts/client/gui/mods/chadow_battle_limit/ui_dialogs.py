# -*- coding: utf-8 -*-
from .text import to_scaleform, to_system_message, _as_unicode

_MORE = '__more__'
_CLOSE = '__close__'
DIALOG_TITLE = u'CHADOW: Лимит боёв'

_settings_dialog_open = False
_checkbox_dialog_patched = False


def _patch_checkbox_dialog():
    global _checkbox_dialog_patched
    if _checkbox_dialog_patched:
        return
    try:
        from gui.Scaleform.daapi.view.dialogs import CheckBoxDialog
    except Exception:
        return

    _orig_call_handler = CheckBoxDialog._callHandler
    _orig_on_window_close = CheckBoxDialog.onWindowClose
    _orig_submit = CheckBoxDialog.submit

    def _call_handler(self, success, selected):
        if _settings_dialog_open:
            action = 'accept' if success is True else 'close'
            if self.handler:
                self.handler((action, selected))
            return
        _orig_call_handler(self, success, selected)

    def on_window_close(self):
        if _settings_dialog_open:
            if self.handler:
                self.handler(('close', self.meta.getCheckBoxSelected()))
            self.destroy()
            return
        _orig_on_window_close(self)

    def submit(self, selected):
        if _settings_dialog_open:
            if self.handler:
                self.handler(('accept', selected))
            self.destroy()
            return
        _orig_submit(self, selected)

    def cancel(self, selected):
        if _settings_dialog_open:
            if self.handler:
                self.handler(('reset', selected))
            self.destroy()
            return
        on_window_close(self)

    CheckBoxDialog._callHandler = _call_handler
    CheckBoxDialog.onWindowClose = on_window_close
    CheckBoxDialog.submit = submit
    CheckBoxDialog.cancel = cancel
    _checkbox_dialog_patched = True


def mark_settings_dialog_closed():
    global _settings_dialog_open
    _settings_dialog_open = False


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
            scope=ScopeTemplates.VIEW_SCOPE,
        )
    except Exception:
        return None


try:
    from gui.Scaleform.daapi.view.dialogs import CheckBoxDialogMeta, ConfirmDialogButtons, SimpleDialogMeta
    from gui.Scaleform.framework import ScopeTemplates

    class ChadowSettingsDialogMeta(CheckBoxDialogMeta):
        def __init__(self, title, message, submit_label, cancel_label, checkbox_label, checkbox_selected):
            scope = ScopeTemplates.VIEW_SCOPE
            buttons = ConfirmDialogButtons(to_scaleform(submit_label), to_scaleform(cancel_label))
            self._inner = SimpleDialogMeta(
                to_scaleform(title),
                to_scaleform(message),
                buttons,
                scope=scope,
            )
            self._submit_label = to_scaleform(submit_label)
            self._cancel_label = to_scaleform(cancel_label)
            self._checkbox_label = to_scaleform(checkbox_label)
            super(ChadowSettingsDialogMeta, self).__init__(
                'chadow_battle_limit',
                None,
                None,
                self._inner,
                None,
                scope,
                bool(checkbox_selected),
            )

        def getTitle(self):
            return self._inner.getTitle()

        def getMessage(self):
            return self._inner.getMessage()

        def getButtonsSubmitCancel(self):
            return {
                'submit': self._submit_label,
                'cancel': self._cancel_label,
            }

        def getCheckBoxButtonLabel(self):
            return self._checkbox_label

        def getCheckBoxSelected(self):
            return self._CheckBoxDialogMeta__checkBoxSelected

    _HAS_CHECKBOX_DIALOG = True
except Exception:
    ChadowSettingsDialogMeta = None
    _HAS_CHECKBOX_DIALOG = False


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


def show_settings_dialog(title, message, submit_label, cancel_label, checkbox_label,
                         checkbox_selected, handler, on_dismiss=None):
    global _settings_dialog_open

    def _dispatch(action, selected):
        handler(action, bool(selected))

    if not _HAS_CHECKBOX_DIALOG or ChadowSettingsDialogMeta is None:
        return show_confirm(
            title,
            message,
            (
                ('submit', submit_label),
                ('cancel', cancel_label),
            ),
            lambda choice: _dispatch('accept' if choice == 'submit' else 'reset', checkbox_selected),
            on_cancel=lambda: _dispatch('close', checkbox_selected),
        )

    _patch_checkbox_dialog()
    _settings_dialog_open = True

    meta = ChadowSettingsDialogMeta(
        title,
        message,
        submit_label,
        cancel_label,
        checkbox_label,
        checkbox_selected,
    )

    def _callback(result):
        global _settings_dialog_open
        try:
            if result is None:
                mark_settings_dialog_closed()
                if on_dismiss:
                    on_dismiss()
                return
            if isinstance(result, tuple) and len(result) == 2:
                action, selected = result
                if isinstance(action, bool):
                    action = 'accept' if action else 'close'
                _dispatch(action, selected)
                return
            if result is True:
                _dispatch('accept', checkbox_selected)
                return
            if result is False:
                _dispatch('close', checkbox_selected)
                return
        except Exception as error:
            print('[chadow.battle_limit] settings dialog handler failed: %s' % error)

    try:
        from gui import DialogsInterface
        DialogsInterface.showDialog(meta, _callback)
        return True
    except Exception as error:
        mark_settings_dialog_closed()
        print('[chadow.battle_limit] settings dialog failed: %s' % error)

    return show_confirm(
        title,
        message,
        (
            ('submit', submit_label),
            ('cancel', cancel_label),
        ),
        lambda choice: _dispatch('accept' if choice == 'submit' else 'reset', checkbox_selected),
        on_cancel=lambda: _dispatch('close', checkbox_selected),
    )


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
            page = [remaining[0], (_MORE, u'More...')]

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
    lines = [_as_unicode(message), u'']
    for index, (btn_id, label) in enumerate(buttons, 1):
        lines.append(u'%d) %s' % (index, _as_unicode(label)))
    lines.append(u'')
    lines.append(_as_unicode(
        u'Hotkeys: Alt+Shift+M settings, Alt+Shift+1..9 limit, '
        u'Alt+Shift+0 full block, Alt+Shift+B presets, Alt+Shift+R reset, '
        u'Alt+Shift+N notifications.'
    ))

    from gui import SystemMessages
    from gui.SystemMessages import SM_TYPE
    SystemMessages.pushMessage(
        to_system_message(u'\n'.join(lines)),
        type=SM_TYPE.Information,
        messageData={'header': to_system_message(title)},
    )
