import * as vscode from "vscode";
import { ActiveTextEditorChangeEventResult } from "./types";
import { WolfAPI } from "./api";
import { registerCommand } from "./helpers";
import { clamp, not } from "./utils";
import { wolfStandardApiFactory, wolfServerDaemonFactory } from "./factories";

export function activate(context: vscode.ExtensionContext): WolfAPI {
  const output = vscode.window.createOutputChannel("Wolf");
  const wolfAPI = wolfStandardApiFactory(context, { output });
  let updateTimeout: null | NodeJS.Timeout = null;
  wolfServerDaemonFactory(wolfAPI).start(),

  context.subscriptions.push(
    registerCommand("wolf.barkAtCurrentFileLive", startWolfLiveMode),
    registerCommand("wolf.barkAtCurrentFile", startWolfNormal),
    registerCommand("wolf.touchBarStart", startWolfNormal),
    registerCommand("wolf.touchBarStop", wolfAPI.stopWolf),
    registerCommand("wolf.stopBarking", wolfAPI.stopWolf),

    vscode.window.onDidChangeActiveTextEditor(changedActiveTextEditor),
    vscode.workspace.onDidChangeTextDocument(changedTextDocument),
    vscode.workspace.onDidChangeConfiguration(changedConfiguration),
    vscode.workspace.onDidCloseTextDocument(closedTextDocument),
    vscode.workspace.onDidSaveTextDocument(savedTextDocument),
  );

  return wolfAPI;

  function startWolfLiveMode(): void {
    wolfAPI.stepInWolf(true);
  }

  function startWolfNormal(): void {
    wolfAPI.stepInWolf();
  }

  function changedActiveTextEditor(
    event: ActiveTextEditorChangeEventResult
  ): void {
    if (event == null)
      return;

    if (not(wolfAPI.isWolfSession(event.document))) {
      wolfAPI.exitWolfContext();
      return;
    }

    if (wolfAPI.configChanged) {
      vscode.window.showInformationMessage(
        "Wolf detected a change to the configuration " +
        "and was shut off.. Attempting to restart."
      );

      wolfAPI.setChangedConfigFlag(false);
      wolfAPI.stopWolf()

      if (wolfAPI.isLiveEditing(event.document))
        startWolfLiveMode()
      else
        startWolfNormal()

      return;
    }

    wolfAPI.reRenderDecorations();
    wolfAPI.enterWolfContext();
  }

  function changedConfiguration(
    event: vscode.ConfigurationChangeEvent,
  ): void {
    if (
      event.affectsConfiguration("wolf.pawPrintsInGutter") ||
      event.affectsConfiguration("wolf.updateFrequency") ||
      event.affectsConfiguration("wolf.maxLineLength")
    ) {
      wolfAPI.setChangedConfigFlag(true);
    }
  }

  function changedTextDocument(
    event: vscode.TextDocumentChangeEvent,
  ): void {
    if (not(wolfAPI.isWolfSession(event.document)))
      return
    
    if (not(wolfAPI.isLiveEditing(event.document)))
      throttledHandleDidChangeTextDocument(event);
  }

  function savedTextDocument(
    document: vscode.TextDocument,
  ): void {
    if (not(wolfAPI.isWolfSession(document))) {
      return
    }

    if (wolfAPI.isLiveEditing(document)) {
      wolfAPI.stopWolf()
      startWolfLiveMode()
    }
  }

  function closedTextDocument(
    document: vscode.TextDocument,
  ): void {
    if (wolfAPI.isWolfSession(document)) {
      wolfAPI.stopSession(document)
    }
  }

  function throttledHandleDidChangeTextDocument(
    event: Pick<vscode.TextDocumentChangeEvent, 'document'>
  ): void {
    clearThrottledUpdateTimer()
    updateTimeout = setTimeout(
      () => wolfAPI.traceAndSetDecorations(event.document),
      clamp(100, 10000, wolfAPI.updateFrequency ?? Infinity)
    );
  }

  function clearThrottledUpdateTimer(): void {
    if (updateTimeout)
      clearTimeout(updateTimeout);
  }
}
