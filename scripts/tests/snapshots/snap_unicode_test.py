# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_unicode 1'] = '[{"lineno": 1, "value": "unicode_text = \\u00e9"}, {"lineno": 3, "source": ["unicode_text\\n"], "value": "\\u00e9"}, {"lineno": 5, "value": "\\ud83c\\udf46"}]'
