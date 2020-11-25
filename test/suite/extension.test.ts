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
    assert.notStrictEqual(api, undefined, 'No Wolf API');

    assert.strictEqual(started?.isActive, true, 'Extension not active');
	});
});
