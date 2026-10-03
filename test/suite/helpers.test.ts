import * as assert from "assert";
import * as vscode from "vscode";
import { fileIdentifier } from "../../src/helpers";
import { WolfClient } from "../../src/client";

suite("Helper Tests", () => {
    test("normalizes POSIX document identifiers consistently", () => {
        const document = { fileName: "/workspace/example.py" } as vscode.TextDocument;
        assert.strictEqual(fileIdentifier(document), "workspace/example.py");
    });

    test("preserves non-POSIX document identifiers", () => {
        const document = { fileName: "C:\\workspace\\example.py" } as vscode.TextDocument;
        assert.strictEqual(fileIdentifier(document), "C:\\workspace\\example.py");
    });

    test("settles connect when closed before the socket opens", async () => {
        const client = new WolfClient("127.0.0.1", "9", "pending-test");
        const pendingConnection = client.connect(0);
        client.close();
        await assert.rejects(pendingConnection, /closed before connecting/);
    });
});
