from chadow_battle_limit import config
from chadow_battle_limit.controller import BattleLimitController

TAG = config.TAG
_patches = []

TOOLTIP_BODY = (
    u'Достигнут лимит боёв за сессию (%d/%d).\n'
    u'Alt+Shift+R — сбросить счётчик\n'
    u'Alt+Shift+0 — отключить лимит\n'
    u'Alt+Shift+1..9 — выбрать лимит'
)

_HOOK_TARGETS = (
    ('gui.Scaleform.daapi.view.lobby.header.LobbyHeader', 'LobbyHeader'),
    ('gui.Scaleform.daapi.view.lobby.hangar.hangar_header', 'HangarHeader'),
)


def _getController():
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


def _check_disabled_patch(self, original, canDo, isLocked):
    controller = _getController()
    if controller is not None and controller.isLimitReached():
        return True
    return original(self, canDo, isLocked)


def _update_controls_patch(self, original, *args, **kwargs):
    result = original(self, *args, **kwargs)
    controller = _getController()
    if controller is None or not controller.isLimitReached():
        return result
    if hasattr(self, 'as_disableFightButtonS'):
        self.as_disableFightButtonS(True)
    if hasattr(self, 'as_setFightBtnTooltipS'):
        tooltip = TOOLTIP_BODY % (controller.battlesPlayed, controller.maxBattles)
        self.as_setFightBtnTooltipS(tooltip, False)
    return result


def _install_scaleform_header(module_path, class_name):
    try:
        module = __import__(module_path, fromlist=[class_name])
        cls = getattr(module, class_name)
    except Exception as error:
        print('%s header hook skipped (%s.%s): %s' % (TAG, module_path, class_name, error))
        return False

    patched = False
    if _patch_method(cls, '_checkFightButtonDisabled', _check_disabled_patch):
        patched = True
    if _patch_method(cls, '_updatePrebattleControls', _update_controls_patch):
        patched = True
    if patched:
        print('%s header hook installed: %s.%s' % (TAG, module_path, class_name))
    return patched


def install():
    installed = False
    for module_path, class_name in _HOOK_TARGETS:
        if _install_scaleform_header(module_path, class_name):
            installed = True
    if not installed:
        print('%s UI hooks not installed; fight blocking still works via confirmator' % TAG)


def uninstall():
    for cls, method_name, original in reversed(_patches):
        setattr(cls, method_name, original)
    del _patches[:]
