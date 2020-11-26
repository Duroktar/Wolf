from ..wolf import test as wolftest
from json import loads

snippet = r"""
import os

test=os.environ['USER'] #?
path=os.environ['PATH'] #?
print(path)
"""

def test_env(snapshot):
    res = wolftest(snippet)
    line_decoration_count = len(loads(res))
    assert line_decoration_count > 1
