//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

import * as assert from "assert";
import { before } from 'mocha';

import * as vscode from "vscode";
import { WolfAPI } from "../../src/api";

suite("Extension Tests", () => {
  let api: WolfAPI
  let extension: vscode.Extension<WolfAPI>

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    extension = vscode.extensions.getExtension("trabpukcip.wolf")!;
    api = await extension?.activate();
  })

	test("Should provide extension @wolf", async () => {
    assert.notStrictEqual(extension, undefined, 'Extension not started');
  });

	test("Should activate extension @wolf", async () => {
    assert.notStrictEqual(api, undefined, 'No Wolf API');
    assert.strictEqual(extension?.isActive, true, 'Extension not active');
	});

	test("Should use Python 3", async () => {
    const pyVersion = await api.getPythonVersion()
    const [majorVersion, minorVersion] = pyVersion.split('.')

    assert.strictEqual(Number(majorVersion), 3, 'Must be running Python major version 3')
    assert.strictEqual(Number(minorVersion) > 5, true, 'Must be running Python 3.6 or higher')
	});
});
