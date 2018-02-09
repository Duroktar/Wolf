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
const stopRed = "#ea2f36";

function indexOfEnd(string, target) {
  var io = string.indexOf(target);
  return io == -1 ? -1 : io + target.length;
}

let activeSessions = {};

export function activate(context: vscode.ExtensionContext) {
  const annotationDecoration: TextEditorDecorationType = vscode.window.createTextEditorDecorationType(
    {
      after: {
        // color: cornflower,
        margin: "0 0 0 3em",
        textDecoration: "none"
      }
    } as DecorationRenderOptions
  );

  function getActiveTextEditor() {
    return vscode.window.activeTextEditor;
  }
  
  function getActiveFileName() {
    return getActiveTextEditor().document.fileName;
  }
  
  const extPath = vscode.extensions.getExtension("traBpUkciP.wolf")
    .extensionPath;

  const wolfStartCommand: Disposable = vscode.commands.registerCommand(
    "wolf.barkAtCurrentFile",
    () => {
      const activeEditor: TextEditor = getActiveTextEditor();
      const current: string = getActiveFileName();
      activeSessions[path.basename(current)] = activeEditor;
      triggerUpdateDecorations();
    }
  );

  const wolfStopCommand: Disposable = vscode.commands.registerCommand(
    "wolf.stopBarking",
    () => {
      stopAndClearAllSessionDecorations();
    }
  );

  context.subscriptions.push(wolfStartCommand);
  context.subscriptions.push(wolfStopCommand);

  vscode.window.onDidChangeActiveTextEditor(
    event => {
      const activeEditor: TextEditor = getActiveTextEditor();
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
      const activeEditor: TextEditor = getActiveTextEditor();
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

  function _clearSessions() {
    activeSessions = {};
  }

  function registerNewSession(editor: TextEditor) {
    const activeEditor: TextEditor = getActiveTextEditor();
    const current: string = getActiveFileName();
    activeSessions[path.basename(current)] = activeEditor;
  }
  
  function removeSessionByName(name) {
    delete activeSessions[name];
  }

  function stopSessionByName(name) {
    activeSessions[name].setDecorations(annotationDecoration, []);
  }

  function clearEditorSessionDecorations(activeEditor: TextEditor) {
    const editorFileName: string = getActiveFileName();
    activeEditor.setDecorations(annotationDecoration, []);
  }

  function stopAndClearAllSessionDecorations() {
    const activeEditor: TextEditor = getActiveTextEditor();
    for (let sessionName of Object.keys(activeSessions)) {
      stopSessionByName(sessionName);
    }
    _clearSessions();
  }

  function updateDecorations() {
    const activeEditor: TextEditor = getActiveTextEditor();
    
    if (!activeEditor) {
      return;
    }

    clearEditorSessionDecorations(activeEditor);

    const scriptName: string = getActiveFileName();
    const scriptDir: string = path.dirname(scriptName);

    const wolfPath: string = path.join(extPath, "scripts/wolf.py");

    // const python = spawn("python", [wolfPath, scriptName], { cwd: scriptDir });
    const python = spawn("python", [wolfPath, scriptName]);

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
              const child = spawn("pip", ["install", "hunter", "--user"]);
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
      const w_index = indexOfEnd(data + "", "WOOF:");
      if (w_index === -1) {
        // Nothing, maybe a new file..
        return;
      }
      
      // ---------
      
      let lines;
      try {
        lines = JSON.parse(data.slice(w_index));
      } catch (err) {
        console.error("ERROR_DATA:", data);
        console.error("W_INDEX:", w_index);
        console.error("JSON PARSE ERROR.");
        return;
      }

      // TODO: Create a Wolf "OUTPUT" window
      // console.log(`${data}`);

      const decorations: vscode.DecorationOptions[] = [];
      const annotations = {};
      // This is where we determine how each type will be
      // represented in the decoration.
      lines.forEach(element => {
        let value;
        const hasValue = element.hasOwnProperty('value');
        if (hasValue && element.kind === "line" || element.error) {
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
          
          const meta = annotations[currentLine] || {};
          const hasSeen = meta.data;
          const payload = {
            _loop: false,
            _error: element.error ? true : false,
            data: null
          }

          if (hasSeen) {
            payload.data = [...hasSeen, value];
          } else {
            payload.data = [value];
          }
          
          if (element.hasOwnProperty('_loop')) {
            payload._loop = true;
          }
          annotations[currentLine] = payload;
        }
      });
      Object.keys(annotations).forEach(key => {
        const annotation = annotations[key];
        if (annotation._loop === true) {
          annotation.data.pop();
        }
        const line = activeEditor.document.lineAt(parseInt(key, 10));
        const decoration = {
          range: line.range,
          renderOptions: {
            after: {
              contentText: `${annotation.data}`,
              fontWeight: "normal",
              fontStyle: "normal",
              color: annotation._error ? stopRed : cornflower
            }
          } as DecorationRenderOptions
        } as DecorationOptions;

        decorations.push(decoration);
      });

      activeEditor.setDecorations(annotationDecoration, decorations);
    });
  }
}
