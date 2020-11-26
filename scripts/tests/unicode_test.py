from ..wolf import test as wolftest
from sys import platform

snippet = u"""
unicode_text = 'é'  # ?

unicode_text
"""

def test_unicode(snapshot):

    if platform == "win32":
        return

    res = wolftest(snippet)
    snapshot.assert_match(res)
