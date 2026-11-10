import asyncio
import json
import os
import socket
import subprocess
import sys
import tempfile
import unittest

import websockets


def run_async(coro):
    try:
        return asyncio.run(coro)
    except AttributeError:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


class LocalServerSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            cls.port = sock.getsockname()[1]
        cls.token = "test-token-for-wolf"
        server_path = os.path.join(os.path.dirname(__file__), "..", "server.py")
        env = os.environ.copy()
        env["WOLF_WORKER_TIMEOUT"] = "1"
        cls.process = subprocess.Popen(
            [sys.executable, server_path, "127.0.0.1", str(cls.port), cls.token],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=env,
        )
        run_async(cls._wait_until_ready())

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        try:
            cls.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.process.kill()
            cls.process.wait(timeout=5)

    @classmethod
    async def _wait_until_ready(cls):
        uri = "ws://127.0.0.1:{}/ready".format(cls.port)
        for _ in range(100):
            if cls.process.poll() is not None:
                raise AssertionError("Wolf server exited before accepting connections")
            try:
                async with websockets.connect(
                    uri,
                    extra_headers={"Authorization": "Bearer " + cls.token},
                ):
                    return
            except Exception:
                await asyncio.sleep(0.05)
        raise AssertionError("Wolf server did not become ready")

    def test_authenticated_raw_trace_completes(self):
        async def run_trace():
            uri = "ws://127.0.0.1:{}/test".format(self.port)
            async with websockets.connect(
                uri,
                extra_headers={"Authorization": "Bearer " + self.token},
            ) as websocket:
                await websocket.send(json.dumps({"raw": True, "data": "value = 7\nvalue"}))
                while True:
                    response = json.loads(await websocket.recv())
                    if response.get("eof"):
                        return response

        result = run_async(run_trace())
        self.assertEqual(result["statusCode"], 200)
        self.assertIsInstance(json.loads(result["total_output"]), list)

    def test_authenticated_filepath_trace_preserves_script(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as script:
            script.write("answer = 42  #?\n")
            filepath = script.name

        async def run_trace():
            uri = "ws://127.0.0.1:{}/test".format(self.port)
            async with websockets.connect(
                uri,
                extra_headers={"Authorization": "Bearer " + self.token},
            ) as websocket:
                await websocket.send(json.dumps({"filepath": filepath}))
                while True:
                    response = json.loads(await websocket.recv())
                    if response.get("eof"):
                        return response

        try:
            result = run_async(run_trace())
            self.assertEqual(result["statusCode"], 200)
            self.assertTrue(os.path.isfile(filepath))
            self.assertIsInstance(json.loads(result["total_output"]), list)
        finally:
            os.unlink(filepath)

    def test_worker_timeout_returns_error_and_server_remains_available(self):
        async def run_timeout_trace():
            uri = "ws://127.0.0.1:{}/test".format(self.port)
            async with websockets.connect(
                uri,
                extra_headers={"Authorization": "Bearer " + self.token},
            ) as websocket:
                await websocket.send(json.dumps({"raw": True, "data": "while True:\n    pass"}))
                return json.loads(await websocket.recv())

        async def run_normal_trace():
            uri = "ws://127.0.0.1:{}/test".format(self.port)
            async with websockets.connect(
                uri,
                extra_headers={"Authorization": "Bearer " + self.token},
            ) as websocket:
                await websocket.send(json.dumps({"raw": True, "data": "answer = 42  #?"}))
                while True:
                    response = json.loads(await websocket.recv())
                    if response.get("eof"):
                        return response

        result = run_async(run_timeout_trace())
        self.assertEqual(result["statusCode"], 500)
        next_result = run_async(run_normal_trace())
        self.assertEqual(next_result["statusCode"], 200)

    def test_unauthorized_client_is_closed(self):
        async def connect_without_token():
            uri = "ws://127.0.0.1:{}/test".format(self.port)
            async with websockets.connect(uri) as websocket:
                await websocket.recv()

        with self.assertRaises(websockets.exceptions.ConnectionClosed):
            run_async(connect_without_token())

    def test_browser_origin_is_rejected(self):
        async def connect_with_origin():
            uri = "ws://127.0.0.1:{}/test".format(self.port)
            async with websockets.connect(
                uri,
                origin="https://untrusted.example",
                extra_headers={"Authorization": "Bearer " + self.token},
            ):
                pass

        with self.assertRaises(websockets.exceptions.InvalidStatusCode):
            run_async(connect_with_origin())


if __name__ == "__main__":
    unittest.main()
