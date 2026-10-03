import json
import os
import sys
import tempfile
import unittest

from ..wolf import Wolf, script_path


class StabilizationTests(unittest.TestCase):
    def test_script_path_restores_process_state_after_exception(self):
        original_cwd = os.getcwd()
        original_path = list(sys.path)

        with tempfile.TemporaryDirectory() as tmp_path:
            with self.assertRaises(RuntimeError):
                with script_path(tmp_path):
                    self.assertEqual(os.getcwd(), tmp_path)
                    raise RuntimeError("injected failure")

        self.assertEqual(os.getcwd(), original_cwd)
        self.assertEqual(sys.path, original_path)

    def test_augmented_assignment_macros_report_results(self):
        cases = [
            ("value += 2", "value = 3"),
            ("value -= 2", "value = -1"),
            ("value *= 3", "value = 3"),
        ]
        for statement, expected in cases:
            with self.subTest(statement=statement):
                result = json.loads(Wolf().test("value = 1\n{}  #?".format(statement)))
                self.assertTrue(any(line["value"] == expected for line in result), result)


if __name__ == "__main__":
    unittest.main()
