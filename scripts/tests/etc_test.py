from ..wolf import test as wolftest

snippet = r"""
# data types
tup = (1, 2, 3)  # ?
tup

1 < 0  # ?

text = 'happy'  # ?

text

unicode_text = 'é'  # ?

unicode_text

# newline characters in strings
x = "foo\nfaa"  # ?

# Issue (#50): a=1 #? got error - https://github.com/Duroktar/Wolf/issues/50
a=1 #?
"""

def test_etc(snapshot):
    res = wolftest(snippet)
    snapshot.assert_match(res)
