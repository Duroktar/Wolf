from ..wolf import Wolf
wolftest = Wolf().test


snippet = r"""
0/0

print('nope')
"""

def test_division_by_zero(snapshot):
    res = wolftest(snippet)
    snapshot.assert_match(res)


def test_parse_eval_reports_errors_without_exiting():
    import os
    import subprocess
    import sys

    script = '''
import os
import sys
sys.path.insert(0, os.path.abspath("scripts"))
from wolf import Wolf
wolf = Wolf()
try:
    wolf.parse_eval("1 / 0", event={"kind": "line", "source": "1 / 0", "lineno": 1})
    print("UNEXPECTED_SUCCESS")
except Exception as exc:
    print(type(exc).__name__)
    print(str(exc) or "NO_MESSAGE")
'''

    completed = subprocess.run(
        [sys.executable, "-c", script],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
    )
    assert completed.returncode == 0
    assert 'WolfEvaluationError' in completed.stdout
