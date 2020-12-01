from ..wolf import Wolf
wolftest = Wolf().test

import sys

snippet1 = r"""
1 + 334  # ?  BROKEN

1 < 0
"""

snippet2 = r"""
1 + 334  # ?  WORKS
"""

def test_bug_1():
    res1 = wolftest(snippet1)
    res2 = wolftest(snippet2)
    major = sys.version_info.major
    minor = sys.version_info.minor

    if major == 3 and minor < 7:
        assert res1 != []
        assert res2 != []
        assert res1 == res2
    else:
        assert res1 == '[]'
        assert res2 != '[]'
        assert res1 != res2
