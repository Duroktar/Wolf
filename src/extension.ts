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

let activeSessions = {};

export function activate(context: vscode.ExtensionContext) {
  let extPath: Extension<any>["extensionPath"] = vscode.extensions.getExtension(
    "traBpUkciP.wolf"
  ).extensionPath;

  const disposable: Disposable = vscode.commands.registerCommand(
    "wolf.barkAtCurrentFile",
    () => {
      let activeEditor: TextEditor = vscode.window.activeTextEditor;
      let current = activeEditor.document.fileName;
      activeSessions[path.basename(current)] = activeEditor;
      updateDecorations();
    }
  );

  const finishDisposable: Disposable = vscode.commands.registerCommand(
    "wolf.stopBarking",
    () => {
      stopAllSessions();
    }
  );

  vscode.window.onDidChangeActiveTextEditor(
    event => {
      let activeEditor: TextEditor = vscode.window.activeTextEditor;
      if (
        activeEditor &&
        activeSessions[path.basename(event.document.fileName)]
      ) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidSaveTextDocument(
    event => {
      let activeEditor: TextEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeSessions[path.basename(event.fileName)]) {
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

  function stopCurrentSession() {
    let activeEditor: TextEditor = vscode.window.activeTextEditor;
    let current = activeEditor.document.fileName;
    activeEditor.setDecorations(annotationDecoration, []);
    activeSessions[path.basename(current)] = undefined;
  }

  function stopAllSessions() {
    let activeEditor: TextEditor = vscode.window.activeTextEditor;
    for (let e of Object.keys(activeSessions)) {
      activeSessions[e].setDecorations(annotationDecoration, []);
    }
    activeSessions = {};
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
    let activeEditor: TextEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }
    try {
      const script = activeEditor.document.fileName;
      const script_dir = path.dirname(script);

      let wolf_path = path.join(extPath, "scripts/wolf.py");

      let python = spawn("python", [wolf_path, script], { cwd: script_dir });

      python.stderr.on("data", data => {
        if (data.includes("IMPORT_ERROR")) {
          vscode.window.showInformationMessage(
            "Wolf requires the hunter package. Please run 'pip install hunter --user' and try again."
          );
        }
        console.error(`ERROR: ${data}`);
        console.error(`ERROR MESSAGE: ${data.message}`);
      });

      python.stdout.on("data", data => {
        const w_index = data.indexOf("WOOF:");
        if (w_index === -1) {
          return;
        }
        const decorations: vscode.DecorationOptions[] = [];
        const lines = JSON.parse(data.slice(w_index + 5));
        console.log(`WOLF_DATA:`, JSON.stringify(data));
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
          const line = activeEditor.document.lineAt(parseInt(key, 10));
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
    } catch (err) {
      console.log('ERROR in "updateDecorations" -> ', err.message);
      console.error(err);
    }
  }

  context.subscriptions.push(disposable);
}
