from ..wolf import test as wolftest

snippet = r"""
def add2(a):
    rv = a + 2
    rv
    return rv


def linked_list_from(*items):
    head = None  # ?
    for new_head in items[::-1]:
        head = (new_head, head)  # ?
    return head


l = linked_list_from(1, 2, 3)
l
"""

def test_functions(snapshot):
    res = wolftest(snippet)
    snapshot.assert_match(res)
