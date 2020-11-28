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
    const started = vscode.extensions.getExtension("trabpukcip.wolf");
    const api: WolfAPI = await started?.activate()
    
    return new Promise(resolve => {
      api.on('decorations-changed', () => {
        assert.strictEqual(api.decorations.hasDecorations, true, 'No decorations')
        resolve()
      })

      openAndShowTextDocument(join(__dirname, '..', '..', 'test', 'test.py'))
        .then(() => api.stepInWolf())
    })
	}).timeout(30000); // This can sometimes take awhile on CI servers.
});
