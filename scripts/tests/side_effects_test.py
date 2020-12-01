from ..wolf import Wolf
wolftest = Wolf().test

snippet = r"""
b = [*range(1, 4)]  # ?  <-- Comment Macro ~ Result ->

print('before', b)
b.pop()  # ?
print('after', b)

b  # ?
b
"""

def test_side_effects(snapshot):
    res = wolftest(snippet)
    snapshot.assert_match(res)
