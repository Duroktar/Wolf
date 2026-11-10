"""Run one raw-source trace in a short-lived Wolf worker process.

The worker reads one JSON request from stdin and writes newline-delimited JSON
records to stdout. User program output is redirected to stderr so it cannot
corrupt the worker protocol.
"""
import json
import sys

from wolf import Wolf


def write_record(stream, record):
    stream.write(json.dumps(record) + "\n")
    stream.flush()


def main():
    protocol_stdout = sys.stdout
    user_stdout = sys.stdout
    user_dunder_stdout = sys.__stdout__

    # Keep target-program output separate from the machine-readable protocol.
    sys.stdout = sys.stderr
    sys.__stdout__ = sys.stderr

    try:
        request = json.load(sys.stdin)
        if not isinstance(request, dict) or not isinstance(request.get("source"), str):
            write_record(protocol_stdout, {
                "type": "error",
                "message": "Worker request must be an object with a string 'source'.",
            })
            return 1

        wolf = Wolf()
        wolf.add_listener(lambda line: write_record(protocol_stdout, {
            "type": "line",
            "data": line,
        }))
        output = wolf.run_for_source(request["source"])
        write_record(protocol_stdout, {
            "type": "complete",
            "output": output,
        })
        return 0
    except BaseException as exc:
        write_record(protocol_stdout, {
            "type": "error",
            "message": "{}: {}".format(type(exc).__name__, exc),
        })
        return 1
    finally:
        sys.stdout = user_stdout
        sys.__stdout__ = user_dunder_stdout


if __name__ == "__main__":
    sys.exit(main())
