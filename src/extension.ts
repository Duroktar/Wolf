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
  MessageItem,
  workspace,
  Uri,
  TextLine,
  TextDocumentChangeEvent,
  Range,
  Position
} from "vscode";

const { spawn, spawnSync } = require("child_process");

export function activate(context: vscode.ExtensionContext) {
  const cornflower = "#6495ed";
  const stopRed = "#ea2f36";

  const redIcon = context
    .asAbsolutePath("media\\wolf-red.png")
    .replace(/\\/g, "/");

  const greenIcon = context
    .asAbsolutePath("media\\wolf-green.png")
    .replace(/\\/g, "/");

  interface WolfSessions {
    [id: string]: TextEditor;
  }

  let activeSessions: WolfSessions = {};
  let activeEditorCountLine: number = 0;

  let annotations = {};

  const annotationDecoration: TextEditorDecorationType = vscode.window.createTextEditorDecorationType(
    {
      after: {
        margin: "0 0 0 3em",
        textDecoration: "none"
      },
      gutterIconPath: greenIcon,
      gutterIconSize: "cover"
    } as DecorationRenderOptions
  );

  const annotationDecorationError: TextEditorDecorationType = vscode.window.createTextEditorDecorationType(
    {
      after: {
        margin: "0 0 0 3em",
        textDecoration: "none"
      },
      gutterIconPath: redIcon,
      gutterIconSize: "cover"
    } as DecorationRenderOptions
  );

  function getActiveTextEditor() {
    return vscode.window.activeTextEditor;
  }

  function getActiveFileName() {
    return getActiveTextEditor().document.fileName;
  }

  function setEnterWolfContext() {
    vscode.commands.executeCommand("setContext", "inWolfContext", true);
  }

  function setExitWolfContext() {
    vscode.commands.executeCommand("setContext", "inWolfContext", false);
  }

  const extPath: string = vscode.extensions.getExtension("traBpUkciP.wolf")
    .extensionPath;

  const wolfStartCommand: Disposable = vscode.commands.registerCommand(
    "wolf.barkAtCurrentFile",
    () => {
      const activeEditor: TextEditor = getActiveTextEditor();
      const current: string = getActiveFileName();
      activeSessions[path.basename(current)] = activeEditor;
      activeEditorCountLine = activeEditor.document.lineCount;
      setEnterWolfContext();
      triggerUpdateDecorations();
    }
  );

  const wolfStopCommand: Disposable = vscode.commands.registerCommand(
    "wolf.stopBarking",
    () => {
      setExitWolfContext();
      stopAndClearAllSessionDecorations();
    }
  );

  function pushSubscribers() {
    context.subscriptions.push(wolfStartCommand);
    context.subscriptions.push(wolfStopCommand);
  }

  pushSubscribers();

  function isActiveSession(document: TextDocument) {
    const activeEditor: TextEditor = getActiveTextEditor();
    return activeEditor && activeSessions[path.basename(document.fileName)]
      ? true
      : false;
  }

  vscode.window.onDidChangeActiveTextEditor(
    event => {
      const activeEditor: TextEditor = getActiveTextEditor();
      activeEditorCountLine = activeEditor.document.lineCount;

      if (isActiveSession(event.document)) {
        triggerUpdateDecorations();
        setEnterWolfContext();
      } else {
        setExitWolfContext();
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidSaveTextDocument(
    event => {
      const activeEditor: TextEditor = getActiveTextEditor();
      activeEditorCountLine = activeEditor.document.lineCount;
      if (activeEditor && activeSessions[path.basename(event.fileName)]) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeTextDocument(
    event => {
      const activeEditor: TextEditor = getActiveTextEditor();

      if (activeEditor && event.document === activeEditor.document) {
        if (activeEditor.document.isDirty) {
          triggerUpdateStickyDecorations(event);
        }
      }
    },
    null,
    context.subscriptions
  );

  let updateTimeout = null;
  function triggerUpdateDecorations() {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(updateDecorations, 500);
  }

  let stickyTimeout = null;
  function triggerUpdateStickyDecorations(event: TextDocumentChangeEvent) {
    if (stickyTimeout) {
      clearTimeout(stickyTimeout);
    }
    stickyTimeout = setTimeout(() => updateStickyDecorations(event), 100);
  }

  const debouncedUpdateDecorations = debounce(updateDecorations, 250);

  function debounce(func, wait, immediate?) {
    /*
      var myEfficientFn = debounce(function() {
        // All the taxing stuff you do
      }, 250);
    */
    let timeout;
    return function(...args) {
      let context = this;
      const later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      let callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
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
    activeSessions[name].setDecorations(annotationDecorationError, []);
  }

  function clearEditorSessionDecorations(activeEditor: TextEditor) {
    activeEditor.setDecorations(annotationDecoration, []);
    activeEditor.setDecorations(annotationDecorationError, []);
  }

  function stopAndClearAllSessionDecorations() {
    const activeEditor: TextEditor = getActiveTextEditor();
    for (let sessionName of Object.keys(activeSessions)) {
      stopSessionByName(sessionName);
    }
    _clearSessions();
  }

  function clearAnnotations() {
    annotations = {};
  }

  function createDecorations() {
    const activeEditor: TextEditor = getActiveTextEditor();

    const decorations: vscode.DecorationOptions[] = [];
    const errorDecorations: vscode.DecorationOptions[] = [];

    Object.keys(annotations).forEach(key => {
      const lineNo = parseInt(key, 10);
      const annotation = annotations[lineNo];

      if (!annotation.data) {
        return;
      }

      if (activeEditor.document.lineCount < lineNo) {
        return;
      }

      if (annotation._loop === true) {
        annotation.data.pop();
      }

      const textLine: TextLine = activeEditor.document.lineAt(lineNo - 1);
      const decoration = {
        range: textLine.range,
        renderOptions: {
          after: {
            contentText: annotation.data.join(" => "),
            fontWeight: "normal",
            fontStyle: "normal",
            color: annotation._error ? stopRed : cornflower
          }
        } as DecorationRenderOptions
      } as DecorationOptions;

      if (annotation._error) {
        errorDecorations.push(decoration);
      } else {
        decorations.push(decoration);
      }
    });

    clearEditorSessionDecorations(activeEditor);
    activeEditor.setDecorations(annotationDecoration, decorations);
    activeEditor.setDecorations(annotationDecorationError, errorDecorations);
  }

  function updateDecorations() {
    const activeEditor: TextEditor = getActiveTextEditor();

    if (!activeEditor) {
      return;
    }

    const scriptName: string = getActiveFileName();
    const scriptDir: string = path.dirname(scriptName);

    const wolfPath: string = path.join(extPath, "scripts/wolf.py");
    // const python = spawn("python", [wolfPath, scriptName], { cwd: scriptDir });
    const python = spawn("python", [wolfPath, scriptName]);

    python.stderr.on("data", data => {
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
                console.error("INSTALL_ERROR:", data + "");
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
      console.error("STDERR:", data + "");
    });

    function indexOfEnd(string, target) {
      let io = string.indexOf(target);
      return io === -1 ? -1 : io + target.length;
    }

    python.stdout.on("data", data => {
      const w_index = indexOfEnd(data + "", "WOOF:");

      if (w_index === -1) {
        return;
      }

      let lines;
      try {
        lines = JSON.parse(data.slice(w_index));
      } catch (err) {
        console.error("Error parsing Wolf output. ->");
        console.error(err);
        return;
      }

      clearAnnotations();

      lines.forEach(element => {
        const hasValue = element.hasOwnProperty("value");

        let value;
        if ((hasValue && element.kind === "line") || element.error) {
          if (Array.isArray(element.value)) {
            value = "[" + element.value.join(", ") + "]";
          } else if (typeof element.value === "string") {
            value = element.value;
          } else if (typeof element.value === "number") {
            value = element.value;
          } else if (typeof element.value === "object") {
            value = JSON.stringify(element.value);
          } else {
            value = `${element.value}`;
          }

          const currentLine: number = element.line_number;
          const meta = annotations[currentLine] || {};
          const payload = {
            data: [...(meta.data || []), value],
            _error: element.error ? true : false,
            _loop: element.hasOwnProperty("_loop"),
            _source: element.source
          };

          annotations[currentLine] = payload;
        }
      });

      createDecorations();
    });
  }

  // function used to attach bookmarks at the line
  function updateStickyDecorations(event: TextDocumentChangeEvent) {
    const activeEditor: TextEditor = getActiveTextEditor();

    if (event.contentChanges.length === 1) {
      const startIndex: number = event.contentChanges[0].range.start.character;
      const endLine: number = event.contentChanges[0].range.end.line;

      const activeDocument: TextDocument = activeEditor.document;
      const editLineNo: number = endLine + 1;

      const source: string = { ...annotations[editLineNo] }._source || "";

      if (event.document.lineCount != activeEditorCountLine) {
        if (event.document.lineCount > activeEditorCountLine) {
          // Added lines
          if (startIndex >= activeDocument.lineAt(editLineNo).text.length) {
            shiftDown(editLineNo + 1, activeEditorCountLine - 1, false);
          } else if (startIndex === 0) {
            shiftDown(editLineNo, activeEditorCountLine - 1, false);
          } else {
            shiftDown(editLineNo + 1, activeEditorCountLine - 1, false);
            delete annotations[editLineNo];
          }
        } else if (event.document.lineCount < activeEditorCountLine) {
          // Removed lines
          shiftUp(editLineNo, activeEditorCountLine - 1, false);
        }
      } else if (source.trim() !== activeDocument.lineAt(endLine).text.trim()) {
        delete annotations[editLineNo];
      }
      activeEditorCountLine = event.document.lineCount;
      createDecorations();
    } else if (event.contentChanges.length === 2) {
      activeEditorCountLine = event.document.lineCount;
      if (activeEditor.selections.length === 1) {
        const start: number = event.contentChanges[1].range.end.line;
        const end: number = event.contentChanges[0].range.end.line;
        if (event.contentChanges[0].text === "") {
          shiftDown(start + 1, end + 1);
        } else if (event.contentChanges[1].text === "") {
          shiftUp(start, end + 1);
        }
        createDecorations();
      }
    }
  }

  function shiftDown(start: number, end: number, swap: boolean = true) {
    const nextAnnotations = {};
    Object.keys(annotations).forEach(key => {
      const intKey = parseInt(key, 10);
      const nextKey = intKey >= start && intKey <= end ? intKey + 1 : intKey;
      nextAnnotations[nextKey] = { ...annotations[key] };
    });
    if (swap) {
      nextAnnotations[start] = { ...annotations[end] };
      nextAnnotations[end + 1] = { ...annotations[end + 1] };
    }
    annotations = { ...nextAnnotations };
  }

  function shiftUp(start: number, end: number, swap: boolean = true) {
    const nextAnnotations = {};
    Object.keys(annotations).forEach(key => {
      const intKey = parseInt(key, 10);
      const nextKey = intKey >= start && intKey <= end ? intKey - 1 : intKey;
      nextAnnotations[nextKey] = { ...annotations[key] };
    });
    if (swap) {
      nextAnnotations[end] = { ...annotations[start] };
      nextAnnotations[start - 1] = { ...annotations[start - 1] };
    }
    annotations = { ...nextAnnotations };
  }
}
