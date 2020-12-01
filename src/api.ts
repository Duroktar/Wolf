import * as fs from "fs";
import * as vscode from "vscode";
import type * as T from "./types";
import { EventEmitter } from "events";
import { platform } from "os";
import { spawn } from "child_process";
import { WolfSessionController } from "./sessions";
import { WolfDecorationsController } from "./decorations";
import { WolfOutputController } from "./output";
import { WolfError } from "./errors";
import { consoleLoggerFactory, wolfClientFactory } from "./factories";
import { fileIdentifier, getActiveEditor, makeTempFile } from "./helpers";
import { parseAndValidateResponse, parseAndValidateEofResponse } from "./helpers";
import { nameOf, not } from "./utils";
import { WolfClient } from "./client";


export class WolfAPI {
  private _logger = consoleLoggerFactory(nameOf(WolfAPI))
  private _changedConfigFlag = false;
  private _clients = new Array<WolfClient>()
  private _eventEmitter = new EventEmitter()

  constructor(
    private context: vscode.ExtensionContext,
    private _output: WolfOutputController,
    private _decorations: WolfDecorationsController,
    private _sessions: WolfSessionController,
  ) { }

  public stepInWolf = (isLiveEditing = false): void => {
    const logMessage = isLiveEditing ? 'in Live Mode' : '';
    this._logger.debug(`Starting ${logMessage}`)
    this.sessions.create({
      ...this.decorations.init(isLiveEditing),
      editor: this.activeEditor,
      isLiveEditing,
    });
    this.traceAndSetDecorations();
    this.enterWolfContext();
  };

  public stopWolf = (): void => {
    this._logger.debug('Stopping')
    this.decorations.clearFor(
      this.activeEditor,
      this.activeSession,
    );
    this.sessions.deleteFor(this.activeEditor);
    this.stopClient(this.activeEditor.document);
    this.exitWolfContext();
  };

  public stopSession = (document: vscode.TextDocument): void => {
    this._logger.debug('Stopping')
    this.sessions.deleteByName(document.fileName);
    this.stopClient(document);
    this.exitWolfContext();
  };

  public clearAll = (): void => {
    this._logger.debug('Clearing Decorations')
    for (const name of this.sessions.names) {
      const session = this.sessions.getByFileName(name);
      this.decorations.clear(session);
    }
    this._logger.debug('Clearing Sessions')
    this.sessions.clearAll();
  };

  public traceAndSetDecorations = (
    textDocument?: vscode.TextDocument,
  ): void => {
    const document = textDocument ?? this.activeEditor.document;

    const tempfile = makeTempFile(document.fileName);
    fs.writeFileSync(tempfile.name, document.getText());

    const clientPath = fileIdentifier(document);
    const wolfClient = wolfClientFactory(clientPath);

    this._clients.push(wolfClient);

    wolfClient
      .connect()
      .then(() => {
        // TODO: Move handlers into a proper Disposable class
        this._logger.debug('Tracing')
        
        const session = this.sessions.get(document)

        this._output.clear();

        wolfClient.traceRawSrc(document.getText())

        if (session.isLiveEditing)
          wolfClient.on('data', (result: T.WolfClientDataResponse) => {
            if (this.isWolfSession(document)) { // TODO: Move handlers into a proper Disposable class
              this._logger.debug('Received new data')

              const line = parseAndValidateResponse(result);
              this.decorations.setDataAtLine(session.decorations, line)
              this.decorations.renderTo(this.activeEditor, session);
  
              const filepath = this.activeEditor.document.uri.path;
              this.emit('decorations-updated', filepath, this.decorations);
            }
          })

        wolfClient.on('eof', (result: T.WolfClientEofResponse) => {
          this._logger.debug('Reached EOF');

          tempfile.removeCallback();

          this.stopClient(session.editor.document);

          if (this.isWolfSession(document)) { // TODO: Move handlers into a proper Disposable class
            const pythonData = parseAndValidateEofResponse(result);
  
            if (not(session.isLiveEditing)) {
              this.decorations.set(session, pythonData);
              this.decorations.renderTo(this.activeEditor, session);

              this._logger.debug('decorations-changed')
              this.emit('decorations-changed', document.fileName);
            }
            else {
              const { fileName } = session.editor.document;
              const message = `Wolf:\n"${fileName}" Exited\n`;
              vscode.window.showInformationMessage(message);
            }
  
            if (this.printLogging) {
              const output = this.prettyPrintWolfTraceData(pythonData);
              this.logToOutput(`(Wolf Output): ${JSON.stringify(output, null, 4)}`);
              this.logToOutput(`\n\nTotal Line Count: ${pythonData?.length}`);
            }
          }
        })

        wolfClient.on('error', (err: Error) => {
          tempfile.removeCallback()

          if (this.isWolfSession(document)) { // TODO: Move handlers into a proper Disposable class
            this._logger.debug('Error')
            this._logger.error(err)
  
            if (this.shouldOutputErrors)
              this.logToOutput("(Wolf Error):", err.message ?? '<no message>');
          }
        })

        wolfClient.on('close', () => {
          this._logger.debug('Closing')

          tempfile.removeCallback()
        })
      })
      .catch(() => tempfile.removeCallback())
  };

  public reRenderDecorations = (): void => {
    this._logger.debug('re-rendering')
    this.decorations.renderTo(
      this.activeEditor,
      this.sessions.get(this.activeEditor.document),
    );
  }

  public isLiveEditing = (
    document: vscode.TextDocument,
  ): boolean => {
    return this.sessions.isLiveEditing(document);
  };

  public isWolfSession = (
    document: vscode.TextDocument,
  ): boolean => {
    return this.sessions.isActive(document);
  };

  public enterWolfContext = (): void => {
    vscode.commands.executeCommand("setContext", "inWolfContext", true);
  };

  public exitWolfContext = (): void => {
    vscode.commands.executeCommand("setContext", "inWolfContext", false);
  };

  public setChangedConfigFlag(value: boolean): void {
    this._changedConfigFlag = value;
  }

  public logToOutput = (...text: string[]): void => {
    this._output.log(text.join(" "));
  };

  public emit = (
    event: T.WolfEvent,
    filepath: string,
    ...args: unknown[]
  ): void => {
    this._eventEmitter.emit(event, filepath, ...args)
  }

  public on = (
    event: T.WolfEvent,
    listener: (...args: unknown[]) => void,
  ): void => {
    this._eventEmitter.on(event, listener)
  }

  public get activeEditor(): vscode.TextEditor {
    return getActiveEditor();
  }

  public get activeSession(): T.WolfSession {
    const editor = getActiveEditor();
    return this.sessions.get(editor.document);
  }

  public get activeEditorIsDirty(): boolean {
    return this.activeEditor.document.isDirty;
  }

  public get activeEditorHasDecorations(): boolean {
    const session = this.sessions.get(this.activeEditor.document)
    return Object.keys(session.decorations).length > 0
  }

  public get configChanged(): boolean {
    return this._changedConfigFlag;
  }

  public get updateFrequency(): number | undefined {
    return this.config.get<number>("updateFrequency");
  }

  public get printLogging(): boolean | undefined {
    return this.config.get<boolean>("printLoggingEnabled");
  }

  public get updateOnSaveOnly(): boolean {
    return this.config.get<boolean>("updateOnSaveOnly") === false;
  }

  public get shouldOutputErrors(): boolean {
    return this.config.get<boolean>("logErrors") === true;
  }

  public get rootExtensionDir(): string {
    const res = vscode.extensions.getExtension("traBpUkciP.wolf");
    if (res?.extensionPath === undefined)
      throw new WolfError('no WolfAPI.rootExtensionDir)');
    return res.extensionPath;
  }

  public get pythonPath(): string {
    const fromconfig = this.config.get<string>("pythonPath")
    /* Github-Actions Windows CI tests don't like 'python3' */
    return fromconfig || this.__platform === "win32" ? 'python' : 'python3';
  }

  public getPythonMajorVersion(): Promise<string> {
    const child = spawn(this.pythonPath, ['--version']);
    return new Promise((resolve, reject) => {
      child.stderr.on('data', err => {
        reject(err);
      })
      child.stdout.on('data', (data: Buffer) => {
        resolve(data.toString().split(' ')[1].split('.')[0]);
      })
    })
  }

  private prettyPrintWolfTraceData = (
    data: T.WolfTraceLineResult[] = [],
  ): string[] => {
    return data.map(
      l =>
        `LINENO: ${l.lineno} - VALUE: ${l.value}${
        l.error ? `, ERROR: ${l.error}` : ""
        }`
    );
  }

  private stopClient(document: vscode.TextDocument): void {
    const wolfClient = this._clients
      .find(o => o.identifier === document.fileName)

    if (wolfClient == null)
      return

    wolfClient.close()

    this._clients = this._clients
      .filter(o => o !== wolfClient)
  }

  private get decorations(): WolfDecorationsController {
    return this._decorations;
  }

  private get sessions(): WolfSessionController {
    return this._sessions;
  }

  private get config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("wolf");
  }

  private __platform = platform().trim();
}
