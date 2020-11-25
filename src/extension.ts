import * as vscode from "vscode";
import {
  ExtensionContext,
  OutputChannel,
  TextDocumentChangeEvent
} from "vscode";

import { wolfStandardApiFactory, WolfAPI } from "./api";
import { ActiveTextEditorChangeEventResult } from "./types";
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

    forceRefreshDocument(wolfAPI);
  }

  function stopWolf(): void {
    wolfAPI.stopWolf();
    cancelPending();
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
          throttledHandleDidChangeTextDocument({
            document: editor.document
          } as TextDocumentChangeEvent);
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

  function changedConfiguration(event: vscode.ConfigurationChangeEvent): void {
    if (
      event.affectsConfiguration("wolf.pawPrintsInGutter") ||
      event.affectsConfiguration("wolf.updateFrequency") ||
      event.affectsConfiguration("wolf.maxLineLength")
    ) {
      wolfAPI.setConfigUpdatedFlag(true);
    }
  }

  function cancelPending(): void {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
  }

  function throttledHandleDidChangeTextDocument(
    event: TextDocumentChangeEvent
  ): void {
    cancelPending()
    updateTimeout = setTimeout(
      () => wolfAPI.handleDidChangeTextDocument(event.document),
      clamp(100, 10000, wolfAPI.updateFrequency ?? Infinity)
    );
  }

  function forceRefreshDocument(wolfAPI: WolfAPI) {
    wolfAPI.activeEditor.edit((selectedText) => {
      selectedText.insert(new vscode.Position(0, 0), ' ');
    });
    setTimeout(() => {
      wolfAPI.activeEditor.edit((selectedText) => {
        selectedText.delete(new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(0, 1)
        ));
      });
    }, 10);
  }
}
