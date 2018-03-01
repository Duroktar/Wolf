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
  constructor(
    public context: ExtensionContext,
    public config: WorkspaceConfiguration,
    private _decorationController: WolfDecorationsController,
    private _sessionController: WolfSessionController,
    private _stickyController: WolfStickyController,
    private _pythonTracer: PythonTracer
  ) {}

  public startWolf = (): void => {
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
    this.setSessionDecorations(session, emptyDecorations);
  };

  public clearDecorationsForSessionByName = (name: string): void => {
    const session = this.sessions.getSessionByName(name);
    if (session) {
      this.clearDecorationsForSession(session);
    }
  };

  public clearAllDecorations = (): void => {
    this.decorations.reInitDecorationCollection();
    for (let name of this.sessions.sessionNames) {
      const session = this.sessions.getSessionByName(name);
      this.clearDecorationsForSession(session);
    }
  };

  public clearAllSessionsAndDecorations = (): void => {
    this.clearAllDecorations();
    this.sessions.clearAllSessions();
  };

  public isDocumentWolfSession = (document: TextDocument): boolean => {
    return this.sessions.sessionIsActiveByDocument(document);
  };

  public setDecorationsForActiveSession = (): void => {
    const decorations = this.decorations.getPreparedDecorations();
    this.setSessionDecorations(this.activeEditor, decorations);
  };

  private onPythonError = (data): void => {
    console.log("WOLF STDERR OUPTUT:", data);
  };

  private prepareAndRenderParsedPythonData = (
    data: WolfParsedTraceResults
  ): void => {
    data.forEach(this.decorations.parseLineAndSetDecoration);
    this.renderPreparedDecorationsForActiveSession();
  };

  public renderPreparedDecorationsForActiveSession = (): void => {
    this.clearDecorationsForActiveSession();
    this.decorations.prepareDecorations();
    this.setDecorationsForActiveSession();
  };

  private setSessionDecorations = (
    session: TextEditor,
    decorations: WolfSessionDecorations
  ): void => {
    const decorationTypes = this.decorations.getDecorationTypes();
    session.setDecorations(decorationTypes.success, decorations.success);
    session.setDecorations(decorationTypes.error, decorations.error);
  };

  public traceOrRenderPreparedDecorations = (trace: boolean): void => {
    if (trace) {
      this.decorations.reInitDecorationCollection();
      this.tracer.tracePythonScript({
        rootDir: this.rootExtensionDir,
        afterInstall: this.traceOrRenderPreparedDecorations, // Recurse if Hunter had to be installed first,
        onData: this.prepareAndRenderParsedPythonData,
        onError: this.onPythonError
      } as WolfTracerInterface);
    } else {
      this.renderPreparedDecorationsForActiveSession();
    }
  };

  public updateLineCount = (count: number): void => {
    this.oldLineCount = count;
  };

  public updateStickys = (event: TextDocumentChangeEvent): void => {
    this.stickys.updateStickyDecorations(event, this.oldLineCount);
    this.renderPreparedDecorationsForActiveSession();
    this.updateLineCount(event.document.lineCount);
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

  public get oldLineCount() {
    return this._endOfFile;
  }

  public set oldLineCount(v: number) {
    this._endOfFile = v;
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
