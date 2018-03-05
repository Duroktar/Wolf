import unittest
import os
import io
import wolf
from contextlib import redirect_stdout, contextmanager


__dirname = os.path.dirname(__file__)
testDir = os.path.join(__dirname, 'testInputs')


@contextmanager
def buffer_stream():
    buffer = io.StringIO()
    yield buffer
    buffer.close()


def dir_factory(base):
    return lambda target: os.path.join(base, target)


get_target = dir_factory(testDir)


def get_snapshot(target):
    with open(get_target(target)) as fs:
        return fs.read()


class TestPythonEvaluator(unittest.TestCase):

    def setUp(self):
        wolf.WOLF = []

    def test_simple_output(self):
        target = get_target("simpleOutput.py")
        with buffer_stream() as buf:
            with redirect_stdout(buf):
                returnStatus = wolf.main(target)
                assert returnStatus != 1

    def test_simple_code(self):
        # Returns 1 if no annotations to print
        target = get_target("simplestTest.py")
        with buffer_stream() as buf:
            with redirect_stdout(buf):
                returnStatus = wolf.main(target)
                assert returnStatus == 1

    def test_snapshot(self):
        target = get_target("complex.test.py")
        snapshot = get_snapshot("complex.snapshot").strip()
        with buffer_stream() as buf:
            with redirect_stdout(buf):
                returnStatus = wolf.main(target)
                assert returnStatus != 1
            result = buf.getvalue().strip()
        self.maxDiff = None
        self.assertMultiLineEqual(result, snapshot)


if __name__ == '__main__':
    unittest.main()
