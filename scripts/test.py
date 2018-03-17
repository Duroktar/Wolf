import json

x = json.loads('{x:5}')


# inputs = [
#     [6.4, 2.8, 5.6, 2.2, 3],
#     [5.0, 2.3, 3.3, 1.0, 1],
#     [4.9, 2.5, 4.5, 1.7, 2],
#     [4.9, 3.1, 1.5, 0.1, 0],
#     [5.7, 3.8, 1.7, 0.3, 0]
# ]

# import sys
# import os


# features = [x[0:-1] for x in inputs]  # ?
# labels = [x[-1] for x in inputs]  # ?

# result = []
# for i in inputs:
#     result.append(i[0:-1])

# result

# 1 * 82  # ?

# print(features)
# print(labels)


# def add2(a):
#     rv = a + 2
#     rv
#     return rv


# a = add2(1)
# a += add2(2)  # ?
# a += add2(3)  # ?

# a

# b = [*range(1, 4)]  # ?  <-- Comment Macro ~ Result ->

# print('before', b)

# b.pop()  # ?

# tup = (1, 2, 3)  # ?
# tup


# def fib(n):  # {
#     """ sadfasdf
#     asdfasdf
#      """
#     if n < 2:
#         return n
#     return fib(n-2) + fib(n-1)


# fib(5)  # ?


# class Employee:
#     def __init__(self, pay, age, name):
#         self.pay = pay
#         self.age = age
#         # self.name =


# def linked_list_from(*items):
#     head = None  # ?
#     for new_head in items[::-1]:
#         head = (new_head, head)
#     return head


# l = linked_list_from(1, 2, 3)

# l


# print('after', b)
# # # Tries to avoid side effects whrnever posible


# def fat():
#     return


# 1 + 334  # ?  Calculator  ->

# b  # Commented lines are ignored
# b  # ?

# c = add2(4)  # ?
# add2(14)  # ?

# array = [1, 2, 3, 4]

# array.pop()  # ?
# array.pop()  # ?
# array.pop()  # ?
# array.pop()  # ?
# # array.pop()  #?

# 1 < 0  # ?

# b
# b  # Lines after errors aren't annotated

# a


# def fib(n):
#     if n < 2:
#         return n
#     n
#     return fib(n - 2) + fib(n - 1)


# r = fib(5)

# r


# from itertools import groupby  # ?


# result = []  # ?

# animals = [
#     {'age': 2, 'species': 'dog'},
#     {'age': 2, 'species': 'cat'},
#     {'age': 3, 'species': 'dog'},
#     {'age': 3, 'species': 'dog'},
#     {'age': 5, 'species': 'cat'},
#     {'age': 5, 'species': 'dog'},
#     {'age': 5, 'species': 'frog'},
# ]

# for key, group in groupby(animals, lambda o: o['age']):
#     key
#     for g in group:
#         g

# a = 15
# b = 15

# c = 1 + b

# c


# for t in range(5):
#     t
#     t
#     t

# b = [1, 2]


# b.pop()  # ?


# print(1 + 10)
# print(a)

# a


# def contains_any(*args):
#     return any(i in args[-1] for i in args[:-1])  # ?


# b = contains_any('hat', 'cat', ['jeff', 'sam', 'cat'])  # ?
# b

# a = 0  # ?

# while a < 5:
#     a
#     print('Tick', a)
#     a += 1
