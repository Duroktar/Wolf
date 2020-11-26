from ..wolf import test as wolftest
from sys import platform

snippet = u"""
unicode_text = 'é'  # ?

unicode_text

print("🍆") #?
"""

def test_unicode(snapshot):
    res = wolftest(snippet)
    snapshot.assert_match(res)
