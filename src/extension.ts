import * as vscode from "vscode";
import { ActiveTextEditorChangeEventResult } from "./types";
import { WolfAPI } from "./api";
import { registerCommand } from "./helpers";
import { clamp, not } from "./utils";
import { wolfStandardApiFactory } from "./factories";

let activeWolfAPI: WolfAPI | null = null;

export function activate(context: vscode.ExtensionContext): WolfAPI {
  const output = vscode.window.createOutputChannel("Wolf");
  const wolfAPI = wolfStandardApiFactory(context, { output });
  activeWolfAPI = wolfAPI;
  const updateTimeouts = new Map<string, NodeJS.Timeout>();

  if (not(Boolean(process.env.WOLF_TEST_SESSION ?? process.env.CI)))
    wolfAPI.startServer();

  context.subscriptions.push(
    output,
    { dispose: () => wolfAPI.dispose() },

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
    { dispose: clearThrottledUpdateTimers },
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
      clearThrottledUpdateTimer(event.document);
      wolfAPI.restartSession(event.document);

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
      if (!wolfAPI.updateOnSaveOnly)
        throttledHandleDidChangeTextDocument(event);
  }

  function savedTextDocument(
    document: vscode.TextDocument,
  ): void {
    if (not(wolfAPI.isWolfSession(document))) {
      return
    }

    if (wolfAPI.isLiveEditing(document)) {
      clearThrottledUpdateTimer(document);
      wolfAPI.restartSession(document);
    } else if (wolfAPI.updateOnSaveOnly) {
      clearThrottledUpdateTimer(document);
      wolfAPI.traceAndSetDecorations(document);
    }
  }

  function closedTextDocument(
    document: vscode.TextDocument,
  ): void {
    clearThrottledUpdateTimer(document);
    if (wolfAPI.isWolfSession(document)) {
      wolfAPI.stopSession(document)
    }
  }

  function throttledHandleDidChangeTextDocument(
    event: Pick<vscode.TextDocumentChangeEvent, 'document'>
  ): void {
    clearThrottledUpdateTimer(event.document);
    const filename = event.document.fileName;
    const timeout = setTimeout(() => {
      updateTimeouts.delete(filename);
      if (wolfAPI.isWolfSession(event.document))
        wolfAPI.traceAndSetDecorations(event.document);
    },
      clamp(100, 10000, wolfAPI.updateFrequency ?? Infinity)
    );
    updateTimeouts.set(filename, timeout);
  }

  function clearThrottledUpdateTimer(document: vscode.TextDocument): void {
    const filename = document.fileName;
    const timeout = updateTimeouts.get(filename);
    if (timeout) {
      clearTimeout(timeout);
      updateTimeouts.delete(filename);
    }
  }

  function clearThrottledUpdateTimers(): void {
    for (const timeout of updateTimeouts.values())
      clearTimeout(timeout);
    updateTimeouts.clear();
  }
}

export function deactivate(): void {
  if (activeWolfAPI) {
    activeWolfAPI.dispose();
    activeWolfAPI = null;
  }
}

