# from time import sleep


def create_llist(*items):
    head = None
    for new_head in reversed(items):
        head = (new_head, head)    #
    return head


create_llist(1, 2, 3)

a = create_llist(1, 2, 3)


print(1 + 10)
print(a)

a


def contains_any(*args):
    args
    return any(i in args[-1] for i in args[:-1])


def add(a):
    rv = a + 2
    rv
    return rv


a = add(1)  # ?
a += add(2)  # ?
a += add(3)

a

b = [1, 2]  # ?

print('beofre', b)

b.pop()  # ?

print('after', b)


0/0

b
