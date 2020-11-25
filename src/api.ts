import * as fs from "fs";
import {
  WolfDecorationsController,
  wolfDecorationStoreFactory
} from "./decorations";
import {
  WolfSessionDecorations,
  WolfTracerInterface,
  WolfParsedTraceResults,
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
import { WolfStickyController, wolfStickyControllerFactory } from "./sticky";
import { PythonTracer, pythonTracerFactory } from "./tracer";
import { getActiveEditor, makeTempFile } from "./helpers";
import { hotModeWarning } from "./hotWarning";
import { wolfOutputFactory, WolfOutputController } from "./output";
import { EventEmitter } from "events";

export function wolfStandardApiFactory(
  context: ExtensionContext,
  options: { output: OutputChannel }
): WolfAPI {
  const wolfDecorationStore = wolfDecorationStoreFactory(context);
  const wolfOutputChannel = wolfOutputFactory(options.output);

  return new WolfAPI(
    context,
    wolfOutputChannel,
    wolfDecorationStore,
    wolfSessionStoreFactory(),
    wolfStickyControllerFactory(wolfDecorationStore),
    pythonTracerFactory()
  );
}

type WolfEvent = 'decorations-changed';

export class WolfAPI {
  public _changedConfigFlag = false;
  private _endOfFile = 0;
  constructor(
    public context: ExtensionContext,
    private _outputController: WolfOutputController,
    private _decorationController: WolfDecorationsController,
    private _sessionController: WolfSessionController,
    private _stickyController: WolfStickyController,
    private _pythonTracer: PythonTracer
  ) { }

  private events = new EventEmitter()

  public emit = (event: WolfEvent, filepath: string, ...args: unknown[]): void => {
    this.events.emit(event, filepath, ...args)
  }

  public on = (event: WolfEvent, listener: (...args: unknown[]) => void): void => {
    this.events.addListener(event, listener)
  }

  public stepInWolf = (): void => {
    this.decorations.setDefaultDecorationOptions("green", "red");
    this.sessions.createSessionFromEditor(this.activeEditor);
    this.updateLineCount(this.activeEditor.document.lineCount);
    this.traceOrRenderPreparedDecorations(true);
    this.enterWolfContext();
  };

  public stopWolf = (): void => {
    this.decorations.reInitDecorationCollection();
    this.clearAllSessionsAndDecorations();
    this.exitWolfContext();
  };

  public enterWolfContext = (): void => {
    commands.executeCommand("setContext", "inWolfContext", true);
  };

  public exitWolfContext = (): void => {
    commands.executeCommand("setContext", "inWolfContext", false);
  };

  public clearDecorationsForSession = (session: TextEditor): void => {
    const emptyDecorations = this.decorations.getEmptyDecorations();
    this.setDecorationsForSession(session, emptyDecorations);
  };

  public clearDecorationsForActiveSession = (): void => {
    this.clearDecorationsForSession(this.activeEditor);
  };

  public clearAllDecorations = (): void => {
    this.decorations.reInitDecorationCollection();
    for (const name of this.sessions.sessionNames) {
      const session = this.sessions.getSessionByFileName(name);
      this.clearDecorationsForSession(session);
    }
  };

  public clearAllSessionsAndDecorations = (): void => {
    this.clearAllDecorations();
    this.sessions.clearAllSessions();
  };

  public handleDidChangeTextDocument = (document: TextDocument): void => {
    const tempFileObj = makeTempFile(document.fileName);
    const newSource = document.getText();
    this.clearDecorationsForActiveSession();
    this.decorations.reInitDecorationCollection();
    fs.writeFileSync(tempFileObj.name, newSource);
    this.tracer.tracePythonScriptForDocument({
      pythonPath: this.pythonPath,
      fileName: tempFileObj.name,
      rootDir: this.rootExtensionDir,
      afterInstall: this.traceOrRenderPreparedDecorations, // Recurse if Hunter had to be installed first,
      onData: data => {
        tempFileObj.removeCallback();
        this.onPythonDataSuccess(data ?? []);
      },
      onError: data => {
        console.error(data)
        tempFileObj.removeCallback();
        this.onPythonDataError(data);
      }
    } as WolfTracerInterface);
  };

  public isDocumentWolfSession = (document: TextDocument): boolean => {
    return this.sessions.sessionIsActiveByDocument(document);
  };

  public logToOutput = (...text: string[]): void => {
    this._outputController.log(text.join(" "));
  };

  private prettyPrintWolfData(data: WolfParsedTraceResults): string[] {
    return data?.map(
      l =>
        `LINENO: ${l.lineno} - VALUE: ${l.value}${
        l.error ? `, ERROR: ${l.error}` : ""
        }`
    ) ?? [];
  }

  private onPythonDataSuccess = (data?: WolfParsedTraceResults): void => {
    console.log('Python data received:', data)
    this.prepareAndRenderDecorationsForActiveSession(data ?? []);
    if (this.printLogging) {
      const prettyWolf = this.prettyPrintWolfData(data ?? []);
      this._outputController.clear();
      this.logToOutput("(Wolf Output):", JSON.stringify(prettyWolf, null, 4));
      this.logToOutput(`\n\nTotal Line Count: ${data?.length}`);
    }
    this.emit('decorations-changed', this.activeEditor.document.uri.path, this.decorations)
  };

  private onPythonDataError = (data?: string): void => {
    if (this.shouldLogErrors) {
      this.logToOutput("(Wolf Error):", data ?? '<no message>');
    }
  };

  private prepareAndRenderDecorationsForActiveSession = (
    data: WolfParsedTraceResults
  ): void => {
    this.prepareAndRenderDecorationsForSession(this.activeEditor, data);
  };

  private setPreparedDecorationsForSession = (session: TextEditor): void => {
    const decorations = this.decorations.getPreparedDecorations();
    this.setDecorationsForSession(session, decorations);
  };

  private prepareAndRenderDecorationsForSession = (
    session: TextEditor,
    data: WolfParsedTraceResults
  ) => {
    console.log('Preparing parsed data')
    this.decorations.prepareParsedPythonData(data);
    console.log('Clearing decorations')
    this.clearDecorationsForSession(session);
    console.log('Setting editordecorations')
    this.decorations.setPreparedDecorationsForEditor(session);
    console.log('Setting session decorations')
    this.setPreparedDecorationsForSession(session);
  };

  public setConfigUpdatedFlag(v: boolean): void {
    this._changedConfigFlag = v;
  }

  private setDecorationsForSession = (
    session: TextEditor,
    decorations: WolfSessionDecorations
  ): void => {
    const decorationTypes = this.decorations.getDecorationTypes();
    if (decorationTypes) {
      session.setDecorations(decorationTypes.success, decorations.success);
      session.setDecorations(decorationTypes.error, decorations.error);
    }
  };

  public displayHotModeWarning(): void {
    hotModeWarning();
  }

  private renderPreparedDecorationsForSession = (session: TextEditor): void => {
    this.decorations.setPreparedDecorationsForEditor(session);
    this.setPreparedDecorationsForSession(session);
  };

  private renderPreparedDecorationsForActiveSession = (): void => {
    this.renderPreparedDecorationsForSession(this.activeEditor);
  };

  private traceAndRenderDecorationsForActiveSession = (): void => {
    this.decorations.reInitDecorationCollection();
    this.tracer.tracePythonScriptForActiveEditor({
      pythonPath: this.pythonPath,
      rootDir: this.rootExtensionDir,
      afterInstall: this.traceOrRenderPreparedDecorations, // Recurse if Hunter had to be installed first,
      onData: this.onPythonDataSuccess,
      onError: this.onPythonDataError,
    } as WolfTracerInterface);
  };

  private traceOrRenderPreparedDecorations = (trace: boolean): void => {
    if (trace) {
      this.traceAndRenderDecorationsForActiveSession();
    } else {
      this.renderPreparedDecorationsForActiveSession();
    }
  };

  public updateLineCount = (count: number): void => {
    this.oldLineCount = count;
  };

  public updateStickys = (event: TextDocumentChangeEvent): void => {
    if (this.isHot) {
      this.stickys.updateStickyDecorations(event, this.oldLineCount);
      this.renderPreparedDecorationsForActiveSession();
      this.updateLineCount(event.document.lineCount);
    }
  };

  public updateStickysHot = (event: TextDocumentChangeEvent): void => {
    this.updateStickys(event);
    this.activeEditor.document.save();
  };

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

  public get rootExtensionDir(): string | undefined {
    return extensions.getExtension("traBpUkciP.wolf")?.extensionPath;
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

  public get stickys(): WolfStickyController {
    return this._stickyController;
  }

  public get tracer(): PythonTracer {
    return this._pythonTracer;
  }

  public get pythonPath(): string | undefined {
    return this.config.get<string>("pythonPath")
  }
}
