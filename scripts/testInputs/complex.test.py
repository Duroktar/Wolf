# # Nested data
inputs = [
    [6.4, 2.8, 5.6, 2.2, 2],  # ?
    [5.0, 2.3, 3.3, 1.0, 1],
    [4.9, 2.5, 4.5, 1.7, 2],
]

# Comprehensions
features = [x[0:-1] for x in inputs]  # ?
labels = [x[-1] for x in inputs]  # ?

# macros
hat = labels  # ?

# print
print(features)
print(labels)

# side effects
b = [*range(1, 4)]  # ?  <-- Comment Macro ~ Result ->

print('before', b)
b.pop()  # ?
print('after', b)

b  # ?
b


# functions
def add2(a):
    rv = a + 2
    rv
    return rv

# function nesting and macros


def linked_list_from(*items):
    head = None  # ?
    for new_head in items[::-1]:
        head = (new_head, head)  # ?
    return head


l = linked_list_from(1, 2, 3)
l

a = 1
# Loop stuff
while a < 5:
    a
    print('Tick', a)
    a += 1


for t in range(5):
    t
    t
    t


add2(14)  # ?
a = add2(1)  # ?
a


# data types
tup = (1, 2, 3)  # ?
tup

# assorted
1 + 334  # ?  Calculator  ->

1 < 0  # ?

text = 'happy'  # ?

text

unicode_text = 'é'  # ?

unicode_text

# newline characters in strings
x = "foo\nfaa"  # ?


# errors

0/0
