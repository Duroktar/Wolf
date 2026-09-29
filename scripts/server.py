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
import websockets
import concurrent.futures
from datetime import datetime

from wolf import Wolf


if len(sys.argv) > 1:
    wolf_host = sys.argv[1]
else:
    wolf_host = os.environ.get('WOLF_SERVER_INTERFACE', 'localhost')

if len(sys.argv) > 2:
    wolf_port = int(sys.argv[2])
else:
    wolf_port = int(os.environ.get('WOLF_SERVER_PORT', '9879'))


pool = concurrent.futures.ThreadPoolExecutor((os.cpu_count() or 1))
current_loop = None


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


def process_python_script(loop, websocket, filepath: str):
    wolf = Wolf()

    def handle_emit(line):
        try:
            future = asyncio.run_coroutine_threadsafe(
                websocket.send(res_200(json.dumps(line), filepath)),
                loop
            )
            future.result(timeout=5)
        except Exception as e:
            server_log(filepath, f"Error emitting line: {e}")

    wolf.add_listener(handle_emit)
    return wolf.run(filepath, test=True), False


def process_raw_source(loop, websocket, source: str, path: str):
    wolf = Wolf()

    def handle_emit(line):
        try:
            future = asyncio.run_coroutine_threadsafe(
                websocket.send(res_200(json.dumps(line), path)),
                loop
            )
            future.result(timeout=5)
        except Exception as e:
            server_log(path, f"Error emitting line: {e}")

    wolf.add_listener(handle_emit)
    return wolf.run_for_source(source), False


async def handler(websocket, path: str = ""):
    server_log(path, "Client Connected")
    try:
        while True:
            message = await websocket.recv()
            data = json.loads(message)

            if data.get('raw'):
                source = data['data']
                server_log(path, "Tracing Script")
                response, stop = await current_loop.run_in_executor(
                    pool, process_raw_source, current_loop, websocket, source, path
                )
                await websocket.send(res_200_eof(response, path))

            elif data.get('filepath'):
                filepath = data['filepath']
                server_log(path, "Tracing File: " + filepath)
                response, stop = await current_loop.run_in_executor(
                    pool, process_python_script, current_loop, websocket, filepath
                )
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

    server = await websockets.serve(handler_adapter, wolf_host, wolf_port)
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

