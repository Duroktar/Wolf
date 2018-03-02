import {
  WolfDecorationsController,
  wolfDecorationStoreFactory
} from "./decorations";
import {
  WolfSessionDecorations,
  WolfTracerInterface,
  WolfParsedTraceResults
} from "./types";
import {
  commands,
  extensions,
  ExtensionContext,
  WorkspaceConfiguration,
  TextDocumentChangeEvent,
  TextDocument,
  TextEditor
} from "vscode";
import { WolfSessionController, wolfSessionStoreFactory } from "./sessions";
import { WolfStickyController, wolfStickyControllerFactory } from "./sticky";
import { PythonTracer, pythonTracerFactory } from "./tracer";
import { getActiveEditor } from "./utils";

export function wolfStandardApiFactory(
  context: ExtensionContext,
  config: WorkspaceConfiguration
) {
  const wolfDecorationStore = wolfDecorationStoreFactory(context, config);

  return new WolfAPI(
    context,
    config,
    wolfDecorationStore,
    wolfSessionStoreFactory(config),
    wolfStickyControllerFactory(config, wolfDecorationStore),
    pythonTracerFactory(config)
  );
}

export class WolfAPI {
  private _endOfFile: number = 0;
  private _lastMinFile: string = "";
  constructor(
    public context: ExtensionContext,
    public config: WorkspaceConfiguration,
    private _decorationController: WolfDecorationsController,
    private _sessionController: WolfSessionController,
    private _stickyController: WolfStickyController,
    private _pythonTracer: PythonTracer
  ) {}

  public stepInWolf = (): void => {
    this.decorations.setDefaultDecorationOptions("green", "red");
    this.sessions.createSessionFromEditor(this.activeEditor);
    this.updateLineCount(this.activeEditor.document.lineCount);
  };

  public stopWolf = (): void => {
    this.clearAllSessionsAndDecorations();
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

  public handleDidChangeTextDocument = (
    event: TextDocumentChangeEvent
  ): void => {
    this.updateStickys(event);
  };

  public handleDidSaveTextDocument = (trace: boolean): void => {
    this.traceOrRenderPreparedDecorations(trace);
  };

  public isDocumentWolfSession = (document: TextDocument): boolean => {
    return this.sessions.sessionIsActiveByDocument(document);
  };

  private onPythonDataSuccess = (data): void => {
    this.prepareAndRenderDecorationsForActiveSession(data);
    if (this.printLogging) {
      console.log(
        "WOLF:",
        JSON.stringify(
          data.reduce((acc, i) => {
            return {
              ...acc,
              [i.line_number]: [...(acc[i.line_number] || []), i.value]
            };
          }, {}),
          null,
          2
        )
      );
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
    data.forEach(this.decorations.parseLineAndSetDecoration);
  };

  public renderPreparedDecorationsForActiveSession = (): void => {
    this.renderPreparedDecorationsForSession(this.activeEditor);
  };

  public renderPreparedDecorationsForSession = (session: TextEditor): void => {
    this.clearDecorationsForSession(session);
    this.decorations.setPreparedDecorationsForEditor(session);
    this.setPreparedDecorationsForSession(session);
  };

  private setDecorationsForSession = (
    session: TextEditor,
    decorations: WolfSessionDecorations
  ): void => {
    const decorationTypes = this.decorations.getDecorationTypes();
    session.setDecorations(decorationTypes.success, decorations.success);
    session.setDecorations(decorationTypes.error, decorations.error);
  };

  public setPreparedDecorationsForActiveSession = (): void => {
    this.setPreparedDecorationsForSession(this.activeEditor);
  };

  public setPreparedDecorationsForSession = (session: TextEditor): void => {
    const decorations = this.decorations.getPreparedDecorations();
    this.setDecorationsForSession(session, decorations);
  };

  public traceOrRenderPreparedDecorations = (trace: boolean): void => {
    if (trace) {
      this.decorations.reInitDecorationCollection();
      this.tracer.tracePythonScript({
        rootDir: this.rootExtensionDir,
        afterInstall: this.traceOrRenderPreparedDecorations, // Recurse if Hunter had to be installed first,
        onData: this.onPythonDataSuccess,
        onError: this.onPythonDataError
      } as WolfTracerInterface);
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

  public get decorations() {
    return this._decorationController;
  }

  public get isHot() {
    return this.config.get("hot");
  }

  public get hotFrequency() {
    return parseInt(this.config.get("hotFrequency"));
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

  public get stickys() {
    return this._stickyController;
  }

  public get tracer() {
    return this._pythonTracer;
  }
}
