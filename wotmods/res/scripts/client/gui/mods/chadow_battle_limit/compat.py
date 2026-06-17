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


def is_random_queue(queue_type=None):
    try:
        from constants import QUEUE_TYPE
    except ImportError:
        return False
    if queue_type is None:
        queue_type = get_queue_type()
    if queue_type is None:
        return False
    return queue_type == QUEUE_TYPE.RANDOMS
