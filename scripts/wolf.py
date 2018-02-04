#!/usr/bin/env python

import os
import sys
import json
from importlib import util

from hunter import trace, Q, wrap
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
            if callable(value):
                rv['value'] = str(value)
            else:
                rv['value'] = value
    WOLF.append(rv)


def filename_filter(filename):
    def inner(event):
        target_filename = event['filename']
        return True if target_filename == filename else False
    return inner


def import_file(full_name, fullpath):
    spec = util.spec_from_file_location(full_name, fullpath)
    mod = util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def import_and_trace_script(module_name, fullpath):
    with trace(filename_filter(fullpath), action=result_handler):
        import_file(module_name, fullpath)


def main(filename):

    if not os.path.exists(filename):
        print(filename + " <- file doesn't exist", file=sys.stderr)
        return 1

    target = os.path.abspath(filename)
    module_name = os.path.basename(target).split('.')[0]

    try:
        import_and_trace_script(module_name, target)
    except Exception as e:
        print('There was an error running the provided script..')
        print(e, file=sys.stderr)
        return 1

    if WOLF:
        python_data = ", ".join(json.dumps(i) for i in WOLF)

        # DO NOT TOUCH, ie: no pretty printing
        print("WOLF: [" + python_data + "]")
        ###
        return 0

    return 1


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("wolf.py >> ERROR >> Must provide a file to trace.")
        exit(1)

    exit(main(sys.argv[1]))
