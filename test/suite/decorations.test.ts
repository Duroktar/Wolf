//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

import * as assert from "assert";
import * as vscode from "vscode";
import { before, after } from 'mocha';
import { join } from "path";

import { openAndShowTextDocument } from "./helpers";
import { WolfAPI } from "../../src/api";

suite("Extension Tests", () => {
  let api: WolfAPI
  let extension: vscode.Extension<WolfAPI>

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    extension = vscode.extensions.getExtension("trabpukcip.wolf")!;
    api = await extension?.activate();
    api?.startServer();
  })

  after(async () => {
    api?.stopServer();
  })

  test("Should generate decorations", async () => {
    assert.notStrictEqual(api, undefined, 'WolfAPI not found')
    return new Promise((resolve, reject) => {
      api.on('decorations-changed', () => {
        assert.strictEqual(api.activeEditorHasDecorations, true, 'No decorations')
        resolve()
      })

      api.on('decorations-error', () => {
        assert.strictEqual(api.activeEditorHasDecorations, true, 'No decorations')
        resolve()
      })

      openAndShowTextDocument(join(__dirname, '..', 'test.py'))
        .then(() => vscode.commands.executeCommand('wolf.barkAtCurrentFile'))
        .catch(reject)
    })
  })
    // This test can sometimes take a while (or fail randomly) on CI servers.
    .timeout(30000).retries(3);
});
