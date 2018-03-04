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


# b = contains_any('hat', 'cat', ['jeff', 'sam', 'cat'])
# b

# a = 1

# while True:
#     sleep(1)
#     print('Tick', a)
#     a += 1

b = [1, 2]  # ?

print('beofre', b)

b.pop()  # ?

print('after', b)


0/0

b
