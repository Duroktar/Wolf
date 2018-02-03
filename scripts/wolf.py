#!/usr/bin/env python

import os
import sys
import json
from importlib import import_module
from hunter import trace, Q
from pdb import Pdb


WOLF = []


def firstFrom(M):
    return M and M[0]


def result_handler(event):
    # All hail ..
    global WOLF
    source = event['source'].strip()
    rv = {
        "source": source,
        "kind": event['kind'],
        "line_number": event['lineno'],
        "depth": event['depth'],
        "calls": event['calls'],
    }
    parts = source.split(' ')
    if len(parts) == 1:
        env = {**event['globals'], **event['locals']}
        value = env.get(firstFrom(parts))
        if value:
            rv['value'] = value
    WOLF.append(rv)


def filename_filter(filename):
    def inner(event):
        rel_path = os.path.relpath(event['filename'])
        rel_target = os.path.relpath(filename)
        return True if rel_path == rel_target else False
    return inner


def setTrace(target_file):
    trace(
        Q(
            filename_filter(target_file),
            kind="line",
            stdlib=False,
            action=result_handler)
    )


def main(argv):
    if len(argv) < 2:
        print("Must provide a file.")
        return 1
    filename = argv[1]
    if not os.path.exists(filename):
        print(filename + " <- doesn't exist")
        return 1

    target = os.path.abspath(filename)
    module_name = os.path.basename(target).split('.')[0]

    # XXX Could probably do some error checking here..
    setTrace(target)
    script = import_module(module_name)
    ###

    if WOLF:
        python_data = ", ".join(json.dumps(i) for i in WOLF)
        print("WOLF: [" + python_data + "]")
        return 0
    else:
        return 1


if __name__ == '__main__':
    exit(main(sys.argv))
