import * as fs from "fs";
import {
  WolfDecorationsController,
  wolfDecorationStoreFactory
} from "./decorations";
import {
  WolfSessionDecorations,
  WolfTracerInterface,
  WolfParsedTraceResults,
  WolfTraceLineResult
} from "./types";
import {
  commands,
  extensions,
  ExtensionContext,
  TextDocumentChangeEvent,
  TextDocument,
  TextEditor,
  workspace
} from "vscode";
import { WolfSessionController, wolfSessionStoreFactory } from "./sessions";
import { WolfStickyController, wolfStickyControllerFactory } from "./sticky";
import { PythonTracer, pythonTracerFactory } from "./tracer";
import { getActiveEditor, makeTempFile } from "./utils";
import { hotModeWarning } from "./hotWarning";

export function wolfStandardApiFactory(context: ExtensionContext) {
  const wolfDecorationStore = wolfDecorationStoreFactory(context);

  return new WolfAPI(
    context,
    wolfDecorationStore,
    wolfSessionStoreFactory(),
    wolfStickyControllerFactory(wolfDecorationStore),
    pythonTracerFactory()
  );
}

export class WolfAPI {
  private _endOfFile: number = 0;
  public _changedConfigFlag: boolean = false;
  constructor(
    public context: ExtensionContext,
    private _decorationController: WolfDecorationsController,
    private _sessionController: WolfSessionController,
    private _stickyController: WolfStickyController,
    private _pythonTracer: PythonTracer
  ) {}

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

  public clearDecorationsForActiveSession = (): void => {
    this.clearDecorationsForSession(getActiveEditor());
  };

  public clearDecorationsForSession = (session: TextEditor): void => {
    const emptyDecorations = this.decorations.getEmptyDecorations();
    this.setDecorationsForSession(session, emptyDecorations);
  };

  public clearAllDecorations = (): void => {
    this.decorations.reInitDecorationCollection();
    for (let name of this.sessions.sessionNames) {
      const session = this.sessions.getSessionByFileName(name);
      this.clearDecorationsForSession(session);
    }
  };

  public clearAllSessionsAndDecorations = (): void => {
    this.clearAllDecorations();
    this.sessions.clearAllSessions();
  };

  public dataContainsErrorLines = (data: WolfParsedTraceResults): number => {
    for (let line of data) {
      if (line.error) {
        return line.lineno;
      }
    }
    return -1;
  };

  public filterParsedPythonData = (
    visitor: (
      value: WolfTraceLineResult,
      index?: number,
      collection?: WolfParsedTraceResults
    ) => boolean,
    data: WolfParsedTraceResults
  ): WolfParsedTraceResults => {
    return data.filter(visitor);
  };

  public handleDidChangeTextDocument = (
    event: TextDocumentChangeEvent
  ): void => {
    const tempFileObj = makeTempFile(event.document.fileName);
    const newSource = event.document.getText();
    this.clearDecorationsForActiveSession();
    this.decorations.reInitDecorationCollection();
    fs.writeFileSync(tempFileObj.name, newSource);
    this.tracer.tracePythonScriptForDocument({
      fileName: tempFileObj.name,
      rootDir: this.rootExtensionDir,
      afterInstall: this.traceOrRenderPreparedDecorations, // Recurse if Hunter had to be installed first,
      onData: data => {
        tempFileObj.removeCallback();
        this.onPythonDataSuccess(data);
      },
      onError: data => {
        tempFileObj.removeCallback();
        this.onPythonDataError(data);
      }
    } as WolfTracerInterface);
  };

  public isDocumentWolfSession = (document: TextDocument): boolean => {
    return this.sessions.sessionIsActiveByDocument(document);
  };

  private onPythonDataSuccess = (data: WolfParsedTraceResults): void => {
    this.prepareAndRenderDecorationsForActiveSession(data);
    if (this.printLogging) {
      console.log("WOLF:", JSON.stringify(data, null, 4));
      console.log("Wolf Total Line Count:", data.length);
    }
  };

  private onPythonDataError = (data): void => {
    console.error("WOLF STDERR OUPTUT:", data);
  };

  private prepareAndRenderDecorationsForActiveSession = (
    data: WolfParsedTraceResults
  ): void => {
    this.prepareAndRenderDecorationsForSession(this.activeEditor, data);
  };

  private prepareAndRenderDecorationsForSession = (
    session: TextEditor,
    data: WolfParsedTraceResults
  ) => {
    this.prepareParsedPythonData(data);
    this.clearDecorationsForSession(session);
    this.decorations.setPreparedDecorationsForEditor(session);
    this.setPreparedDecorationsForSession(session);
  };

  private prepareParsedPythonData = (data: WolfParsedTraceResults): void => {
    this.decorations.prepareParsedPythonData(data);
  };

  private renderPreparedDecorationsForActiveSession = (): void => {
    this.renderPreparedDecorationsForSession(this.activeEditor);
  };

  private renderPreparedDecorationsForSession = (session: TextEditor): void => {
    this.decorations.setPreparedDecorationsForEditor(session);
    this.setPreparedDecorationsForSession(session);
  };

  public setConfigUpdatedFlag(v: boolean) {
    this._changedConfigFlag = v;
  }

  private setDecorationsForSession = (
    session: TextEditor,
    decorations: WolfSessionDecorations
  ): void => {
    const decorationTypes = this.decorations.getDecorationTypes();
    session.setDecorations(decorationTypes.success, decorations.success);
    session.setDecorations(decorationTypes.error, decorations.error);
  };

  private setPreparedDecorationsForSession = (session: TextEditor): void => {
    const decorations = this.decorations.getPreparedDecorations();
    this.setDecorationsForSession(session, decorations);
  };

  public displayHotModeWarning(): void {
    hotModeWarning();
  }

  private traceAndRenderDecorationsForActiveSession = (): void => {
    this.decorations.reInitDecorationCollection();
    this.tracer.tracePythonScriptForActiveEditor({
      rootDir: this.rootExtensionDir,
      afterInstall: this.traceOrRenderPreparedDecorations, // Recurse if Hunter had to be installed first,
      onData: this.onPythonDataSuccess,
      onError: this.onPythonDataError
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

  public get activeEditor() {
    return getActiveEditor();
  }

  public get activeEditorIsDirty() {
    return getActiveEditor().document.isDirty;
  }

  public get config() {
    return workspace.getConfiguration("wolf");
  }

  public get configChanged() {
    return this._changedConfigFlag;
  }

  public get decorations() {
    return this._decorationController;
  }

  public get isHot() {
    return this.config.get("hot");
  }

  public get updateFrequency() {
    return parseInt(this.config.get("updateFrequency"));
  }

  public get oldLineCount() {
    return this._endOfFile;
  }

  public set oldLineCount(v: number) {
    this._endOfFile = v;
  }

  public get printLogging() {
    return this.config.get("printLoggingEnabled");
  }

  public get rootExtensionDir() {
    return extensions.getExtension("traBpUkciP.wolf").extensionPath;
  }

  public get sessions() {
    return this._sessionController;
  }

  public get shouldShowHotModeWarning() {
    return this.config.get("disableHotModeWarning") !== true;
  }

  public get stickys() {
    return this._stickyController;
  }

  public get tracer() {
    return this._pythonTracer;
  }
}
