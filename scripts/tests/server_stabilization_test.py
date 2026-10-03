import asyncio
import json
import os
import socket
import subprocess
import sys
import unittest

import websockets


class LocalServerSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            cls.port = sock.getsockname()[1]
        cls.token = "test-token-for-wolf"
        server_path = os.path.join(os.path.dirname(__file__), "..", "server.py")
        cls.process = subprocess.Popen(
            [sys.executable, server_path, "127.0.0.1", str(cls.port), cls.token],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        asyncio.run(cls._wait_until_ready())

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

        result = asyncio.run(run_trace())
        self.assertEqual(result["statusCode"], 200)
        self.assertIsInstance(json.loads(result["total_output"]), list)

    def test_unauthorized_client_is_closed(self):
        async def connect_without_token():
            uri = "ws://127.0.0.1:{}/test".format(self.port)
            async with websockets.connect(uri) as websocket:
                await websocket.recv()

        with self.assertRaises(websockets.exceptions.ConnectionClosed):
            asyncio.run(connect_without_token())

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
            asyncio.run(connect_with_origin())


if __name__ == "__main__":
    unittest.main()
