from ..wolf import test as wolftest


snippet1 = r"""
raise Exception('hi')
"""

def test_exception(snapshot):
    res = wolftest(snippet1)
    snapshot.assert_match(res)


snippet2 = r"""
raise BaseException('hi')
"""

def test_base_exception(snapshot):
    res = wolftest(snippet2)
    snapshot.assert_match(res)
