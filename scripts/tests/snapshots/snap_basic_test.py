# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_basic 1'] = '[{"lineno": 4, "source": ["a\\n"], "value": "Hello"}, {"lineno": 5, "source": ["b\\n"], "value": "3"}]'
