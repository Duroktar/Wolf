# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_class 1'] = '[{"lineno": 11, "value": "t = 1"}, {"lineno": 3, "source": ["        num\\n"], "value": "1"}, {"lineno": 3, "source": ["        num\\n"], "value": "3"}, {"lineno": 13, "value": "3"}]'
