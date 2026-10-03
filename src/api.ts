import * as vscode from "vscode";
import type * as T from "./types";
import { EventEmitter } from "events";
import { platform } from "os";
import { spawn } from "child_process";
import { WolfSessionController } from "./sessions";
import { WolfDecorationsController } from "./decorations";
import { WolfOutputController } from "./output";
import { consoleLoggerFactory, wolfClientFactory } from "./factories";

import { fileIdentifier, getActiveEditor } from "./helpers";
import { parseAndValidateResponse, parseAndValidateEofResponse } from "./helpers";
import { nameOf, not } from "./utils";
import { WolfClient } from "./client";
import { WolfServerDaemon } from "./server";


export class WolfAPI {
  private _logger = consoleLoggerFactory(nameOf(WolfAPI))
  private _changedConfigFlag = false;
  private _clients = new Map<string, WolfClient>()
  private _traceGenerations = new Map<string, number>()
  private _eventEmitter = new EventEmitter()

  constructor(
    private context: vscode.ExtensionContext,
    private _output: WolfOutputController,
    private _decorations: WolfDecorationsController,
    private _sessions: WolfSessionController,
    private _server: WolfServerDaemon,
  ) { }

  public stepInWolf = (isLiveEditing = false): void => {
    const editor = this.activeEditor;
    const existingSession = this.sessions.get(editor.document);
    if (existingSession) {
      this.stopClient(editor.document);
      this.decorations.dispose(existingSession);
    }
    const logMessage = isLiveEditing ? 'in Live Mode' : '';
    this._logger.debug(`Starting ${logMessage}`)
    this.sessions.create({
      ...this.decorations.init(isLiveEditing),
      editor,
      isLiveEditing,
    });
    this.traceAndSetDecorations();
    this.enterWolfContext();
  };

  public stopWolf = (): void => {
    this._logger.debug('Stopping')
    const editor = this.activeEditor;
    const session = this.sessions.get(editor.document);
    if (session) {
      this.stopClient(editor.document);
      this.decorations.dispose(session);
      this.sessions.deleteFor(editor);
    }
    this.exitWolfContext();
  };

  public stopSession = (document: vscode.TextDocument): void => {
    this._logger.debug('Stopping')
    const session = this.sessions.get(document);
    if (session)
      this.decorations.dispose(session);
    this.sessions.deleteByName(document.fileName);
    this.stopClient(document);
    if (vscode.window.activeTextEditor?.document.fileName === document.fileName)
      this.exitWolfContext();
  };

  public restartSession = (document: vscode.TextDocument): void => {
    const existingSession = this.sessions.get(document);
    if (!existingSession)
      return;

    const { editor, isLiveEditing } = existingSession;
    this.stopClient(document);
    this.decorations.dispose(existingSession);
    this.sessions.create({
      ...this.decorations.init(isLiveEditing),
      editor,
      isLiveEditing,
    });
    this.traceAndSetDecorations(document);
    if (vscode.window.activeTextEditor?.document.fileName === document.fileName)
      this.enterWolfContext();
  };

  public clearAll = (): void => {
    this._logger.debug('Clearing Decorations')
    for (const name of this.sessions.names) {
      const session = this.sessions.getByFileName(name);
      this.stopClient(session.editor.document);
      this.decorations.dispose(session);
    }
    this._logger.debug('Clearing Sessions')
    this.sessions.clearAll();
  };

  public traceAndSetDecorations = (
    textDocument?: vscode.TextDocument,
  ): void => {
    const document = textDocument ?? this.activeEditor.document;

    const session = this.sessions.get(document);
    if (!session)
      return;

    const clientPath = fileIdentifier(document);
    this.stopClient(document);
    const generation = (this._traceGenerations.get(clientPath) ?? 0) + 1;
    this._traceGenerations.set(clientPath, generation);
    if (session.isLiveEditing) {
      session.decorations = {};
      this.decorations.render(session);
    }

    const wolfClient = wolfClientFactory(
      clientPath,
      undefined,
      undefined,
      this._server.authToken,
    );
    this._clients.set(clientPath, wolfClient);

    wolfClient
      .connect()
      .then(() => {
        // TODO: Move handlers into a proper Disposable class
        this._logger.debug('Tracing')

        if (!this.isCurrentTrace(document, session, wolfClient, generation)) {
          wolfClient.close();
          return;
        }

        this._output.clear();

        wolfClient.traceRawSrc(document.getText())

        if (session.isLiveEditing)
          wolfClient.on('data', (result: T.WolfClientDataResponse) => {
            if (this.isCurrentTrace(document, session, wolfClient, generation)) {
              this._logger.debug('Received new data')

              const line = parseAndValidateResponse(result);
              this.decorations.setDataAtLine(session.decorations, line)
              this.decorations.renderTo(session.editor, session);

              const filepath = session.editor.document.uri.path;
              this.emit('decorations-updated', filepath, this.decorations);
            }
          })

        wolfClient.on('eof', (result: T.WolfClientEofResponse) => {
          this._logger.debug('Reached EOF');
          this.removeClient(clientPath, wolfClient);

          if (this.isCurrentSession(document, session, generation)) {
            const pythonData = parseAndValidateEofResponse(result);

            if (not(session.isLiveEditing)) {
              this.decorations.set(session, pythonData);
              this.decorations.renderTo(session.editor, session);

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
          this.removeClient(clientPath, wolfClient);
          this._logger.debug('Error')
          this._logger.error(err)

          if (this.shouldOutputErrors)
            this.logToOutput("(Wolf Error):", err.message ?? '<no message>');

          this.emit('decorations-error', document.fileName);
        })

        wolfClient.on('close', () => {
          this._logger.debug('Closing')
          this.removeClient(clientPath, wolfClient);
          this.emit('connection-closed', document.fileName);
        })
      })
      .catch(() => {
        this._logger.debug('Connection Error')
        this.removeClient(clientPath, wolfClient);
        this.emit('connection-error', document.fileName);
      })
  };

  public reRenderDecorations = (): void => {
    this._logger.debug('re-rendering')
    const editor = this.activeEditor;
    const session = this.sessions.get(editor.document);
    if (session)
      this.decorations.renderTo(editor, session);
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
    return this.config.get<boolean>("updateOnSaveOnly") !== false;
  }

  public get shouldOutputErrors(): boolean {
    return this.config.get<boolean>("logErrors") === true;
  }

  public get rootExtensionDir(): string {
    return this.context.extensionPath;
  }

  public get pythonPath(): string {
    const fromConfig = this.config.get<string>("pythonPath");
    if (fromConfig) {
      return fromConfig;
    }
    try {
      const pythonExt = vscode.extensions.getExtension("ms-python.python");
      if (pythonExt?.isActive && pythonExt.exports) {
        const envPath = pythonExt.exports.environments?.getActiveEnvironmentPath?.()?.path
          ?? pythonExt.exports.environment?.getActiveEnvironmentPath?.()?.path;
        if (envPath) {
          return envPath;
        }
      }
    } catch {
      // Ignore extension lookup errors and fallback
    }
    return this.__platform === "win32" ? "python" : "python3";
  }

  public getPythonVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.pythonPath, ["--version"]);
      let output = "";
      child.stdout.on("data", (data: Buffer) => {
        output += data.toString();
      });
      child.stderr.on("data", (data: Buffer) => {
        output += data.toString();
      });
      child.on("error", (err: Error) => {
        reject(err);
      });
      child.on("close", (code: number) => {
        const match = output.match(/Python\s+([0-9.]+)/i);
        if (match) {
          resolve(match[1]);
        } else if (output.trim()) {
          resolve(output.trim().split(" ")[1] || output.trim());
        } else {
          reject(new Error(`Failed to determine Python version (exit code ${code})`));
        }
      });
    });
  }

  public dispose(): void {
    this.stopServer();
    this.clearAll();
    for (const client of this._clients.values()) {
      client.close();
    }
    this._clients.clear();
    this._eventEmitter.removeAllListeners();
  }

  private prettyPrintWolfTraceData = (
    data: T.WolfTraceLineResult[] = [],
  ): string[] => {
    return data.map(
      l => {
        const msgText = `LINENO: ${l.lineno} - VALUE: ${l.value}`;
        return l.error ? `${msgText}, ERROR: ${l.error}` : msgText;
      });
  }


  private isCurrentSession(
    document: vscode.TextDocument,
    session: T.WolfSession,
    generation: number,
  ): boolean {
    return this.sessions.get(document) === session &&
      this._traceGenerations.get(fileIdentifier(document)) === generation;
  }

  private isCurrentTrace(
    document: vscode.TextDocument,
    session: T.WolfSession,
    client: WolfClient,
    generation: number,
  ): boolean {
    return this.isCurrentSession(document, session, generation) &&
      this._clients.get(fileIdentifier(document)) === client;
  }

  private stopClient(document: vscode.TextDocument): void {
    const identifier = fileIdentifier(document);
    const client = this._clients.get(identifier);
    if (client)
      this.removeClient(identifier, client);
  }

  private removeClient(identifier: string, client: WolfClient): void {
    if (this._clients.get(identifier) !== client)
      return;
    this._clients.delete(identifier);
    client.close();
  }

  public stopServer = (): void => {
    this._server.stop()
  };

  public startServer = (): void => {
    this._server.start(this.pythonPath, this.rootExtensionDir);
  };

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
