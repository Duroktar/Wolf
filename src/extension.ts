import * as vscode from "vscode";
import * as path from "path";
import {
  DecorationOptions,
  DecorationRenderOptions,
  TextDocument,
  TextEditor,
  Extension,
  TextEditorDecorationType,
  Disposable
} from "vscode";

const { spawn } = require("child_process");

const cornflower = "#6495ed";
const orange = "#ec8443";

export function activate(context: vscode.ExtensionContext) {
  console.log("The Wolf is running");

  let activeEditor: TextEditor = vscode.window.activeTextEditor;
  let extPath: Extension<any>["extensionPath"] = vscode.extensions.getExtension(
    "traBpUkciP.wolf"
  ).extensionPath;

  vscode.workspace.onDidSaveTextDocument(
    event => {
      if (activeEditor && event.fileName === activeEditor.document.fileName) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  var timeout = null;
  function triggerUpdateDecorations() {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(updateDecorations, 500);
  }

  const annotationDecoration: TextEditorDecorationType = vscode.window.createTextEditorDecorationType(
    {
      after: {
        color: cornflower,
        margin: "0 0 0 3em",
        textDecoration: "none"
      }
    } as DecorationRenderOptions
  );

  function updateDecorations() {
    if (!activeEditor) {
      return;
    }

    const script: TextDocument["fileName"] = activeEditor.document.fileName;
    const script_dir = path.dirname(script);

    let wolf_path = path.join(extPath, "scripts/wolf.py");
    console.log("SCRIPT_DIR:", script_dir);

    let python = spawn("python", [wolf_path, script], { cwd: script_dir });

    python.stderr.on("data", data => {
      console.error(`ERROR: ${data}`);
      console.error(`ERROR MESSAGE: ${data.message}`);
    });

    python.stdout.on("data", data => {
      const w_index = data.indexOf("WOOF:");
      if (w_index === -1) {
        // XXX Need to do some error parsing
        return;
      }
      const decorations: vscode.DecorationOptions[] = [];
      const lines = JSON.parse(data.slice(w_index + 5));
      console.log(`WOLF_DATA: ${data}`);
      const annotations = {};
      lines.forEach(element => {
        let value;
        if (element.value && element.kind === "line") {
          if (Array.isArray(element.value)) {
            value = "[" + element.value + "]";
          } else if (typeof element.value === "string") {
            value = '"' + element.value + '"';
          } else if (typeof element.value === "number") {
            value = parseInt(element.value);
          } else if (typeof element.value === "object") {
            value = JSON.stringify(element.value);
          } else {
            value = `${element.value}`;
          }
          const currentLine = element.line_number - 1;
          const wasSeen = annotations[currentLine] || false;
          const results = wasSeen ? [...wasSeen, value] : value;
          annotations[currentLine] = [results];
        }
      });
      Object.keys(annotations).forEach(key => {
        const annotation = annotations[key];
        const currentLine = key;
        const line = activeEditor.document.lineAt(parseInt(currentLine, 10));
        const decoration = {
          range: line.range,
          renderOptions: {
            after: {
              contentText: `${annotation}`,
              fontWeight: "normal",
              fontStyle: "normal"
            }
          } as DecorationRenderOptions
        } as DecorationOptions;
        decorations.push(decoration);
      });

      activeEditor.setDecorations(annotationDecoration, decorations);
    });
  }
  const disposable: Disposable = vscode.commands.registerCommand(
    "wolf.barkAtCurrentFile",
    () => updateDecorations()
  );

  context.subscriptions.push(disposable);
}
