from ..wolf import test as wolftest

snippet = u"""
unicode_text = 'é'  # ?

unicode_text
"""

def test_unicode(snapshot):
    res = wolftest(snippet)
    snapshot.assert_match(res)
