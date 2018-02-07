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
  const annotationDecoration: TextEditorDecorationType = vscode.window.createTextEditorDecorationType(
    {
      after: {
        color: cornflower,
        margin: "0 0 0 3em",
        textDecoration: "none"
      }
    } as DecorationRenderOptions
  );

  const extPath = vscode.extensions.getExtension("traBpUkciP.wolf")
    .extensionPath;

  const wolfStartCommand: Disposable = vscode.commands.registerCommand(
    "wolf.barkAtCurrentFile",
    () => {
      const activeEditor: TextEditor = vscode.window.activeTextEditor;
      const current = activeEditor.document.fileName;
      activeSessions[path.basename(current)] = activeEditor;
      triggerUpdateDecorations();
    }
  );

  const wolfStopCommand: Disposable = vscode.commands.registerCommand(
    "wolf.stopBarking",
    () => {
      stopAllSessions();
    }
  );

  context.subscriptions.push(wolfStartCommand);
  context.subscriptions.push(wolfStopCommand);

  vscode.window.onDidChangeActiveTextEditor(
    event => {
      const activeEditor: TextEditor = vscode.window.activeTextEditor;
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
      const activeEditor: TextEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeSessions[path.basename(event.fileName)]) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  let timeout = null;
  function triggerUpdateDecorations() {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(updateDecorations, 500);
  }

  function stopCurrentSession() {
    const activeEditor: TextEditor = vscode.window.activeTextEditor;
    const current = activeEditor.document.fileName;
    activeEditor.setDecorations(annotationDecoration, []);
    activeSessions[path.basename(current)] = undefined;
  }

  function stopAllSessions() {
    const activeEditor: TextEditor = vscode.window.activeTextEditor;
    for (let e of Object.keys(activeSessions)) {
      activeSessions[e].setDecorations(annotationDecoration, []);
    }
    activeSessions = {};
  }

  function updateDecorations() {
    const activeEditor: TextEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }
    const script = activeEditor.document.fileName;
    const script_dir = path.dirname(script);

    const wolf_path = path.join(extPath, "scripts/wolf.py");

    const python = spawn("python", [wolf_path, script], { cwd: script_dir });

    python.stderr.on("data", data => {
      // TODO: Check for other error TAGS (see: `scripts/wolf.py` in main function)
      if (data.includes("IMPORT_ERROR")) {
        // This means the 'hunter' package is not installed .. Notify
        // and offer to install for user automatically.
        const installHunter: MessageItem = { title: "Install Package" };
        vscode.window
          .showInformationMessage(
            "Wolf requires the hunter package. Install now or run 'pip install hunter --user' manually.",
            installHunter
          )
          .then(result => {
            if (result === installHunter) {
              const child = spawn("pip", ["install", "hunter", "--user"], {
                cwd: script_dir
              });
              child.stderr.on("data", data => {
                console.error("INSTALL_ERROR:", data + "")
              });
              child.on("close", code => {
                if (code !== 0) {
                  vscode.window.showWarningMessage(
                    [
                      "There was an error attempting to install hunter. Please try running",
                      "'pip install hunter --user' manually."
                    ].join(" ")
                  );
                } else {
                  vscode.window.showInformationMessage(
                    "Hunter installed successfully. Re-running Wolf.."
                  );
                  triggerUpdateDecorations();
                }
              });
            }
          });
        }
        console.error('STDERR:', data + '')
      });

    python.stdout.on("data", data => {
      // The script didn't return an error code, let's
      // parse the data..
      const w_index = data.indexOf("WOOF:");
      if (w_index === -1) {
        // Nothing, maybe an new file ..
        return;
      }

      // TODO: Create a Wolf "OUTPUT" window
      console.log(`${data}`);

      // ---------

      let lines;
      try {
        // slice from the `WOLF:` tag (index + 5)
        lines = JSON.parse(data.slice(w_index + 5));
      } catch (err) {
        console.error("ERROR_LINES:", lines);
        console.error("JSON PARSE ERROR.");
        return;
      }

      const decorations: vscode.DecorationOptions[] = [];
      const annotations = {};
      // This is where we determine how each type will be
      // represented in the decoration.
      lines.forEach(element => {
        let value;
        const hasValue = element.hasOwnProperty('value');
        if (hasValue && element.kind === "line") {
          if (Array.isArray(element.value)) {
            value = "[" + element.value + "]";
          } else if (typeof element.value === "string") {
            value = '"' + element.value + '"';
          } else if (typeof element.value === "number") {
            value = element.value;
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
  }
}
