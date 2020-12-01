from ..wolf import Wolf
wolftest = Wolf().test

snippet = r"""
a = 'Hello'
b = 3

a
b
"""

def test_basic(snapshot):
    res = wolftest(snippet)
    snapshot.assert_match(res)
