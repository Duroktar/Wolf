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


PY36 = sys.version_info[0:2] == (3, 6)

if PY36:
    print('In Python 3.6 .. Polyfilling asyncio.run')
    from asyncio_run import run
else:
    run = asyncio.run


wolf_host = os.environ.get('WOLF_SERVER_INTERFACE', 'localhost')
wolf_port = os.environ.get('WOLF_SERVER_PORT', '9879')


pool = concurrent.futures.ThreadPoolExecutor((os.cpu_count() or 1))
loop = asyncio.get_event_loop()


def server_log(path: str, message):
    print(f"[{datetime.now().isoformat()}] path={path} -- {message}")

def res_200(response: str, path: str):
    return json.dumps({ "statusCode" : 200, "path": path, "output": response })

def res_200_eof(response: str, path: str):
    return json.dumps({ "statusCode" : 200, "path": path, "total_output": response, "eof" : 1 })

def res_400(path: str):
    return json.dumps({ "statusCode" : 400, "message": "Bad Request", "path": path })

def res_500(path: str):
    return json.dumps({ "statusCode" : 500, "message": "Internal Server Error", "path": path })


def process_python_script(websocket, filepath: str):
    wolf = Wolf()
    def handle_emit(line: str):
        async def send_websocket_response():
            await websocket.send(res_200(json.dumps(line), filepath))
        run(send_websocket_response())
    wolf.add_listener(handle_emit)
    return wolf.main(filepath), False


def process_raw_source(websocket, source: str, path: str):
    wolf = Wolf()
    def handle_emit(line: str):
        async def send_websocket_response():
            await websocket.send(res_200(json.dumps(line), path))
        run(send_websocket_response())
    wolf.add_listener(handle_emit)
    return wolf.run_for_source(source), False


async def handler(websocket: websockets.WebSocketClientProtocol, path: str):
    server_log(path, "Client Connected")
    try:

        while True:

            message = await websocket.recv()

            data = json.loads(message)

            if data['raw'] == True:
                source = data['data']
                server_log(path, "Tracing Script")
                args = (pool, process_raw_source, websocket, source, path)
                response, stop = await loop.run_in_executor(*args)
                await websocket.send(res_200_eof(response, path))

            elif data['filepath']:
                filepath = data['filepath']
                server_log(path, "Tracing File: " + filepath)
                args = (pool, process_python_script, websocket, filepath)
                response, stop = await loop.run_in_executor(*args)
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
        await websocket.send(res_500(path))


if __name__ == "__main__":
    print(f'[{datetime.now().isoformat()}] Wolf Tracing Server Started @ http://{wolf_host}:{wolf_port}/')
    start_server = websockets.serve(handler, wolf_host, wolf_port)

    loop.run_until_complete(start_server)
    loop.run_forever()
