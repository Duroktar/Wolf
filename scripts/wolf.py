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
import signal
import traceback
import io
from copy import deepcopy
from pprint import pformat
from functools import wraps
from importlib import util
from contextlib import contextmanager, redirect_stdout
from threading import Thread

try:
    from hunter import trace, CallPrinter
except ImportError:
    print('IMPORT_ERROR: hunter not installed.', file=sys.stderr)
    exit(1)


###################
#
# Utilities, helper functions, regex ..

# This is to help us find lines tagged with a Wolf
# macro. If the line has a print statement, then we
# want the expression being printed, if it's a
# single variable, we want that.
#
# XXX: This will NOT work with destructured assignments.
# Named search groups are returned for convenience:
#   variable            <- the simplest case, a single variable
#   print               <- the expression being printed
#
# NOTE: See https://regex101.com/r/uRio5u/1 for demo
WOLF_MACROS = re.compile(r"""
    ^(?!pass\s*|return\s*|continue\s*|if\s*|while\s*|for\s*) 
        (
            (?P<variable>\w+)$   # 
            |
            print\((?P<print>.+)\)
            |
            ^(?P<macro_source>(\w+\s+\=+\s+)*(?P<macro>[^#\s].+)\#\s?\?)[^\n]*
        )
""", re.VERBOSE)

# For parsing CodePrinter output see:
# https://regex101.com/r/sf6nAH/2


def logout(*args, p=False):
    if p:
        print(pformat([pformat(i) for i in args]))
    else:
        print(pformat(args, width=200, indent=2), file=sys.stdout)


def logerr(*args):
    print(pformat(args, width=200, indent=2), file=sys.stderr)

# Slightly modified code taken from:
# https://www.saltycrane.com/blog/2010/04/using-python-timeout-decorator-uploading-s3/


class TimeoutError(Exception):
    def __init__(self, value="Timed Out"):
        self.value = value

    def __str__(self):
        return repr(self.value)


def timeout(seconds_before_timeout):
    _timeout_err = TimeoutError('Wolf timed out after [%s seconds] exceeded!' %
                                seconds_before_timeout)

    if(os.name == 'nt'):
        # windows does not support SIGALRM so we have to use a custom decorator :/
        # adapted from https://stackoverflow.com/questions/21827874/timeout-a-python-function-in-windows
        # Added v0.1.4 by Almenon
        def deco(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                res = [_timeout_err]

                def newFunc():
                    try:
                        res[0] = func(*args, **kwargs)
                    except Exception as e:
                        res[0] = e
                t = Thread(target=newFunc)
                t.daemon = True
                try:
                    t.start()
                    t.join(seconds_before_timeout)
                except Exception as e:
                    print('THREAD_ERROR: error starting thread', file=sys.stderr)
                    raise e
                ret = res[0]
                if isinstance(ret, BaseException):
                    raise ret
                return ret
            return wrapper
        return deco

    else:  # mac / linux
        def decorate(f):
            def handler(signum, frame):
                raise _timeout_err

            @wraps(f)
            def new_f(*args, **kwargs):
                old = signal.signal(signal.SIGALRM, handler)
                signal.alarm(seconds_before_timeout)
                try:
                    result = f(*args, **kwargs)
                finally:
                    signal.signal(signal.SIGALRM, old)
                signal.alarm(0)
                return result
            return new_f
        return decorate
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


def get_line_from_file(_file, lineno):
    with open(_file) as fs:
        lines = fs.readlines()
    if lineno <= len(lines):
        return lines[lineno - 1]
    else:
        return ""


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
COUNTER = 1
#########


def contains_any(*args):
    return any(i in args[-1] for i in args[:-1])


def resultifier(value):
    # Here we can set the string representation
    # of the result. For example, callables are
    # simply converted to their string repr. None
    # is converted to "None". And anything else
    # is pretty formatted to a string.
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
        return 'None'
    elif isinstance(value, int):
        return value
    else:
        return str(value)


def wolf_prints():
    # It's important that we create an output that can be handled
    # by the javascript `JSON.parse(...)` function.
    results = [json.dumps(i) for i in WOLF if contains_any(
        'value', 'std_out', i.keys()) or i['error']]
    python_data = ", ".join(results)

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
                "line_number":         event['lineno'],
                "counter":                     COUNTER,
                "source":      event['source'].strip(),
                "kind":                  event['kind'],
                "value":                        str(e),
                "pretty":                       str(e),
                "error":                          True,
                "calls":                event['calls'],
            }

            WOLF.append(metadata)
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
    global COUNTER

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
        "source":     event['source'].strip(),
        "counter":                    COUNTER,
        "error":                        False,
        # "value"    <-  Defined below MAYBE..
        # "pretty"                  <-  SAME..
    }

    # The annotation will take on this value
    # (if present).
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

    # if event.kind == 'exception':
    #     logout('ARG --> ', repr(event.arg[0]))
    # for key in dir(event):
    #     logout(f"{key} -> ", event[key])
    # value = try_eval(event.source.strip(),
    #                  _globals, _locals, event=event)

    # Regex match groups are used for convenience.
    if match:
        # else:
        # The simplest case is a variable, which we'll just
        # evaluate it directly.
        if match.group('variable'):
            value = try_eval(match.group('variable'),
                             _globals, _locals, event=event)

        # For "print"s, we can evaluate the args passed in.
        if match.group('print'):
            buf = io.StringIO()
            print(*try_eval(match.group('print'),
                            _globals, _locals, event=event), file=buf)
            value = str(buf.getvalue())
            buf.close()

        # For "print"s, we can evaluate the args passed in.
        if match.group('macro'):
            value = try_eval(match.group('macro').strip(),
                             deepcopy(_globals), deepcopy(_locals), event=event)
            metadata['source'] = match.group('macro_source')
            # logout('MACRO VALUE -->', value)

        # For "print"s, we can evaluate the args passed in.
        if match.group('macro'):
            value = try_eval(match.group('macro').strip(),
                             deepcopy(_globals), deepcopy(_locals), event=event)
            metadata['source'] = match.group('macro_source')
            # logout('MACRO VALUE -->', value)

        metadata['value'] = resultifier(value)

        # And a nicely formatted version as well.
        metadata['pretty'] = pformat(value, indent=4, width=60)

    # logout(metadata)
    WOLF.append(metadata)
    COUNTER += 1


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


@timeout(10)
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

            -> `THREAD_ERROR:` Captures errors from the Windows timeout thread.

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
        message = "EXISTS_ERROR: " + filename + " doesn't exist"
        print(message, file=sys.stderr)
        return 1

    # The full path to the script (including filename and extension)
    full_path = os.path.abspath(filename)

    # The `import`able name of the target file
    # ie: /home/duroktar/scripts/my_script.py  ->  my_script
    module_name = os.path.basename(full_path).split('.')[0]

    # Okay, so let's go ahead and fire this thing up.
    try:

        import_and_trace_script(module_name, full_path)

    except Exception as e:

        # If there's an error, we try to handle it and
        # send back data that can be used to decorate
        # the offending line.
        #
        # NOTE: I prefer the `repr(e)` over inspects object
        # repr, so I decided to use that instead.
        _, _, exc_traceback = sys.exc_info()
        tb = traceback.extract_tb(exc_traceback)[-1]
        if isinstance(e, SyntaxError):
            lineno = getattr(e, 'lineno')
            value = getattr(e, 'msg')
            source = get_line_from_file(full_path, tb[1])
        else:
            lineno = tb[1]
            value = str(e)
            source = ""
        metadata = {
            "line_number":     lineno,
            "counter":        COUNTER,
            "source":  source.strip(),
            "value":            value,
            "pretty":           value,
            "error":             True,
        }
        # And tack the error on to the end of the response.
        WOLF.append(metadata)

    else:
        # Otherwise clip the final return code/message from the stack
        # so it doesn't hide the last decoration.
        WOLF.pop()

    if WOLF:
        # For testing purposes
        # logout(WOLF, p=True)

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
