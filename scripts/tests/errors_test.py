from ..wolf import Wolf
wolftest = Wolf().test


snippet = r"""
0/0

print('nope')
"""

def test_division_by_zero(snapshot):
    res = wolftest(snippet)
    snapshot.assert_match(res)
