# -*- coding: utf-8 -*-
import BigWorld
from PlayerEvents import g_playerEvents
from gui.shared import g_eventBus, events, EVENT_BUS_SCOPE

from . import config
from .controller import BattleLimitController
from . import ui

TAG = config.TAG
_patches = []
_messenger_bar = None
_refresh_callback = None


def _get_controller():
    return BattleLimitController.instance


def _patch_method(cls, method_name, patch_builder):
    if cls is None or not hasattr(cls, method_name):
        return False
    original = getattr(cls, method_name)

    def patched(self, *args, **kwargs):
        return patch_builder(self, original, *args, **kwargs)

    setattr(cls, method_name, patched)
    _patches.append((cls, method_name, original))
    return True


def refresh_widget():
    global _messenger_bar
    controller = _get_controller()
    if controller is None:
        return
    bar = _messenger_bar or _find_messenger_bar()
    if bar is None:
        return
    _messenger_bar = bar
    value = ui.format_button_value(controller)
    tooltip = ui.button_tooltip(controller)
    try:
        if hasattr(bar, 'as_setSessionStatsButtonVisibleS'):
            bar.as_setSessionStatsButtonVisibleS(True)
        if hasattr(bar, 'as_setSessionStatsButtonSettingsUpdateS'):
            bar.as_setSessionStatsButtonSettingsUpdateS(True, value)
        if hasattr(bar, 'as_setSessionStatsButtonEnableS'):
            bar.as_setSessionStatsButtonEnableS(True, tooltip)
    except Exception as error:
        print('%s widget update failed: %s' % (TAG, error))


def _find_messenger_bar():
    try:
        from helpers import dependency
        from skeletons.gui.impl import IGuiLoader
        from gui.Scaleform.daapi.settings.views import VIEW_ALIAS
        guiLoader = dependency.instance(IGuiLoader)
        hangar = guiLoader.windowsManager.getView(VIEW_ALIAS.LOBBY_HANGAR)
        if hangar is None:
            return None
        if hasattr(hangar, 'components'):
            component = hangar.components.get('messangerBar') or hangar.components.get('messengerBar')
            if component is not None:
                return component
        if hasattr(hangar, 'getComponent'):
            for alias in ('messangerBar', 'messengerBar'):
                try:
                    component = hangar.getComponent(alias)
                except Exception:
                    component = None
                if component is not None:
                    return component
    except Exception:
        pass
    return None


def _session_stats_click_patch(self, original, *args, **kwargs):
    ui.open_settings_panel(self)
    return None


def _populate_patch(self, original, *args, **kwargs):
    global _messenger_bar
    result = original(self, *args, **kwargs)
    _messenger_bar = self
    refresh_widget()
    return result


def _init_data_patch(self, original, data, *args, **kwargs):
    result = original(self, data, *args, **kwargs)
    refresh_widget()
    return result


def _fight_button_update(_event=None):
    refresh_widget()


def _on_account_become_player():
    _schedule_refresh_loop()
    BigWorld.callback(1.0, refresh_widget)
    BigWorld.callback(3.0, refresh_widget)


def _schedule_refresh_loop():
    global _refresh_callback
    _cancel_refresh_loop()

    def _tick():
        global _refresh_callback
        refresh_widget()
        _refresh_callback = BigWorld.callback(2.0, _tick)

    _tick()


def _cancel_refresh_loop():
    global _refresh_callback
    if _refresh_callback is not None:
        BigWorld.cancelCallback(_refresh_callback)
        _refresh_callback = None


def _update_session_stats_btn_patch(self, original, *args, **kwargs):
    global _messenger_bar
    result = original(self, *args, **kwargs)
    _messenger_bar = self
    refresh_widget()
    return result


def _install_messenger_bar():
    candidates = (
        ('gui.Scaleform.daapi.view.lobby.messengerBar.messenger_bar', 'MessengerBar'),
        ('gui.Scaleform.daapi.view.lobby.messengerBar.MessengerBar', 'MessengerBar'),
        ('gui.Scaleform.daapi.view.lobby.messenger_bar.MessengerBar', 'MessengerBar'),
    )
    installed = False
    for module_path, class_name in candidates:
        try:
            module = __import__(module_path, fromlist=[class_name])
            cls = getattr(module, class_name)
        except Exception:
            continue
        patched = False
        if _patch_method(cls, 'sessionStatsButtonClick', _session_stats_click_patch):
            patched = True
        if _patch_method(cls, '_MessengerBar__updateSessionStatsBtn', _update_session_stats_btn_patch):
            patched = True
        if _patch_method(cls, '_populate', _populate_patch):
            patched = True
        if _patch_method(cls, 'as_setInitDataS', _init_data_patch):
            patched = True
        if patched:
            installed = True
            print('%s hangar widget hook installed: %s.%s' % (TAG, module_path, class_name))
            break

    if not installed:
        return False

    try:
        from gui.Scaleform.daapi.view.lobby.messengerBar.session_stats_button import SessionStatsButton
        if _patch_method(SessionStatsButton, '_SessionStatsButton__updateBatteleCount', _populate_patch):
            print('%s session stats button hook installed' % TAG)
    except Exception as error:
        print('%s session stats button hook skipped: %s' % (TAG, error))

    return True


def _make_presenter_patch(method_name):
    def _presenter_patch(self, original, *args, **kwargs):
        result = original(self, *args, **kwargs)
        refresh_widget()
        return result
    return _presenter_patch


def _install_gameface_presenters():
    candidates = (
        ('gui.impl.lobby.page.session_stats_presenter', 'SessionStatsPresenter', '_updateModel'),
        ('gui.impl.lobby.hangar.sub_views.session_stats.session_stats_presenter', 'SessionStatsPresenter', '_updateModel'),
    )
    installed = False
    for module_path, class_name, method_name in candidates:
        try:
            module = __import__(module_path, fromlist=[class_name])
            cls = getattr(module, class_name)
        except Exception:
            continue
        if _patch_method(cls, method_name, _make_presenter_patch(method_name)):
            installed = True
            print('%s gameface widget hook installed: %s.%s' % (TAG, module_path, class_name))
    return installed


def install():
    installed = _install_messenger_bar()
    if not installed:
        installed = _install_gameface_presenters()
    g_eventBus.addListener(
        events.FightButtonEvent.FIGHT_BUTTON_UPDATE,
        _fight_button_update,
        scope=EVENT_BUS_SCOPE.LOBBY,
    )
    g_playerEvents.onAccountBecomePlayer += _on_account_become_player
    _schedule_refresh_loop()
    if not installed:
        print('%s hangar widget hook skipped; counter may appear after reload' % TAG)


def uninstall():
    global _messenger_bar
    _cancel_refresh_loop()
    g_eventBus.removeListener(
        events.FightButtonEvent.FIGHT_BUTTON_UPDATE,
        _fight_button_update,
        scope=EVENT_BUS_SCOPE.LOBBY,
    )
    g_playerEvents.onAccountBecomePlayer -= _on_account_become_player
    for cls, method_name, original in reversed(_patches):
        setattr(cls, method_name, original)
    del _patches[:]
    _messenger_bar = None
