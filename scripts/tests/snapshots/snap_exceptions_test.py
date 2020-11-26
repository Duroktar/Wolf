# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_base_exception 1'] = '[{"lineno": 1, "source": "raise BaseException(\'hi\')", "value": "BaseException: hi\\n", "error": true}]'

snapshots['test_exception 1'] = '[{"lineno": 1, "source": "raise Exception(\'hi\')", "value": "Exception: hi\\n", "error": true}]'
