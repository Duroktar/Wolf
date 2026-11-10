import json
import os
import subprocess
import sys
import unittest


WORKER_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "worker.py")
)


class WorkerProtocolTests(unittest.TestCase):
    def run_worker(self, request):
        return subprocess.run(
            [sys.executable, WORKER_PATH],
            input=json.dumps(request),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
        )

    def test_raw_source_streams_line_records_then_completion(self):
        completed = self.run_worker({"source": "value = 7\nvalue"})

        self.assertEqual(completed.returncode, 0, completed.stderr)
        records = [json.loads(line) for line in completed.stdout.splitlines()]
        self.assertTrue(records)
        self.assertEqual(records[-1]["type"], "complete")
        self.assertTrue(any(record["type"] == "line" for record in records[:-1]))
        self.assertIsInstance(json.loads(records[-1]["output"]), list)

    def test_user_stdout_does_not_corrupt_protocol(self):
        completed = self.run_worker({"source": "print('program output')\nanswer = 42  #?"})

        self.assertEqual(completed.returncode, 0, completed.stderr)
        records = [json.loads(line) for line in completed.stdout.splitlines()]
        self.assertEqual(records[-1]["type"], "complete")
        self.assertIn("program output", completed.stderr)

    def test_invalid_request_returns_error_record(self):
        completed = self.run_worker({"source": 42})

        self.assertEqual(completed.returncode, 1)
        records = [json.loads(line) for line in completed.stdout.splitlines()]
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["type"], "error")
        self.assertIn("string 'source'", records[0]["message"])


if __name__ == "__main__":
    unittest.main()
