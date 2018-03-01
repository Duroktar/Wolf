import * as vscode from "vscode";
import {
  Disposable,
  ExtensionContext,
  TextDocument,
  TextDocumentChangeEvent,
  WorkspaceConfiguration,
  workspace
} from "vscode";

import { wolfStandardApiFactory, WolfAPI } from "./api";
import { ActiveTextEditorChangeEventResult } from "./types";

export function activate(context: ExtensionContext) {
  const wolfConfig: WorkspaceConfiguration = workspace.getConfiguration("wolf");
  const wolfAPI: WolfAPI = wolfStandardApiFactory(context, wolfConfig);

  function startWolf() {
    wolfAPI.startWolf();
    wolfAPI.enterWolfContext();
    throttledRefreshDecorations();
  }

  function stopWolf() {
    wolfAPI.stopWolf();
    wolfAPI.exitWolfContext();
    cancelPending();
  }

  const wolfStartCommand: Disposable = vscode.commands.registerCommand(
    "wolf.barkAtCurrentFile",
    startWolf
  );

  const wolfStopCommand: Disposable = vscode.commands.registerCommand(
    "wolf.stopBarking",
    stopWolf
  );

  const wolfStartAction: Disposable = vscode.commands.registerCommand(
    "wolf.touchBarStart",
    startWolf
  );

  const wolfStopAction: Disposable = vscode.commands.registerCommand(
    "wolf.touchBarStop",
    stopWolf
  );

  context.subscriptions.push(
    wolfStartAction,
    wolfStartCommand,
    wolfStopAction,
    wolfStopCommand
  );

  vscode.window.onDidChangeActiveTextEditor(
    handleDidChangeActiveTextEditor,
    null,
    context.subscriptions
  );

  vscode.workspace.onDidSaveTextDocument(
    handleDidSaveTextDocument,
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeTextDocument(
    handleDidChangeTextDocument,
    null,
    context.subscriptions
  );

  function handleDidSaveTextDocument(document: TextDocument) {
    if (wolfAPI.isDocumentWolfSession(document)) {
      wolfAPI.updateLineCount(document.lineCount);
      throttledRefreshDecorations();
    }
  }

  function handleDidChangeTextDocument(event: TextDocumentChangeEvent) {
    if (wolfAPI.isDocumentWolfSession(event.document)) {
      throttledUpdateStickys(event);
    }
  }

  function handleDidChangeActiveTextEditor(
    editor: ActiveTextEditorChangeEventResult
  ) {
    if (editor) {
      wolfAPI.updateLineCount(editor.document.lineCount);
      if (wolfAPI.sessions.sessionIsActiveByDocument(editor.document)) {
        throttledRefreshDecorations(false);
        wolfAPI.enterWolfContext();
      } else {
        wolfAPI.exitWolfContext();
      }
    }
  }

  let updateTimeout = null;
  let stickyTimeout = null;

  function throttledRefreshDecorations(trace: boolean = true) {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(
      () => wolfAPI.traceOrRenderPreparedDecorations(trace),
      500
    );
  }

  function throttledUpdateStickys(event: TextDocumentChangeEvent) {
    if (stickyTimeout) {
      clearTimeout(stickyTimeout);
    }
    stickyTimeout = setTimeout(() => wolfAPI.updateStickys(event), 100);
  }

  function cancelPending() {
    [updateTimeout, stickyTimeout].forEach(pending => {
      if (pending) clearTimeout(pending);
    });
  }
}
