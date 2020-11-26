from ..wolf import test as wolftest

snippet = r"""
inputs = [
    [6.4, 2.8, 5.6, 2.2, 2],  # ?
    [5.0, 2.3, 3.3, 1.0, 1],
    [4.9, 2.5, 4.5, 1.7, 2],
]

labels = [x[-1] for x in inputs]  # ?

hat = labels  # ?
"""

def test_macros(snapshot):
    res = wolftest(snippet)
    snapshot.assert_match(res)
