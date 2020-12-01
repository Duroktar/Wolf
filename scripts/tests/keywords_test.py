from ..wolf import Wolf
wolftest = Wolf().test

# Issues (#28,#29,#30): - https://github.com/Duroktar/Wolf/issues/28 https://github.com/Duroktar/Wolf/issues/29 https://github.com/Duroktar/Wolf/issues/30
snippet = r"""
a = 1
while a < 5:
    if a == 4:
        break
    if a == 3:
        pass
    a
    a += 1

for i in range(0, 5):
    if a == 1:
        continue
    i
"""

def test_keywords(snapshot):
    res = wolftest(snippet)
    snapshot.assert_match(res)
