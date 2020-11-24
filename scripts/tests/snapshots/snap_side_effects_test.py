# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_side_effects 1'] = '[{"lineno": 1, "value": "b = [1, 2, 3]"}, {"lineno": 3, "value": "before [1, 2, 3]"}, {"lineno": 4, "value": "3"}, {"lineno": 5, "value": "after [1, 2]"}, {"lineno": 7, "value": "[1, 2]"}, {"lineno": 8, "source": ["b\\n"], "value": "[1, 2]"}]'
