# -*- coding: utf-8 -*-
import os
import sys

_ROOT = os.path.dirname(__file__)
_PARENT = os.path.dirname(_ROOT)
for _path in (_ROOT, _PARENT):
    if _path and _path not in sys.path:
        sys.path.insert(0, _path)
