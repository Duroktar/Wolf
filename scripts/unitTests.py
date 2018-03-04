import unittest
import wolf
import os


def dirFactory(base):
    return lambda target: os.path.join(base, target)


__dirname = os.path.dirname(__file__)
testDir = os.path.join(__dirname, 'testInputs')
getTarget = dirFactory(testDir)


class TestPythonEvaluator(unittest.TestCase):

    def test_simple_output(self):
        target = getTarget("simpleOutput.py")
        returnStatus = wolf.main(target)
        assert returnStatus != 1

    def test_simple_code(self):
        target = getTarget("simplestTest.py")
        returnStatus = wolf.main(target)
        assert returnStatus != 1


if __name__ == '__main__':
    unittest.main()
