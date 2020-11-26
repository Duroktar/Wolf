# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_division_by_zero 1'] = '[{"lineno": 1, "source": "0/0", "value": "ZeroDivisionError: division by zero\\n", "error": true}]'
