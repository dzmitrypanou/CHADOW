# -*- coding: utf-8 -*-
from .text import to_scaleform, to_system_message, _as_unicode

_MORE = '__more__'
_CLOSE = '__close__'
DIALOG_TITLE = u'CHADOW: Лимит боёв (сессионный)'

_settings_dialog_open = False
_checkbox_dialog_patched = False
_active_settings_dialog = None
_reopening_settings_dialog = False


def _close_active_settings_dialog():
    global _active_settings_dialog
    dialog = _active_settings_dialog
    _active_settings_dialog = None
    if dialog is None:
        return
    try:
        dialog._chadow_dialog_handled = True
    except Exception:
        pass
    try:
        if hasattr(dialog, 'destroy'):
            dialog.destroy()
    except Exception:
        pass


def mark_settings_dialog_closed():
    global _settings_dialog_open, _active_settings_dialog
    _settings_dialog_open = False
    _active_settings_dialog = None


def is_settings_reopening():
    return _reopening_settings_dialog


def _patch_checkbox_dialog():
    global _checkbox_dialog_patched
    if _checkbox_dialog_patched:
        return
    try:
        from gui.Scaleform.daapi.view.dialogs.CheckBoxDialog import CheckBoxDialog as CheckBoxDialogView
    except ImportError:
        try:
            import gui.Scaleform.daapi.view.dialogs.CheckBoxDialog as _checkbox_module
            CheckBoxDialogView = _checkbox_module.CheckBoxDialog
        except Exception:
            return

    _orig_call_handler = CheckBoxDialogView._callHandler
    _orig_on_window_close = CheckBoxDialogView.onWindowClose
    _orig_submit = CheckBoxDialogView.submit
    _orig_init = CheckBoxDialogView.__init__

    def __init__(self, meta, handler):
        _orig_init(self, meta, handler)
        global _active_settings_dialog
        if _settings_dialog_open:
            _active_settings_dialog = self

    def _call_handler(self, success, selected):
        if _settings_dialog_open:
            action = 'accept' if success is True else 'close'
            if self.handler:
                self.handler((action, selected))
            return
        _orig_call_handler(self, success, selected)

    def on_window_close(self):
        global _active_settings_dialog
        if getattr(self, '_chadow_dialog_handled', False):
            try:
                self.destroy()
            except Exception:
                pass
            if _active_settings_dialog is self:
                _active_settings_dialog = None
            return
        if _settings_dialog_open:
            if self.handler:
                self.handler(('close', self.meta.getCheckBoxSelected()))
            self._chadow_dialog_handled = True
            if _active_settings_dialog is self:
                _active_settings_dialog = None
            self.destroy()
            return
        _orig_on_window_close(self)

    def submit(self, selected):
        if _settings_dialog_open:
            self._chadow_dialog_handled = True
            if self.handler:
                self.handler(('accept', selected))
            return
        _orig_submit(self, selected)

    def cancel(self, selected):
        if _settings_dialog_open:
            self._chadow_dialog_handled = True
            if self.handler:
                self.handler(('reset', selected))
            return
        on_window_close(self)

    CheckBoxDialogView.__init__ = __init__
    CheckBoxDialogView._callHandler = _call_handler
    CheckBoxDialogView.onWindowClose = on_window_close
    CheckBoxDialogView.submit = submit
    CheckBoxDialogView.cancel = cancel
    _checkbox_dialog_patched = True


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


def schedule_settings_dialog_reopen(callback, close_active=False):
    global _reopening_settings_dialog
    _reopening_settings_dialog = True
    if close_active:
        _close_active_settings_dialog()
        mark_settings_dialog_closed()

    def _run_settings_dialog_reopen():
        global _reopening_settings_dialog
        _reopening_settings_dialog = False
        try:
            callback()
        except Exception as error:
            print('[chadow.battle_limit] settings dialog reopen failed: %s' % error)

    try:
        import BigWorld
        BigWorld.callback(0.08, _run_settings_dialog_reopen)
    except Exception:
        _run_settings_dialog_reopen()


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
    global _settings_dialog_open, _reopening_settings_dialog

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
    _close_active_settings_dialog()
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
