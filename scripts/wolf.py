""" Wolf - It kicks the Quokkas ass.
      .-"-.         
     / /|  \                     _  __  
    | <'/   |                   | |/ _| 
     \/ (  /      __      _____ | | |_  
     /_ |-'       \ \ /\ / / _ \| |  _| 
    | _\\          \ V  V / (_) | | |    
    \___>\          \_/\_/ \___/|_|_|                                 

Copyright 2018 Scott Doucet

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""
import os
import sys
import re
import json
from pprint import pformat
from collections import namedtuple
from importlib import util
from contextlib import contextmanager

try:
    from hunter import trace, Q, wrap
except ImportError:
    print('IMPORT_ERROR: hunter not installed.', file=sys.stderr)
    exit(1)
from pdb import Pdb


###################
#
# Utilities, helper functions, regex ..

# This is to help us find lines tagged with a Wolf
# macro. If the line has a print statement, then we
# want the expression being printed, if it's a
# assignment then we want the variable.
#
# TODO: timer macro, track loop variables
#
# XXX: This will NOT work with destructured assignments.
# Named search groups are returned for convenience:
#   print      <- the expression being printed
#   assignment <- the variable being assigned to
#   macro      <- the macro expression used
_re = r'(print\((?P<print>\w+)\)|((?P<assignment>\w+)(\s*(=|\+=|\-=)\s*).*)\s*(?P<macro>#[$@!]{1})+)'
WOLF_MACROS = re.compile(_re)


def firstFrom(M):
    """
        "Safe" function for retriving the first element from an
        indexed collection. ex: retrieve the "head" of a list.
    """
    return M and M[0]


def import_file(full_name, fullpath):
    """
        The "recommended" method of importing a file by its
        absolute path in Python 3.5+

        See: https://stackoverflow.com/questions/67631/how-to-import-a-module-given-the-full-path
    """
    spec = util.spec_from_file_location(full_name, fullpath)
    mod = util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@contextmanager
def script_path(script_dir):
    """
        Context manager for adding a dir to the sys path
        and restoring it afterwards.
    """
    sys.path.insert(1, script_dir)
    yield
    sys.path.remove(script_dir)


###################
#
# Wolf Internal API
#                                 __
#                               .d$$b
#                             .' TO$;\
#                            /  : TP._;
#                           / _.;  :Tb|
#                          /   /   ;j$j
#                      _.-"       d$$$$
#                    .' ..       d$$$$;
#                   /  /P'      d$$$$P. |\
#                  /   "      .d$$$P' |\^"l
#                .'           `T$P^"""""  :
#            ._.'      _.'                ;
#         `-.-".-'-' ._.       _.-"    .-"
#       `.-" _____  ._              .-"
#      -(.g$$$$$$$b.              .'
#        ""^^T$$$P^)            .(:
#          _/  -"  /.'         /:/;
#       ._.'-'`-'  ")/         /;/;
#    `-.-"..--""   " /         /  ;
#   .-" ..--""        -'          :
#   ..--""--.-"         (\      .-(\
#     ..--""              `-\(\/;`
#       _.                      :
#                               ;`-
#                              :\
#                              ;  bug


# WOLF[dict]: Results from each line trace [GLOBAL]
WOLF = []

# BACK_REF[id]: values to be looked up in the next trace
BACK_REF = []
Ref = namedtuple('Ref', [
  'id',
  'depth'
])
#########


def resultifier(value):
    # Here we can set the string representation
    # of the result. For example, callables are
    # simply converted to Python strings.
    #
    #   ie: def add(a, b): return a + b
    #
    #   Will (usually) be represented as:
    #       <function add at 0x7f768395ad95>
    #
    #########
    if value:
        if callable(value):
            return str(value)
        else:
            return value


def result_handler(event):
    """
        Called by the `trace` function to handle any actions post
        filter. ie: trace => filter => result_handler

        Side Effects: Results are appended to the global WOLF list.
    """

    # All hail the ..
    global WOLF
    global BACK_REF

    source = event['source'].strip()

    # These are the fields returned from each line
    # of the traced program.
    meta = {
        "line_number":        event['lineno'],
        "kind":                 event['kind'],
        "depth":               event['depth'],
        "source":             event['source'],
        # "value"      <-  Defined below MAYBE..
    }

    value = None

    # We'll need to look up any values in the
    # correct scope, so let's grab the locals
    # and globals from the current frame and
    # build and mock environment.
    _globals = event['globals']
    _locals = event['locals']

    # This is the important part. Wolf is interested
    # in single word statements in the source code,
    # so that when found, they can be evaluated and
    # returned to the Wolf client for line decoration.
    words = source.split(' ')
    parts = firstFrom(words) if len(words) == 1 else None

    # We are also interested in lines that contain
    # a macro. 'print' statements, etc..
    match = WOLF_MACROS.search(source)

    # Evaluate any pending back refs.. (see below  )
    if BACK_REF:
        ref = BACK_REF.pop()
        if ref['depth'] >= event['depth'] and event['kind'] != 'call':
            brf_result = eval(ref['_brf'], _globals, _locals)
            WOLF.append({**ref, 'value': brf_result})
        else:
            BACK_REF.append(ref)

    if match:
        # Hunter is basically a "pre" hook, so if we want
        # the value on the left hand side of the current
        # expression we need to wait until the next line
        # once it's actually been evaluated, otherwise we
        # can get stale or undefined values.
        if match['assignment']:
            # save it for lookup on the next line
            meta['_brf'] = match['assignment']
            BACK_REF.append(meta)
        
        # In this case we evaluate and return the same
        # expression passed to print
        if match['print']:
            value = eval(match['print'], _globals, _locals)

    elif parts:
        value = eval(parts, _globals, _locals)

    if value is not None:
        meta['value'] = resultifier(value)

    # XXX: SIDE EFFECTS
    WOLF.append(meta)


def filename_filter(filename):
    """ 
        Removes dependency noise from the output. We're only
        interested in code paths travelled by the target script,
        so this filter traces based on the filename, provided as
        a prop on the `event` dict.

        NOTE: `filename_filter` is a closure over the actual filtering
            function. It captures the target filename for injection
            into the inner scope when the filter is actually run.
    """
    return lambda event: bool(event['filename'] == filename)


def import_and_trace_script(module_name, module_path):
    """ 
        As the name suggests, this imports and traces the target script.

        Filters for the running script and delegates the resulting calls
        to the result_handler function.

        NOTE: script_path is necessary here for relative imports to work
    """
    with script_path(os.path.abspath(os.path.dirname(module_path))):
        with trace(filename_filter(module_path), action=result_handler):
            import_file(module_name, module_path)


def main(filename):
    """ 
        Simply ensures the target script exists and calls
        the import_and_trace_script function. The results
        are stored in the global WOLF variable which are
        stringified and outputted to the console on script
        completion.

        We follow convention by returning a proper (hm...)
        `exit` code to the shell, so the actual return data
        requires some parsing on the client side. Tags are
        used to simplify this.

        Tag list (tags are the capitalized text):

        On Failure:

            `There can be multiple points of failure.

            -> `IMPORT_ERROR:`  Happens if `hunter` dependency not found.

            -> `ARGS_ERROR:`    Happens if no target script provided.

            -> `EXISTS_ERROR:`  Happens if the target file doesn't exist.

            -> `RUNTIME_ERROR:` Captures runtime errors from the main function.

        On success:

            -> `WOOF:` a string search for this tag returns the
                starting index `i` of the resulting data. This
                can then be sliced from index `i + 5` to get a
                JSON parsable string representation.

                Ex:

                    $ python wolf.py /some/path/to/script.py
                    ...
                    WOOF: [{...}, {...}, ...]

                This is always the last item of the result, so
                you need not worry about an ending slice index.

                NOTE: May return wrong index if parsing the script
                for Home Alone. /jk

        """
    if not os.path.exists(filename):
        print("EXISTS_ERROR: " + filename +
              " <- file doesn't exist", file=sys.stderr)
        return 1

    # The full path to the script (including filename and extension)
    module_path = os.path.abspath(filename)

    # The `importable` name of the target file
    # ie: /home/duroktar/scripts/my_script.py  ->  my_script
    module_name = os.path.basename(module_path).split('.')[0]

    try:
        import_and_trace_script(module_name, module_path)
    except Exception as e:
        print('RUNTIME_ERROR: There was an error running the provided script..')
        print(e, file=sys.stderr)
        return 1

    if WOLF:
        print("DEBUG:" + pformat(WOLF, indent=4), file=sys.stderr)

        # It's important that we create an output that can be handled
        # by the javascript `JSON.parse(...)` function.
        python_data = ", ".join(json.dumps(i) for i in WOLF)

        # DO NOT TOUCH, ie: no pretty printing
        print("WOOF: [" + python_data + "]")  # <--  Wolf result
        ######################################
        return 0

    return 1


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("ARGS_ERROR: Must provide a file to trace.")
        exit(1)

    exit(main(sys.argv[1]))
