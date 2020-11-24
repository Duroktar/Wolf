# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_loops 1'] = '[{"lineno": 3, "source": ["    a\\n"], "value": "1"}, {"lineno": 4, "value": "Tick 1"}, {"lineno": 3, "source": ["    a\\n"], "value": "2"}, {"lineno": 4, "value": "Tick 2"}, {"lineno": 3, "source": ["    a\\n"], "value": "3"}, {"lineno": 4, "value": "Tick 3"}, {"lineno": 3, "source": ["    a\\n"], "value": "4"}, {"lineno": 4, "value": "Tick 4"}, {"lineno": 9, "source": ["    t\\n"], "value": "0"}, {"lineno": 10, "source": ["    t\\n"], "value": "0"}, {"lineno": 11, "source": ["    t\\n"], "value": "0"}, {"lineno": 9, "source": ["    t\\n"], "value": "1"}, {"lineno": 10, "source": ["    t\\n"], "value": "1"}, {"lineno": 11, "source": ["    t\\n"], "value": "1"}, {"lineno": 9, "source": ["    t\\n"], "value": "2"}, {"lineno": 10, "source": ["    t\\n"], "value": "2"}, {"lineno": 11, "source": ["    t\\n"], "value": "2"}, {"lineno": 9, "source": ["    t\\n"], "value": "3"}, {"lineno": 10, "source": ["    t\\n"], "value": "3"}, {"lineno": 11, "source": ["    t\\n"], "value": "3"}, {"lineno": 9, "source": ["    t\\n"], "value": "4"}, {"lineno": 10, "source": ["    t\\n"], "value": "4"}, {"lineno": 11, "source": ["    t\\n"], "value": "4"}]'
