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
import json
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
# Utilities, helper functions, etc..


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
#########


def result_handler(event):
    """
        Called by the `trace` function to handle any actions post
        filter. ie: trace => filter => result_handler

        Side Effects: Results are appended to the global WOLF list.
    """

    # All hail the ..
    global WOLF

    source = event['source'].strip()

    # These are the fields returned from each line
    # of the traced program.
    meta = {
        "line_number":  event['lineno'],
        "kind":         event['kind'],
        "depth":         event['depth'],
        # "value"      <-  Defined below MAYBE..
    }

    # This is the important part. Wolf is interested
    # in single word statements in the source code,
    # so that when found, they can be evaluated and
    # returned to the Wolf client for line decoration.
    parts = source.split(' ')
    if len(parts) == 1:
        # Obviously, we need to look up the value in
        # the correct environment. So we build it here
        # using the globals and locals provided by the
        # event props.
        env = {**event['globals'], **event['locals']}
        value = env.get(firstFrom(parts))

        # Here we can set the string representations
        # of the results. For example, callables are
        # simply converted to Python strings.
        #
        #   ie: def add(a, b): return a + b
        #
        #   Will (usually) be represented as:
        #       <function add at 0x7f768395ad95>
        #
        # Result is stored in the meta `value` prop
        #########
        if value:
            if callable(value):
                meta['value'] = str(value)
            else:
                meta['value'] = value

    # XXX: SIDE EFFECT
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
