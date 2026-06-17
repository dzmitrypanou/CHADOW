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
