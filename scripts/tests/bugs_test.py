from ..wolf import test as wolftest

snippet1 = r"""
1 + 334  # ?  BROKEN

1 < 0
"""
snippet2 = r"""
1 + 334  # ?  WORKS
"""

def test_bug_1(snapshot):
    res1 = wolftest(snippet1)
    res2 = wolftest(snippet2)
    snapshot.assert_match(res1)
    snapshot.assert_match(res2)
    try:
        snapshot.assert_value_matches_snapshot(res1, res2)
    except AssertionError:
        return
    else:
        raise
