import * as fs from "fs";
import {
  WolfDecorationsController,
  wolfDecorationStoreFactory
} from "./decorations";
import {
  WolfDecorations,
  WolfParsedTraceResults,
  TracerParsedResultTuple,
  WolfEvent,
} from "./types";
import {
  commands,
  extensions,
  ExtensionContext,
  OutputChannel,
  TextDocumentChangeEvent,
  TextDocument,
  TextEditor,
  workspace,
  WorkspaceConfiguration,
} from "vscode";
import { WolfSessionController, wolfSessionStoreFactory } from "./sessions";
import { PythonTracer, pythonTracerFactory } from "./tracer";
import { getActiveEditor, makeTempFile } from "./helpers";
import { hotModeWarning } from "./hotWarning";
import { wolfOutputFactory, WolfOutputController } from "./output";
import { EventEmitter } from "events";
import { platform } from "os";
import { WolfError } from "./errors";

export function wolfStandardApiFactory(
  context: ExtensionContext,
  options: { output: OutputChannel }
): WolfAPI {
  const wolfOutputChannel = wolfOutputFactory(options.output);

  return new WolfAPI(
    context,
    wolfOutputChannel,
    wolfDecorationStoreFactory(context),
    wolfSessionStoreFactory(),
    pythonTracerFactory(wolfOutputChannel),
  );
}

export class WolfAPI {
  private _changedConfigFlag = false;
  private _endOfFile = 0;
  private _eventEmitter = new EventEmitter()

  constructor(
    public context: ExtensionContext,
    private _outputController: WolfOutputController,
    private _decorationController: WolfDecorationsController,
    private _sessionController: WolfSessionController,
    private _pythonTracer: PythonTracer
  ) { }

  public stepInWolf = (): void => {
    this.decorations.setDefaultDecorationOptions("green", "red");
    this.sessions.createSessionFromEditor(this.activeEditor);
    this.updateLineCount(this.activeEditor.document.lineCount);
    this.traceAndSetDecorations(this.activeEditor.document.fileName);
    this.enterWolfContext();
  };

  public stopWolf = (): void => {
    this.clearAllSessionsAndDecorations();
    this.exitWolfContext();
  };

  public traceAndSetDecorationsUsingTempFile = (document: TextDocument): void => {
    const tempFileObj = makeTempFile(document.fileName);
    fs.writeFileSync(tempFileObj.name, document.getText());
    this.traceAndSetDecorations(tempFileObj.name)
      .finally(tempFileObj.removeCallback);
  };

  public enterWolfContext = (): void => {
    commands.executeCommand("setContext", "inWolfContext", true);
  };

  public exitWolfContext = (): void => {
    commands.executeCommand("setContext", "inWolfContext", false);
  };

  public clearDecorations = (session: TextEditor): void => {
    const emptyDecorations = this.decorations.getEmptyDecorations();
    this.setDecorations(session, emptyDecorations);
  };

  public clearAllDecorations = (): void => {
    this.decorations.reInitDecorationCollection();
    for (const name of this.sessions.sessionNames) {
      const session = this.sessions.getSessionByFileName(name);
      this.clearDecorations(session);
    }
  };

  public clearAllSessionsAndDecorations = (): void => {
    this.clearAllDecorations();
    this.sessions.clearAllSessions();
  };

  public isDocumentWolfSession = (document: TextDocument): boolean => {
    return this.sessions.sessionIsActiveByDocument(document);
  };

  private prettyPrintWolfData(data: WolfParsedTraceResults): string[] {
    return data?.map(
      l =>
        `LINENO: ${l.lineno} - VALUE: ${l.value}${
        l.error ? `, ERROR: ${l.error}` : ""
        }`
    ) ?? [];
  }

  private onPythonDataError = (data?: string): void => {
    if (this.shouldLogErrors) {
      this.logToOutput("(Wolf Error):", data ?? '<no message>');
    }
  };

  private onPythonDataSuccess = (data: TracerParsedResultTuple): void => {
    this.parsePythonDataAndSetDecorations(this.activeEditor, data[0]);
    if (this.printLogging) {
      const output = this.prettyPrintWolfData(data[0]);
      this._outputController.clear();
      this.logToOutput(data[1] ? data[1] + '\n\n' : '');
      this.logToOutput(`(Wolf Output): ${JSON.stringify(output, null, 4)}`);
      this.logToOutput(`\n\nTotal Line Count: ${data?.length}`);
    }
    const filepath = this.activeEditor.document.uri.path;
    this.emit('decorations-changed', filepath, this.decorations);
  };

  private parsePythonDataAndSetDecorations = (
    session: TextEditor,
    data: WolfParsedTraceResults = []
  ) => {
    this.decorations.reInitDecorationCollection();
    this.decorations.prepareParsedPythonData(data);
    this.clearDecorations(session);
    this.setPreparedDecorations(session);
  };

  private setPreparedDecorations = (session: TextEditor): void => {
    this.decorations.setPreparedDecorationsForEditor(session);
    const decorations = this.decorations.getPreparedDecorations();
    this.setDecorations(session, decorations);
  };

  private setDecorations = (
    session: TextEditor,
    decorations: WolfDecorations
  ): void => {
    const decorationTypes = this.decorations.getDecorationTypes();
    if (decorationTypes) {
      session.setDecorations(decorationTypes.success, decorations.success);
      session.setDecorations(decorationTypes.error, decorations.error);
    }
  };

  private traceAndSetDecorations = (fileName: string): Promise<void> => {
    return this.tracer.tracePythonScript({
      fileName,
      pythonPath: this.pythonPath,
      rootDir: this.rootExtensionDir,
    })
      .then(this.onPythonDataSuccess)
      .catch(this.onPythonDataError)
  };

  private updateLineCount = (count: number): void => {
    this.oldLineCount = count;
  };

  public updateStickysHot = (event: TextDocumentChangeEvent): void => {
    if (this.isHot) {
      this.setPreparedDecorations(this.activeEditor);
      this.updateLineCount(event.document.lineCount);
    }
    this.activeEditor.document.save();
  };

  public setConfigUpdatedFlag(v: boolean): void {
    this._changedConfigFlag = v;
  }

  public displayHotModeWarning(): void {
    hotModeWarning();
  }

  public logToOutput = (...text: string[]): void => {
    this._outputController.log(text.join(" "));
  };

  public emit = (event: WolfEvent, filepath: string, ...args: unknown[]): void => {
    this._eventEmitter.emit(event, filepath, ...args)
  }

  public on = (event: WolfEvent, listener: (...args: unknown[]) => void): void => {
    this._eventEmitter.addListener(event, listener)
  }

  public get activeEditor(): TextEditor {
    return getActiveEditor();
  }

  public get activeEditorIsDirty(): boolean {
    return this.activeEditor.document.isDirty;
  }

  public get config(): WorkspaceConfiguration {
    return workspace.getConfiguration("wolf");
  }

  public get configChanged(): boolean {
    return this._changedConfigFlag;
  }

  public get decorations(): WolfDecorationsController {
    return this._decorationController;
  }

  public get isHot(): boolean | undefined {
    return this.config.get<boolean>("hot");
  }

  public get updateFrequency(): number | undefined {
    return this.config.get<number>("updateFrequency");
  }

  public get oldLineCount(): number {
    return this._endOfFile;
  }

  public set oldLineCount(v: number) {
    this._endOfFile = v;
  }

  public get printLogging(): boolean | undefined {
    return this.config.get<boolean>("printLoggingEnabled");
  }

  public get rootExtensionDir(): string {
    const res = extensions.getExtension("traBpUkciP.wolf")?.extensionPath;
    if (res === undefined)
      throw new WolfError('no WolfAPI.rootExtensionDir)')
    return res
  }

  public get sessions(): WolfSessionController {
    return this._sessionController;
  }

  public get shouldLogErrors(): boolean {
    return this.config.get<boolean>("logErrors") === true;
  }

  public get shouldShowHotModeWarning(): boolean {
    return this.config.get<boolean>("disableHotModeWarning") !== true;
  }

  public get tracer(): PythonTracer {
    return this._pythonTracer;
  }

  private __platform = platform().trim()

  public get pythonPath(): string {
    const fromconfig = this.config.get<string>("pythonPath")
    /* Github-Actions Windows CI tests don't like 'python3' */
    return fromconfig || this.__platform === "win32" ? 'python' : 'python3'
  }

  public getPythonMajorVersion = async (): Promise<string> => {
    return await this.tracer.getPythonMajorVersion(this.pythonPath)
  }
}
