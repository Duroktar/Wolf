def create_llist(*items):
    head = None
    for new_head in reversed(items):
        head = (new_head, head)
    return head


a = create_llist(1, 2, 3)

a
print(a)
