# -*- coding: utf-8 -*-

def _as_unicode(value):
    if value is None:
        return u''
    if isinstance(value, unicode):
        return value
    try:
        return unicode(value, 'utf-8')
    except Exception:
        try:
            return unicode(value, 'cp1251')
        except Exception:
            return unicode(value)


def to_scaleform(value):
    return _as_unicode(value)


def to_system_message(value):
    return _as_unicode(value)


def to_system_message_bytes(value):
    text = _as_unicode(value)
    try:
        return text.encode('cp1251')
    except UnicodeEncodeError:
        return text
