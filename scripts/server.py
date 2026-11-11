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
import json
import os
import sys
import asyncio
import subprocess
import queue
import threading
import time
import websockets
import concurrent.futures
import hmac
from datetime import datetime

if len(sys.argv) > 1:
    wolf_host = sys.argv[1]
else:
    wolf_host = os.environ.get('WOLF_SERVER_INTERFACE', 'localhost')

if len(sys.argv) > 2:
    wolf_port = int(sys.argv[2])
else:
    wolf_port = int(os.environ.get('WOLF_SERVER_PORT', '9879'))

wolf_token = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('WOLF_SERVER_TOKEN')
if not wolf_token:
    raise RuntimeError('Wolf server requires an authentication token.')


current_loop = None
WORKER_TIMEOUT_SECONDS = float(os.environ.get('WOLF_WORKER_TIMEOUT', '30'))
MAX_WORKERS = max(1, int(os.environ.get(
    'WOLF_MAX_WORKERS', str(min(os.cpu_count() or 1, 4))
)))
MAX_WORKER_OUTPUT_BYTES = max(1024, int(os.environ.get(
    'WOLF_MAX_WORKER_OUTPUT_BYTES', str(8 * 1024 * 1024)
)))
MAX_WORKER_RECORD_BYTES = max(256, min(MAX_WORKER_OUTPUT_BYTES, int(os.environ.get(
    'WOLF_MAX_WORKER_RECORD_BYTES', str(512 * 1024)
))))
MAX_WORKER_OUTPUT_QUEUE_RECORDS = max(1, int(os.environ.get(
    'WOLF_MAX_WORKER_OUTPUT_QUEUE_RECORDS', '16'
)))
pool = concurrent.futures.ThreadPoolExecutor(MAX_WORKERS)
worker_slots = threading.BoundedSemaphore(MAX_WORKERS)


class WorkerCancelled(Exception):
    """Raised when a trace client disconnects before its worker completes."""


class WorkerCapacityError(Exception):
    """Raised when all worker slots are occupied."""


def server_log(path: str, message):
    print(f"[{datetime.now().isoformat()}] path={path} -- {message}")


def res_200(response: str, path: str):
    return json.dumps({"statusCode": 200, "path": path, "output": response})


def res_200_eof(response: str, path: str):
    return json.dumps({"statusCode": 200, "path": path, "total_output": response, "eof": 1})


def res_400(path: str):
    return json.dumps({"statusCode": 400, "message": "Bad Request", "path": path})


def res_500(path: str):
    return json.dumps({"statusCode": 500, "message": "Internal Server Error", "path": path})


def res_503(path: str):
    return json.dumps({"statusCode": 503, "message": "Wolf is at worker capacity; retry shortly", "path": path})


def process_worker_request(loop, websocket, request, path: str, cancellation_event=None):
    worker_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'worker.py')
    process = subprocess.Popen(
        [sys.executable, worker_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        universal_newlines=True,
        bufsize=1,
    )
    output_lines = queue.Queue(MAX_WORKER_OUTPUT_QUEUE_RECORDS)
    reader_stop = threading.Event()

    def should_stop_reader():
        return reader_stop.is_set() or (
            cancellation_event is not None and cancellation_event.is_set()
        )

    def queue_output(item):
        while not should_stop_reader():
            try:
                output_lines.put(item, timeout=0.1)
                return True
            except queue.Full:
                continue
        return False

    def read_worker_output():
        total_bytes = 0
        try:
            while True:
                output_line = process.stdout.readline(MAX_WORKER_RECORD_BYTES + 1)
                if not output_line:
                    break
                record_bytes = len(output_line.encode('utf-8'))
                if record_bytes > MAX_WORKER_RECORD_BYTES:
                    queue_output(('limit', 'Worker protocol record exceeded the configured size limit'))
                    return
                total_bytes += record_bytes
                if total_bytes > MAX_WORKER_OUTPUT_BYTES:
                    queue_output(('limit', 'Worker output exceeded the configured size limit'))
                    return
                if not queue_output(('record', output_line)):
                    return
        finally:
            queue_output(('eof', None))

    reader = threading.Thread(target=read_worker_output)
    reader.daemon = True
    reader.start()

    def handle_emit(line):
        try:
            future = asyncio.run_coroutine_threadsafe(
                websocket.send(res_200(json.dumps(line), path)),
                loop
            )
            future.result(timeout=5)
        except Exception as e:
            server_log(path, f"Error emitting line: {e}")

    completed_output = None
    worker_error = None
    deadline = time.time() + WORKER_TIMEOUT_SECONDS

    def check_cancelled():
        if cancellation_event is not None and cancellation_event.is_set():
            raise WorkerCancelled('Trace client disconnected')

    try:
        process.stdin.write(json.dumps(request) + '\n')
        process.stdin.close()

        while True:
            check_cancelled()
            remaining = deadline - time.time()
            if remaining <= 0:
                raise subprocess.TimeoutExpired(process.args, WORKER_TIMEOUT_SECONDS)
            try:
                output_type, output_line = output_lines.get(timeout=min(remaining, 0.1))
            except queue.Empty:
                continue
            if output_type == 'eof':
                break
            if output_type == 'limit':
                raise RuntimeError(output_line)

            record = json.loads(output_line)
            if record.get('type') == 'line':
                check_cancelled()
                handle_emit(record.get('data'))
            elif record.get('type') == 'complete':
                completed_output = record.get('output')
            elif record.get('type') == 'error':
                worker_error = record.get('message', 'Worker failed')

        while True:
            check_cancelled()
            remaining = deadline - time.time()
            if remaining <= 0:
                raise subprocess.TimeoutExpired(process.args, WORKER_TIMEOUT_SECONDS)
            try:
                return_code = process.wait(timeout=min(remaining, 0.1))
                break
            except subprocess.TimeoutExpired:
                continue
        if worker_error:
            raise RuntimeError(worker_error)
        if return_code != 0 or not isinstance(completed_output, str):
            raise RuntimeError('Wolf worker exited without a completion record')
        return completed_output, False
    finally:
        reader_stop.set()
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        if process.stdin and not process.stdin.closed:
            process.stdin.close()
        reader.join(timeout=1)
        if process.stdout:
            process.stdout.close()


def run_admitted_worker_request(loop, websocket, request, path, cancellation_event):
    try:
        return process_worker_request(loop, websocket, request, path, cancellation_event)
    finally:
        worker_slots.release()


async def run_worker_for_websocket(websocket, request, path: str):
    if not worker_slots.acquire(False):
        raise WorkerCapacityError('All Wolf worker slots are occupied')
    cancellation_event = threading.Event()
    try:
        worker_future = current_loop.run_in_executor(
            pool,
            run_admitted_worker_request,
            current_loop,
            websocket,
            request,
            path,
            cancellation_event,
        )
    except BaseException:
        worker_slots.release()
        raise
    closed_future = asyncio.ensure_future(websocket.wait_closed())
    done, _ = await asyncio.wait(
        [worker_future, closed_future],
        return_when=asyncio.FIRST_COMPLETED,
    )

    if worker_future in done:
        closed_future.cancel()
        try:
            await closed_future
        except asyncio.CancelledError:
            pass
        return await worker_future

    cancellation_event.set()
    try:
        await worker_future
    except WorkerCancelled:
        pass
    except Exception as exc:
        server_log(path, 'Worker stopped after client disconnect: {}'.format(exc))
    return None


async def handler(websocket, path: str = ""):
    server_log(path, "Client Connected")
    try:
        authorization = getattr(websocket, 'request_headers', {}).get('Authorization')
        expected = 'Bearer ' + wolf_token
        if not isinstance(authorization, str) or not hmac.compare_digest(authorization, expected):
            await websocket.close(code=1008, reason='Unauthorized')
            server_log(path, "Rejected unauthenticated client")
            return

        while True:
            message = await websocket.recv()
            data = json.loads(message)
            if not isinstance(data, dict):
                await websocket.send(res_400(path))
                continue

            if data.get('raw') is True and isinstance(data.get('data'), str):
                source = data['data']
                server_log(path, "Tracing Script")
                response = await run_worker_for_websocket(
                    websocket, {"source": source}, path
                )
                if response is None:
                    return
                response, stop = response
                await websocket.send(res_200_eof(response, path))

            elif isinstance(data.get('filepath'), str) and data['filepath']:
                filepath = data['filepath']
                server_log(path, "Tracing File: " + filepath)
                response = await run_worker_for_websocket(
                    websocket, {"filepath": filepath}, filepath
                )
                if response is None:
                    return
                response, stop = response
                await websocket.send(res_200_eof(response, path))

            else:
                server_log(path, "Bad Request")
                await websocket.send(res_400(path))

            if stop:
                server_log(path, "Stopping")
                break

    except websockets.exceptions.ConnectionClosed:
        server_log(path, "Client Disconnected")
    except websockets.exceptions.WebSocketException as e:
        server_log(path, f"SOCKET ERROR: {e}")
    except WorkerCapacityError as e:
        server_log(path, str(e))
        try:
            await websocket.send(res_503(path))
        except Exception:
            pass
    except Exception as e:
        server_log(path, f"SERVER ERROR: {e}")
        try:
            await websocket.send(res_500(path))
        except Exception:
            pass


async def handler_adapter(*args):
    if len(args) == 2:
        websocket, path = args
    else:
        websocket = args[0]
        path = getattr(websocket, 'path', '')
        if not path and hasattr(websocket, 'request'):
            path = getattr(websocket.request, 'path', '')
    await handler(websocket, path)


async def main():
    global current_loop
    current_loop = asyncio.get_running_loop() if hasattr(asyncio, 'get_running_loop') else asyncio.get_event_loop()

    server = await websockets.serve(
        handler_adapter,
        wolf_host,
        wolf_port,
        origins=[None],
        max_size=8 * 1024 * 1024,
    )
    server_log("/", f"Wolf Tracing Server Started @ http://{wolf_host}:{wolf_port}/")
    try:
        await asyncio.Future()
    except asyncio.CancelledError:
        server.close()
        await server.wait_closed()


if __name__ == "__main__":
    try:
        if sys.version_info >= (3, 7):
            asyncio.run(main())
        else:
            loop = asyncio.get_event_loop()
            current_loop = loop
            loop.run_until_complete(main())
    except (KeyboardInterrupt, SystemExit):
        pass

