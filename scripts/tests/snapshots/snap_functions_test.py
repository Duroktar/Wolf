# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_functions 1'] = '[{"lineno": 8, "value": "head = None"}, {"lineno": 10, "value": "head = (3, None)"}, {"lineno": 10, "value": "head = (2, (3, None))"}, {"lineno": 10, "value": "head = (1, (2, (3, None)))"}, {"lineno": 15, "source": ["l\\n"], "value": "(1, (2, (3, None)))"}]'
