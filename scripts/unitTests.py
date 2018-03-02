import unittest
import wolf
import os


class TestPythonEvaluator(unittest.TestCase):

    testDir = os.path.dirname(__file__) + '/testInputs/'

    def test_simple_output(self):
        returnStatus = wolf.main(self.testDir + "simpleOutput.py")
        assert returnStatus != 1

    def test_simple_code(self):
        returnStatus = wolf.main(self.testDir + "simplestTest.py")
        assert returnStatus != 1


if __name__ == '__main__':
    unittest.main()
