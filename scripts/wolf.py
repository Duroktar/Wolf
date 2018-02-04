#!/usr/bin/env python

import os
import sys
import json
from importlib import util

try:
    from hunter import trace, Q, wrap
except ImportError:
    print('IMPORT_ERROR: hunter not installed.')
    exit(1)
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


class WithPath:

    def __init__(self, path):
        self.new_dir = path

    def __enter__(self):
        sys.path.insert(1, self.new_dir)

    def __exit__(self, *args):
        sys.path.remove(self.new_dir)


def import_and_trace_script(module_name, module_path):
    with WithPath(os.path.abspath(os.path.dirname(module_path))):
        with trace(filename_filter(module_path), action=result_handler):
            import_file(module_name, module_path)


def main(filename):

    if not os.path.exists(filename):
        print(filename + " <- file doesn't exist", file=sys.stderr)
        return 1

    module_path = os.path.abspath(filename)
    module_name = os.path.basename(module_path).split('.')[0]

    try:
        import_and_trace_script(module_name, module_path)
    except Exception as e:
        print('There was an error running the provided script..')
        print(e, file=sys.stderr)
        return 1

    if WOLF:
        python_data = ", ".join(json.dumps(i) for i in WOLF)

        # DO NOT TOUCH, ie: no pretty printing
        print("WOOF: [" + python_data + "]")
        ###
        return 0

    return 1


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("wolf.py >> ERROR >> Must provide a file to trace.")
        exit(1)

    exit(main(sys.argv[1]))
