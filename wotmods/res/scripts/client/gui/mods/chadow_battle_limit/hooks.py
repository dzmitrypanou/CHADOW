from . import config
from .controller import BattleLimitController
from .text import to_scaleform

TAG = config.TAG
_patches = []

_HOOK_TARGETS = (
    ('gui.Scaleform.daapi.view.lobby.header.LobbyHeader', 'LobbyHeader'),
    ('gui.Scaleform.daapi.view.lobby.hangar.hangar_header', 'HangarHeader'),
)


def _getController():
    return BattleLimitController.instance


def _fight_tooltip(controller):
    if controller is None:
        return u''
    if not controller.appliesToCurrentQueue():
        return u''
    if controller.hardBlockRandom:
        return u'Chadow: random battles blocked.\nOther modes stay available.'
    if controller.isLimitReached():
        return (
            u'Random battle limit (%d/%d).\n'
            u'Scales icon: settings (Alt+Shift+M).'
        ) % (controller.battlesPlayed, controller.maxBattles)
    if controller.isActive():
        remaining = controller.remainingBattles()
        return (
            u'Chadow: random battles %d/%d.\n'
            u'Remaining: %d. Scales icon: settings.'
        ) % (controller.battlesPlayed, controller.maxBattles, remaining or 0)
    return u''


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
    if controller is not None and controller.shouldBlockFight():
        return True
    return original(self, canDo, isLocked)


def _update_controls_patch(self, original, *args, **kwargs):
    result = original(self, *args, **kwargs)
    controller = _getController()
    if controller is None:
        return result
    should_block = controller.shouldBlockFight()
    if hasattr(self, 'as_disableFightButtonS'):
        self.as_disableFightButtonS(should_block)
    tooltip = _fight_tooltip(controller)
    if hasattr(self, 'as_setFightBtnTooltipS'):
        if tooltip:
            self.as_setFightBtnTooltipS(to_scaleform(tooltip), False)
        else:
            self.as_setFightBtnTooltipS(to_scaleform(u''), False)
    return result


def _refresh_fight_button_patch(self, original, *args, **kwargs):
    result = original(self, *args, **kwargs)
    controller = _getController()
    if controller is not None:
        controller.refreshFightButton()
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
    if class_name == 'LobbyHeader':
        if _patch_method(cls, '_rebootBattleSelector', _refresh_fight_button_patch):
            patched = True
        if _patch_method(cls, '_LobbyHeader__updateBattleTypeSelectPopover', _refresh_fight_button_patch):
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
