//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

import * as assert from "assert";
import { join } from "path";

import * as vscode from "vscode";
import { WolfAPI } from "../../src/api";
import { openAndShowTextDocument } from "./helpers";

suite("Extension Tests", () => {
	test("Should generate decorations", async () => {

    await openAndShowTextDocument(join(__dirname, '../../', 'test', 'test.py'));

    const started = vscode.extensions.getExtension("trabpukcip.wolf");
    const api: WolfAPI = await started?.activate()

    assert.strictEqual(api.decorations.hasDecoratons, false, 'Decorations present too early');

    const documentText = api.activeEditor.document.getText();
    assert.notStrictEqual(documentText, '', 'Test file is empty')

    return new Promise(resolve => {
      api.on('decorations-changed', () => {
        assert.strictEqual(api.decorations.hasDecoratons, true, 'No decorations')
        resolve()
      })

      api.stepInWolf()
    })
	}).timeout(10000);
});
