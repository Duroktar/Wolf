# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_etc 1'] = '[{"lineno": 2, "value": "tup = (1, 2, 3)"}, {"lineno": 3, "source": ["tup\\n"], "value": "(1, 2, 3)"}, {"lineno": 7, "value": "False"}, {"lineno": 9, "value": "text = happy"}, {"lineno": 11, "source": ["text\\n"], "value": "happy"}, {"lineno": 13, "value": "unicode_text = \\u00e9"}, {"lineno": 15, "source": ["unicode_text\\n"], "value": "\\u00e9"}, {"lineno": 18, "value": "x = foo\\nfaa"}, {"lineno": 21, "value": "a = 1"}]'
