# -*- coding: utf-8 -*-
import BigWorld
from PlayerEvents import g_playerEvents
from gui.shared import g_eventBus, events, EVENT_BUS_SCOPE

from . import config
from .controller import BattleLimitController
from . import ui
from .battle_limit_button import (
    CHADOW_BUTTON_ALIAS,
    ChadowBattleLimitButton,
    counter_value,
    is_chadow_slot_mode,
    open_settings,
    set_chadow_slot_mode,
)
from .text import to_scaleform

TAG = config.TAG
_patches = []
_messenger_bar = None
_refresh_callback = None
_compare_basket = None
_settings_badge_active = False


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


def _get_compare_basket():
    global _compare_basket
    if _compare_basket is not None:
        return _compare_basket
    try:
        from skeletons.gui.game_control import IVehicleComparisonBasket
        from helpers import dependency
        _compare_basket = dependency.instance(IVehicleComparisonBasket)
    except Exception:
        _compare_basket = None
    return _compare_basket


def _compare_cart_busy():
    basket = _get_compare_basket()
    if basket is None:
        return False
    try:
        if basket.getVehiclesCount() > 0:
            return True
    except Exception:
        pass
    return False


def _should_use_chadow_slot():
    return not _compare_cart_busy()


def _find_hangar_component(alias):
    try:
        from helpers import dependency
        from skeletons.gui.impl import IGuiLoader
        from gui.Scaleform.daapi.settings.views import VIEW_ALIAS
        guiLoader = dependency.instance(IGuiLoader)
        hangar = guiLoader.windowsManager.getView(VIEW_ALIAS.LOBBY_HANGAR)
        if hangar is None:
            return None
        if hasattr(hangar, 'components'):
            return hangar.components.get(alias)
        if hasattr(hangar, 'getComponent'):
            try:
                return hangar.getComponent(alias)
            except Exception:
                return None
    except Exception:
        pass
    return None


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


def _refresh_registered_button():
    component = _find_hangar_component(CHADOW_BUTTON_ALIAS)
    if component is not None and hasattr(component, 'refresh'):
        try:
            component.refresh()
            return True
        except Exception:
            pass
    return False


def _refresh_compare_slot_button():
    try:
        from gui.Scaleform.daapi.settings.views import VIEW_ALIAS
        component = _find_hangar_component(VIEW_ALIAS.VEHICLE_COMPARE_CART_BUTTON)
    except Exception:
        component = None
    if component is None:
        return False
    controller = _get_controller()
    try:
        if hasattr(component, 'as_setCountS'):
            component.as_setCountS(counter_value(controller))
        return True
    except Exception:
        return False


def refresh_widget():
    global _messenger_bar, _settings_badge_active
    controller = _get_controller()
    if controller is None:
        return

    use_chadow_slot = _should_use_chadow_slot()
    set_chadow_slot_mode(use_chadow_slot)

    bar = _messenger_bar or _find_messenger_bar()
    if bar is not None:
        _messenger_bar = bar
        badge_text = to_scaleform(ui.format_button_value(controller))
        show_badge = controller.isActive() or controller.hardBlockRandom
        _settings_badge_active = show_badge
        try:
            if hasattr(bar, 'as_setSessionStatsButtonSettingsUpdateS'):
                bar.as_setSessionStatsButtonSettingsUpdateS(show_badge, badge_text)
        except Exception:
            pass
        if use_chadow_slot:
            try:
                if hasattr(bar, 'as_setVehicleCompareCartButtonVisibleS'):
                    bar.as_setVehicleCompareCartButtonVisibleS(True)
            except Exception:
                pass

    if not _refresh_registered_button():
        _refresh_compare_slot_button()


def _populate_patch(self, original, *args, **kwargs):
    global _messenger_bar
    result = original(self, *args, **kwargs)
    _messenger_bar = self
    refresh_widget()
    return result


def _update_btn_visibility_patch(self, original, *args, **kwargs):
    result = original(self, *args, **kwargs)
    if _should_use_chadow_slot():
        try:
            view = getattr(self, '_CompareBasketListener__view', None)
            if view is not None and hasattr(view, 'as_setVehicleCompareCartButtonVisibleS'):
                view.as_setVehicleCompareCartButtonVisibleS(True)
        except Exception:
            pass
        refresh_widget()
    return result


def _compare_state_patch(self, original, *args, **kwargs):
    basket = self.comparisonBasket
    if basket is not None and not basket.isEnabled():
        refresh_widget()
        return
    if _compare_cart_busy():
        set_chadow_slot_mode(False)
        return original(self, *args, **kwargs)
    refresh_widget()


def _compare_count_patch(self, original, count, *args, **kwargs):
    if is_chadow_slot_mode() and _should_use_chadow_slot():
        controller = _get_controller()
        return original(self, counter_value(controller))
    return original(self, count)


def _open_compare_popover_patch(self, original, *args, **kwargs):
    if is_chadow_slot_mode() and _should_use_chadow_slot():
        open_settings(self)
        return
    return original(self, *args, **kwargs)


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


def _install_view_settings():
    try:
        import gui.Scaleform.daapi.view.lobby.messengerBar as messenger_bar_pkg
        from gui.Scaleform.genConsts.SESSION_STATS_CONSTANTS import SESSION_STATS_CONSTANTS
        from gui.Scaleform.framework import ComponentSettings, ScopeTemplates
    except Exception as error:
        print('%s view settings hook skipped: %s' % (TAG, error))
        return False

    if ChadowBattleLimitButton is None:
        return False

    def _get_view_settings_patch(original):
        def patched():
            settings = list(original())
            chadow_settings = ComponentSettings(
                CHADOW_BUTTON_ALIAS,
                ChadowBattleLimitButton,
                ScopeTemplates.DEFAULT_SCOPE,
            )
            for index, item in enumerate(settings):
                alias = getattr(item, 'alias', None)
                if alias == SESSION_STATS_CONSTANTS.SESSION_STATS_BUTTON_ALIAS:
                    settings.insert(index, chadow_settings)
                    break
            else:
                settings.append(chadow_settings)
            return tuple(settings)
        return patched

    module = messenger_bar_pkg
    if not hasattr(module, 'getViewSettings'):
        return False

    original = module.getViewSettings
    module.getViewSettings = _get_view_settings_patch(original)
    _patches.append((module, 'getViewSettings', original))
    print('%s hangar button registered: %s' % (TAG, CHADOW_BUTTON_ALIAS))
    return True


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
        if _patch_method(cls, '_populate', _populate_patch):
            patched = True
        if _patch_method(cls, 'as_openVehicleCompareCartPopoverS', _open_compare_popover_patch):
            patched = True
        if patched:
            installed = True
            print('%s hangar widget hook installed: %s.%s' % (TAG, module_path, class_name))
            break

    try:
        from gui.Scaleform.daapi.view.lobby.messengerBar.messenger_bar import _CompareBasketListener
        if _patch_method(_CompareBasketListener, '_CompareBasketListener__updateBtnVisibility', _update_btn_visibility_patch):
            installed = True
    except Exception as error:
        print('%s compare visibility hook skipped: %s' % (TAG, error))

    try:
        from gui.Scaleform.daapi.view.lobby.messengerBar.VehicleCompareCartButton import VehicleCompareCartButton
        if _patch_method(VehicleCompareCartButton, '_VehicleCompareCartButton__onVehCmpBasketStateChanged', _compare_state_patch):
            installed = True
        if _patch_method(VehicleCompareCartButton, '_VehicleCompareCartButton__changeCount', _compare_count_patch):
            installed = True
        if not hasattr(VehicleCompareCartButton, 'handleClick'):
            VehicleCompareCartButton.handleClick = lambda self: open_settings(self)
            _patches.append((VehicleCompareCartButton, 'handleClick', None))
            installed = True
    except Exception as error:
        print('%s compare button hook skipped: %s' % (TAG, error))

    return installed


def install():
    _install_view_settings()
    installed = _install_messenger_bar()
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
    global _messenger_bar, _settings_badge_active
    _cancel_refresh_loop()
    g_eventBus.removeListener(
        events.FightButtonEvent.FIGHT_BUTTON_UPDATE,
        _fight_button_update,
        scope=EVENT_BUS_SCOPE.LOBBY,
    )
    g_playerEvents.onAccountBecomePlayer -= _on_account_become_player
    for cls, method_name, original in reversed(_patches):
        if original is None:
            try:
                delattr(cls, method_name)
            except Exception:
                pass
        else:
            setattr(cls, method_name, original)
    del _patches[:]
    _messenger_bar = None
    _settings_badge_active = False
    set_chadow_slot_mode(False)
