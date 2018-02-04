import * as vscode from "vscode";
import * as path from "path";
import {
  DecorationOptions,
  DecorationRenderOptions,
  TextDocument,
  TextEditor,
  Extension,
  TextEditorDecorationType,
  Disposable,
  MessageItem
} from "vscode";

const { spawn, spawnSync } = require("child_process");

const cornflower = "#6495ed";

let activeSessions = {};

export function activate(context: vscode.ExtensionContext) {
  console.log('Initializing Wolf');
  let extPath: Extension<any>["extensionPath"] = vscode.extensions.getExtension(
    "traBpUkciP.wolf"
  ).extensionPath;

  const disposable: Disposable = vscode.commands.registerCommand(
    "wolf.barkAtCurrentFile",
    () => {
      let activeEditor: TextEditor = vscode.window.activeTextEditor;
      let current = activeEditor.document.fileName;
      activeSessions[path.basename(current)] = activeEditor;
      console.log('STARTING ON NEW FILE');
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
          const installHunter: MessageItem = { title: "Install Package" };
          vscode.window.showInformationMessage(
            "Wolf requires the hunter package. Install now or run 'pip install hunter --user' manually.",
            installHunter
          ).then(result => {
            if (result === installHunter) {
              let child = spawn('pip', ['install', 'hunter', '--user'], { cwd: script_dir })
              child.stderr.on('data', data => console.error("ERROR:", data + ""))
              child.on('close', code => {
                if (code !== 0) {
                  vscode.window.showWarningMessage([
                    "There was an error attempting to install hunter. Please try running",
                    "'pip install hunter --user' manually."
                  ].join(' '))
                } else {
                  vscode.window.showInformationMessage('Hunter installed successfully. Re-running Wolf..')
                  triggerUpdateDecorations();
                }
              })
            }
          })
        }
        console.error(`ERROR: ${data}`);
      });

      python.stdout.on("data", data => {
        const w_index = data.indexOf("WOOF:");
        if (w_index === -1) {
          return;
        }
        console.log(`${data}`);
        const decorations: vscode.DecorationOptions[] = [];
        let lines
        try {
          lines = JSON.parse(data.slice(w_index + 5));
        } catch(err) {
          console.error('JSON PARSE ERROR.');
          return;
        }
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
  context.subscriptions.push(finishDisposable);
}
