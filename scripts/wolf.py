r""" Wolf - It kicks the Quokkas ass.
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
import ast
import os
import sys
import re
import json
import traceback
import io
from collections import OrderedDict
from copy import deepcopy
from pprint import pformat
from importlib import util
from contextlib import contextmanager

from astunparse import unparse
from hunter import trace


###################
#
# Utilities, helper functions, regex ..

# This is to help us find lines tagged with a Wolf
# macro. If the line has a print statement, then we
# want the expression being printed, if it's a
# single variable, we want that. Etc..
#
# NOTE: See https://regex101.com/r/sf6nAH/15 for more info
WOLF_MACROS = re.compile(
    r"^(?!pass\s+|from\s+|import\s+|return\s+|continue\s+|if\s+|for\s+)((?P<variable>\w+)$|^(print\((?P<print>.+)\))|^(?P<macro_source>(?P<local>[^\d\W]+\s)*((?P<assignment>\=)?(?P<operator>\+\=|\-\=|\*\=|\\\=)* *)*(?P<macro>[\w\{\[\(\'\"].+)\#\s?\?[^\n]*))")

# XXX: For parsing hunter.CodePrinter output see:
# https://regex101.com/r/sf6nAH/2


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
    original_cwd = os.getcwd()
    os.chdir(script_dir)
    sys.path.insert(1, script_dir)
    yield
    os.chdir(original_cwd)
    sys.path.remove(script_dir)


def get_line_from_file(_file, lineno):
    with open(_file) as fs:
        lines = fs.readlines()
    if lineno <= len(lines):
        return lines[lineno - 1]
    else:
        return ""


def try_deepcopy(obj):
    """ 
        Deepcopy can throw a type error when sys modules are to be
        included in the object being copied.. It can also throw an
        AttributeError in python 3.5 for some reason..
    """
    try:
        return deepcopy(obj)
    except (TypeError, AttributeError):
        return obj


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
    if isinstance(value, bool):
        return str(value)
    if callable(value):
        return repr(value)
    if value is None:
        return 'None'
    return str(value)


def wolf_formats():
    # It's important that we create an output that can be handled
    # by the javascript `JSON.parse(...)` function.
    results = (json.dumps(i) for i in WOLF if contains_any(
        'value', i.keys()) or i['error'])
    python_data = ", ".join(results)

    return "[" + python_data + "]"

def wolf_prints():
    # DO NOT TOUCH, ie: no pretty printing
    print("WOOF: " + wolf_formats())  # <--  Wolf result
    ######################################


def parse_eval(*args, **kw):
    global WOLF
    event = kw.get('event')

    try:
        rv = eval(*args)
    except BaseException as e:
        if event['kind'] == 'line':
            thrown = traceback.format_exception_only(type(e), e)
            error = '\n'.join(thrown)
            source = event['source'].strip()
            metadata = OrderedDict([
                ("lineno",              event['lineno']),
                ("source",                       source),
                ("value",                     thrown[0]),
                ("error",                         error),
                # ("filename",          event['filename']),
            ])

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

    # NOTE: Consider refactoring this using
    #      class variables instead of globals.

    # We don't want any whitespace around our
    # source code that could mess up the parser.
    source = event['source'].strip()

    # These are the fields returned from each line
    # of the traced program. This is essentially
    # the metadata returned to the extension in the
    # WOLF list.
    metadata = OrderedDict([
        ("lineno",             event['lineno']),
        # "value"    <-  Defined below MAYBE..
    ])

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

    # Sometimes we have to skip an entry to prevent dupes
    skip = False

    # Regex match groups are used for convenience.
    if source not in ['pass', 'break', 'continue'] and match: # fixes https://github.com/Duroktar/Wolf/issues/28 to 30

        # TODO: We should be using the ast instead of regex for all cases.
        tree = ast.parse(source)

        # Simplest case.
        if match.group('variable'):
            if event.kind != 'call':
                value = parse_eval(match.group('variable'),
                                   _globals, _locals, event=event)
                metadata["source"] = event['source'],
            else:
                skip = True

        # A little magic to parse print args
        elif match.group('print'):
            buffer = io.StringIO()
            src_seg = unparse(tree).strip()
            try:
                to_eval = "print({}, file=wolf__buffer__)".format(src_seg[6:-1]) # fixes https://github.com/Duroktar/Wolf/issues/34
                exec(to_eval, _globals, {**_locals, 'wolf__buffer__': buffer})
                value = str(buffer.getvalue()).strip('\n')
            finally:
                buffer.close()

        # Macros require a few more steps..
        elif match.group('macro'):

            # XXX: This is to help avoid side effects when evaluating expressions
            m_locals_copy = {k: try_deepcopy(v) for k, v in _locals.items()}
            m_globals_copy = {k: try_deepcopy(v) for k, v in _globals.items()}

            if isinstance(tree.body[0], ast.Assign):
                node = tree.body[0]

                if hasattr(node, 'target'):
                    target = node.target
                else:
                    target = node.targets[0]

                # Get the variable name
                local_name = target.id

                if isinstance(tree.body[0], ast.AugAssign):
                    operator = {'Mult': '*=', 'Add': '+=', 'Sub': '-=', 'Div': '/='}[node.op]

                    # This get the value of the local variable from earlier
                    left_side_value = parse_eval(local_name, m_globals_copy, m_locals_copy, event=event)

                    # This evaluates the statement with the infixed operator
                    value = parse_eval("{} {} {}".format(left_side_value, operator, value), event=event)
                else:
                    # Basic macro to evaluate
                    value = parse_eval(source[source.index('=')+1:].strip(), m_globals_copy, m_locals_copy, event=event)

                # Make sure to display the output as a variable assignment
                value = "{} = {}".format(local_name, value)

            else:
                # Basic macro evaluation
                value = parse_eval(match.group('macro').strip(), m_globals_copy, m_locals_copy, event=event)
        else:
            # Basic macro evaluation
            value = parse_eval(match.group('macro').strip(), m_globals_copy, m_locals_copy, event=event)

        # Final results are formatted
        metadata['value'] = resultifier(value)

        if not skip and event.kind not in ['return', 'call']:
            # And lastly, update our WOLF results list
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

def test(snippet):
    """
        TODO
    """
    from tempfile import mkstemp

    testdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tests')
    tmpfile_path = mkstemp(suffix=".py", text=True)[1]
    full_path = os.path.abspath(tmpfile_path)
    tmpfile_name = os.path.basename(tmpfile_path).split('.')[0]
    filename = os.path.basename(tmpfile_path)

    with open(full_path, 'a', encoding="utf-8") as the_file:
        the_file.write(snippet.strip() + '\n')

    return main(full_path, test=True) 


def main(filename, test = False):
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

        XXX: This script can now be debugged from VS-Code. Simply choose
        `wolf.py Debug Session` from the list to start debugging with the
        `./test.py` selected as input automatically.
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

    try:

        import_and_trace_script(module_name, full_path)

    except BaseException as e:

        # If there's an error, we try to handle it and
        # send back data that can be used to decorate
        # the offending line.

        value = traceback.format_exception_only(type(e), e)[0]

        if isinstance(e, SyntaxError):
            lineno = getattr(e, 'lineno')
            value = e.msg
            source = e.line
        else:
            _, _, exc_traceback = sys.exc_info()
            tb = traceback.extract_tb(exc_traceback)[-1]
            for i in traceback.extract_tb(exc_traceback):
                if i.filename == filename:
                    tb = i
            lineno = tb.lineno
            source = tb.line

        metadata = OrderedDict([
            ("lineno",          lineno),
            # ("filename",   tb.filename),
            ("source",  source.strip()),
            ("value",            value),
            ("error",             True),
        ])

        # And tack the error on to the end of the response.
        WOLF.append(metadata)

    # handle testing
    if test:
        res = wolf_formats()
        WOLF.clear()
        try:
            os.remove(full_path)
        except PermissionError:
            pass
        finally:
            return res 

    # print the results and return a 0 for the exit code
    wolf_prints()
    return 0


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("ARGS_ERROR: Must provide a file to trace.")
        exit(1)

    sys.exit(main(sys.argv[1]))
