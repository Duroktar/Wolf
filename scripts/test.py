
def linked_list_from(*items):
    head = None  # ?
    for new_head in items[::-1]:
        head = (new_head, head)  # ?
    return head


l = linked_list_from(1, 2, 3)

l


def add2(a):
    rv = a + 2
    rv
    return rv


a = add2(1)  # ?
a += add2(2)  # ?
a += add2(3)  # ?

a

b = [1, 3]  # ?  <-- Comment Macro ~ Result ->

print('before', b)

b.pop()  # ?

print('after', b)
# # Tries to avoid side effects whrnever posible

1 + 334  # ?  Calculator  ->

b  # Commented lines are ignored
b  # ?

c = add2(4)  # ?
add2(14)  # ?

array = [1, 2, 3, 4]

array.pop()  # ?
array.pop()  # ?
array.pop()  # ?
array.pop()  # ?
array.pop()  # ?
# {"line_number": 49, "counter": 60,"source": "array.pop()  # ?", "kind": "line", "value": "IndexError: pop from empty list\n", "pretty": "IndexError: pop from empty list\n", "error": true, "calls": 47}
# {"line_number": 52, "kind": "line", "counter": 63, "source": "", "value": "ZeroDivisionError: division by zero\n", "pretty": "ZeroDivisionError: division by zero\n", "error": true}
# 0/0

b  # Lines after errors aren't annotated

a


def fib(n):
    if n < 2:
        return n
    n
    return fib(n - 2) + fib(n - 1)


r = fib(5)

r


# # from time import sleep


# def create_llist(*items):
#     head = None
#     for new_head in reversed(items):
#         head = (new_head, head)    #
#     return head


# create_llist(1, 2, 3)

# a = create_llist(1, 2, 3)


# print(1 + 10)
# print(a)

# a


# def contains_any(*args):
#     args
#     return any(i in args[-1] for i in args[:-1])


# def add(a):
#     rv = a + 2
#     rv
#     return rv


# a = add(1)  # ?
# a += add(2)  # ?
# a += add(3)

# a

# b = [1, 2]  # ?

# print('beofre', b)

# b.pop()  # ?

# print('after', b)


# 0/0

# b
