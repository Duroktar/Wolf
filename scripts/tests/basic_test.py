from ..wolf import test as wolftest

snippet = r"""
a = 'Hello'
b = 3

a
b
"""

def test_basic(snapshot):
    res = wolftest(snippet)
    snapshot.assert_match(res)
