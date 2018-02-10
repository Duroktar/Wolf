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
import time
import traceback
from pprint import pformat
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
# TODO: timer macro
#
# XXX: This will NOT work with destructured assignments.
# Named search groups are returned for convenience:
#   variable            <- the simplest case, a single variable
#   assignment          <- the variable being assigned to
#   print               <- the expression being printed
#   for                 <- a for loop and its vars
#   while               <- a while loop and its predicate
#   (function, args)    <- a function and the args passed in
#   macro               <- the macro expression used
#   tag                 <- macro tag (optional)
#
# NOTE: See https://regex101.com/r/npWf6w/5 for demo
_macro_re = r'^(?!pass)(?P<variable>\w+)$|print\((?P<print>.+)\)|((^(?P<function>\w+)\((?P<args>.*)\)\s*|(?P<assignment>\w+)(\s*=|\+=|-=\s*).*|return (?P<return>.*)|(for\s*(?P<for>.+)( in ).*)|while\s*(?P<while>.*)(:\s*))(?P<macro>#[$!]{1})(?P<tag>[\w]{1})*)'
WOLF_MACROS = re.compile(_macro_re)
###########


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
        and restoring it afterwards. This trick allows
        relative imports to work on the target script.
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


# -% Globals %-
#
# WOLF[dict]: Results from each line trace
WOLF = []

# BACK_REFS[metadata]: Queued evaluations
BACK_REFS = []
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
    if callable(value):
        return repr(value)
    elif value is None:
        return ''
    else:
        return value

b = {}


def wolf_prints():
    # It's important that we create an output that can be handled
    # by the javascript `JSON.parse(...)` function.
    python_data = ", ".join(json.dumps(resultifier(i)) for i in WOLF if 'value' in i.keys())

    # DO NOT TOUCH, ie: no pretty printing
    print("WOOF: [" + python_data + "]")  # <--  Wolf result
    ######################################


def try_eval(*args, **kw):
    global WOLF
    event = kw.get('event')

    try:
        rv = eval(*args)
    except Exception as e:
        if event['kind'] == 'line':
            metadata = {
                "line_number": event['lineno'],
                "kind": event['kind'],
                "value": repr(e),
                "error": True
            }

            WOLF.append(resultifier(metadata))

            wolf_prints()

            sys.exit(0)
    else:
        return rv


def result_handler(event):
    """
        Called by the `trace` function to handle any actions post
        filter. ie: trace => filter => result_handler

        Side Effects: Results are appended to the global WOLF list.
    """

    # XXX: WARNING, SIDE EFFECTS MAY INCLUDE:
    global WOLF
    global BACK_REFS

    # NOTE: Consider refactoring this using
    #      class variables instead of globals.

    # We don't want any whitespace around our
    # source code that could mess up the parser.
    source = event['source'].strip()

    # These are the fields returned from each line
    # of the traced program. This is essentially
    # the metadata returned to the extension in the
    # WOLF list.
    metadata = {
        "line_number":        event['lineno'],
        "kind":                 event['kind'],
        "depth":               event['depth'],
        "source":             event['source'],
        # "value"      <-  Defined below MAYBE..
    }

    # If this is still None by the end of the
    # call, then no value will be present in
    # the metadata. The extension will then
    # use this fact to not create annotations
    # for that line.
    value = None

    # We'll need to look up any values in the
    # correct scope, so let's grab the locals
    # and globals from the current frame to
    # use later on.
    _globals = event['globals']
    _locals = event['locals']

    # This regex does all the heavy lifting. Check out
    # https://regex101.com/r/npWf6w/5 for an example of
    # # how it works.
    match = WOLF_MACROS.search(source)

    # Evaluate any pending back refs.. (do this before putting
    # any current refs in, so we don't just pull them back out
    # in the same call.)
    if BACK_REFS:
        ref = BACK_REFS.pop()
        # The "depth" let's us know when we've returned to the
        # calling scope (ie: the right hand side has been fully
        # evaluated.) So if the left hand side calls from depth
        # 4, then the right hand side will be evaluated in depth
        # 5, and once back to 4 can be considered finished.
        if ref['depth'] == event['depth'] and event['kind'] != 'call':
            # Right hand side is finished evaluating, we can
            # now finish with the left hand side and update
            # the WOLF result list.

            # This handles destructured assignments. Multiple
            # variables on the left side need to stay grouped
            # together in the result.
            if isinstance(ref['_brf'], list):
                brf_result = []
                for var in ref['_brf']:
                    brf_result.append(try_eval(var, _globals, _locals, event=event))

                # Flatten it out so we don't get deeply nested lists
                # in our results.
                brf_result = brf_result[0] if len(brf_result) == 1 else brf_result

            # Otherwise it's just a single variable and we can evaluate
            # it right away.
            else:
                brf_result = try_eval(ref['_brf'], _globals, _locals, event=event)

            # Add the original ref to our result and tack on the value
            # to be decorated.
            WOLF.append({**ref, 'value': resultifier(brf_result)})
        elif ref['depth'] > event['depth']:

            # In this case, we are _not_ done evaluating the right
            # hand side, so we'll put the ref back into the queue.
            # This is because either the "depth" was not back to
            # the calling depth, or the "depth" is the same but the
            # line is a reference to a "call" (which will have the
            # same depth and cause an error) and not a "line". If
            # drop to a _lower_ depth, then we'll discard the ref
            # as it's N + 1 and not part of the pass.
            BACK_REFS.append(ref)


    # Now that back-refs are done, we can move on to the current
    # ref. We'll check for macros first then single word lines.
    if match:
        # Hunter is basically a "pre" hook, so if we want
        # the value on the left hand side of the current
        # expression we need to wait until the right hand
        # side has actually been evaluated, otherwise we
        # get stale or undefined values.
        if match['assignment']:
            # save it for lookup on the next line, this way
            # we don't do another needless regex next run.
            metadata['_brf'] = match['assignment']
            BACK_REFS.append(metadata)

        # The simplest case is a variable, which we'll just
        # evaluate it directly.
        if match['variable']:
            value = try_eval(match['variable'], _globals, _locals, event=event)

        # In the case of print, we evaluate and return the same
        # expression passed in.
        if match['print']:
            value = try_eval(match['print'], _globals, _locals, event=event)

        if match['return']:
            value = try_eval(match['return'], _globals, _locals, event=event)

        if match['for']:
            accum = []
            loop_vars = match['for'].split(',')
            for var in loop_vars:
                accum.append(var)
            metadata['_brf'] = accum
            metadata['_loop'] = True
            BACK_REFS.append(metadata)

        if match['while']:
            metadata['_brf'] = match['while']
            metadata['_loop'] = True
            BACK_REFS.append(metadata)

        if match['function']:
            value = try_eval(f'{match["function"]}(*[{match["args"]}])', _globals, _locals, event=event)

    if value is not None:
        # We only set the value if there is one, because the client
        # will determine if it should decorate the line or not
        # based on the existence of this field.
        metadata['value'] = resultifier(value)

    WOLF.append(metadata)


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

    # The `import`able name of the target file
    # ie: /home/duroktar/scripts/my_script.py  ->  my_script
    module_name = os.path.basename(module_path).split('.')[0]

    # Okay, so let's go ahead and fire this thing up.
    try:

        import_and_trace_script(module_name, module_path)

    except Exception as e:

        # If there's an error, we try to handle it and
        # send back data that can be used to decorate
        # the offending line.
        # 
        # NOTE: I prefer the `repr(e)` over inspects object
        # repr, so I decided to use that instead.
        exc_type, exc_value, exc_traceback = sys.exc_info()
        tb = traceback.extract_tb(exc_traceback)[-1]
        metadata = {
            "line_number": tb[1],
            "value": repr(e),
            "error": True
        }

        # And tack the error on to our response.
        WOLF.append(resultifier(metadata))

    if WOLF:

        # Just some pretty lines for visual debugging. We can send
        # data to `stderr` and `stdout` because the client has a
        # different handler implemented for each.
        # print("DEBUG:" + pformat(WOLF, indent=4), file=sys.stderr)

        # We must have some data ready for the client, let's print
        # the results and return a 0 for the exit code
        wolf_prints()
        return 0

    # This isn't necessarily an error (maybe the file is empty). Either
    # way, we'll return 1 so the extension can skip the render loop by
    # minding the status code.
    return 1


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("ARGS_ERROR: Must provide a file to trace.")
        exit(1)

    sys.exit(main(sys.argv[1]))
