//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

import * as assert from "assert";

import * as vscode from "vscode";
import { WolfAPI } from "../../src/api";

suite("Extension Tests", () => {
	test("Should provide extension @wolf", async () => {
    const started = vscode.extensions.getExtension("trabpukcip.wolf");
    
    assert.notStrictEqual(started, undefined, 'Extension not started');
  });
  
	test("Should activate extension @wolf", async () => {

    const started = vscode.extensions.getExtension("trabpukcip.wolf");

    const api: WolfAPI = await started?.activate()
    api.stopServer();

    assert.notStrictEqual(api, undefined, 'No Wolf API');

    assert.strictEqual(started?.isActive, true, 'Extension not active');
	});
  
	test("Should use Python 3", async () => {

    const started = vscode.extensions.getExtension("trabpukcip.wolf");

    const api: WolfAPI = await started?.activate()
    api.stopServer();

    const pyVersion = await api.getPythonVersion()
    const [majorVersion, minorVersion] = pyVersion.split('.')

    assert.strictEqual(Number(majorVersion), 3, 'Must be running Python major version 3')
    assert.strictEqual(Number(minorVersion) > 6, true, 'Must be running Python 3.6 or higher')
	});
});
