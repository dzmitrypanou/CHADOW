# -*- coding: utf-8 -*-
from helpers import dependency


def lobby_context_interface():
    try:
        from skeletons.gui.lobby_context import ILobbyContext
        return ILobbyContext
    except ImportError:
        pass
    try:
        from skeletons.gui.shared.utils import ILobbyContext
        return ILobbyContext
    except ImportError:
        pass
    raise ImportError('ILobbyContext is not available in this client build')


def lobby_context_instance():
    return dependency.instance(lobby_context_interface())


def get_queue_type():
    try:
        from gui.prb_control import prb_getters
        return prb_getters.getQueueType()
    except Exception:
        return None


def _get_functional_state():
    try:
        from gui.prb_control.dispatcher import g_prbLoader
        dispatcher = g_prbLoader.getDispatcher()
        if dispatcher is None:
            return None
        return dispatcher.getFunctionalState()
    except Exception:
        return None


def _selected_battle_selector_item(state):
    try:
        from gui.Scaleform.daapi.view.lobby.header import battle_selector_items
        return battle_selector_items.getItems().update(state)
    except Exception:
        return None


def _is_random_selector_item(item):
    if item is None:
        return False
    if item.__class__.__name__ == '_RandomQueueItem':
        return True
    try:
        from gui.Scaleform.daapi.view.lobby.header.battle_selector_items import SELECTOR_BATTLE_TYPES
        if hasattr(item, 'getSelectorType'):
            return item.getSelectorType() == SELECTOR_BATTLE_TYPES.RANDOM
    except Exception:
        pass
    return False


def is_random_queue(queue_type=None):
    try:
        from constants import QUEUE_TYPE
    except ImportError:
        return False

    state = _get_functional_state()
    if state is not None:
        try:
            if state.isQueueSelected(QUEUE_TYPE.RANDOMS):
                return True
        except Exception:
            pass

        selected = _selected_battle_selector_item(state)
        if _is_random_selector_item(selected):
            return True

        return False

    if queue_type is None:
        queue_type = get_queue_type()
    if queue_type is None:
        return False
    unknown = getattr(QUEUE_TYPE, 'UNKNOWN', None)
    if unknown is not None and queue_type == unknown:
        return False
    return queue_type == QUEUE_TYPE.RANDOMS
