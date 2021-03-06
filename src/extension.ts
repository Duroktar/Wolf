import * as vscode from "vscode";
import type {
  ExtensionContext,
  ConfigurationChangeEvent,
  OutputChannel,
  TextDocumentChangeEvent,
} from "vscode";

import { wolfStandardApiFactory, WolfAPI } from "./api";
import type { ActiveTextEditorChangeEventResult } from "./types";
import { registerCommand } from "./helpers";
import { clamp } from "./utils";

export function activate(context: ExtensionContext): WolfAPI {
  const output: OutputChannel = vscode.window.createOutputChannel("Wolf");
  const wolfAPI: WolfAPI = wolfStandardApiFactory(context, { output });
  let updateTimeout: null | NodeJS.Timeout = null;

  initializeWolfExtension();

  return wolfAPI;

  function initializeWolfExtension(): void {
    context.subscriptions.push(
      registerCommand("wolf.touchBarStart", startWolf),
      registerCommand("wolf.touchBarStop", stopWolf),
      registerCommand("wolf.barkAtCurrentFile", startWolf),
      registerCommand("wolf.stopBarking", stopWolf)
    );

    const sharedOptions = [null, context.subscriptions];
    vscode.window.onDidChangeActiveTextEditor(changedActiveTextEditor, ...sharedOptions);
    vscode.workspace.onDidChangeTextDocument(changedTextDocument, ...sharedOptions);
    vscode.workspace.onDidChangeConfiguration(changedConfiguration, ...sharedOptions);
  }

  function startWolf(): void {
    if (wolfAPI.shouldShowHotModeWarning) {
      wolfAPI.displayHotModeWarning();
    }

    wolfAPI.stepInWolf();

    if (wolfAPI.activeEditorIsDirty)
      forceRefreshActiveDocument(wolfAPI);
  }

  function stopWolf(): void {
    wolfAPI.stopWolf();
    clearThrottleUpdateBuffer();
  }

  function changedActiveTextEditor(
    editor: ActiveTextEditorChangeEventResult
  ): void {
    if (editor) {
      if (wolfAPI.sessions.sessionIsActiveByDocument(editor.document)) {
        if (wolfAPI.configChanged) {
          vscode.window.showInformationMessage(
            "Wolf detected a change to the Hot Mode configuration and was shut off.. " +
              "Attempting to restart."
          );
          wolfAPI.setConfigUpdatedFlag(false);
          stopWolf();
          wolfAPI.stepInWolf();
        } else {
          wolfAPI.enterWolfContext();
          forceRefreshActiveDocument(wolfAPI);
        }
      } else {
        wolfAPI.exitWolfContext();
      }
    }
  }

  function changedTextDocument(event: TextDocumentChangeEvent): void {
    if (wolfAPI.isDocumentWolfSession(event.document)) {
      throttledHandleDidChangeTextDocument(event);
    }
  }

  function changedConfiguration(event: ConfigurationChangeEvent): void {
    if (
      event.affectsConfiguration("wolf.pawPrintsInGutter") ||
      event.affectsConfiguration("wolf.updateFrequency") ||
      event.affectsConfiguration("wolf.maxLineLength")
    ) {
      wolfAPI.setConfigUpdatedFlag(true);
    }
  }

  function throttledHandleDidChangeTextDocument(
    event: TextDocumentChangeEvent
  ): void {
    clearThrottleUpdateBuffer()
    updateTimeout = setTimeout(
      () => wolfAPI.traceAndSetDecorationsUsingTempFile(event.document),
      clamp(100, 10000, wolfAPI.updateFrequency ?? Infinity)
    );
  }

  function forceRefreshActiveDocument(wolfAPI: WolfAPI) {
    throttledHandleDidChangeTextDocument({
      document: wolfAPI.activeEditor.document
    } as TextDocumentChangeEvent);
  }

  function clearThrottleUpdateBuffer(): void {
    if (updateTimeout)
      clearTimeout(updateTimeout);
  }
}
