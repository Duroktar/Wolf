# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_bug_1 1'] = '[]'

snapshots['test_bug_1 2'] = '[{"lineno": 1, "value": "335"}]'
