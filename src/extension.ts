import * as vscode from "vscode";
import {
  ExtensionContext,
  OutputChannel,
  TextDocumentChangeEvent
} from "vscode";

import { wolfStandardApiFactory, WolfAPI } from "./api";
import { ActiveTextEditorChangeEventResult } from "./types";
import { clamp, registerCommand } from "./utils";

export function activate(context: ExtensionContext) {
  const output: OutputChannel = vscode.window.createOutputChannel("Wolf");
  const wolfAPI: WolfAPI = wolfStandardApiFactory(context, { output });

  initializeWolfExtension();

  function initializeWolfExtension(): void {
    context.subscriptions.push(
      registerCommand("wolf.touchBarStart", startWolf),
      registerCommand("wolf.touchBarStop", stopWolf),
      registerCommand("wolf.barkAtCurrentFile", startWolf),
      registerCommand("wolf.stopBarking", stopWolf)
    );

    const opts = [null, context.subscriptions];
    vscode.window.onDidChangeActiveTextEditor(changedActiveTextEditor, ...opts);
    vscode.workspace.onDidChangeTextDocument(changedTextDocument, ...opts);
    vscode.workspace.onDidChangeConfiguration(changedConfiguration, ...opts);
  }

  function startWolf(): void {
    if (wolfAPI.activeEditorIsDirty) {
      const message = "Please save the document before running Wolf.";
      vscode.window.showInformationMessage(message);
    } else {
      if (wolfAPI.shouldShowHotModeWarning) {
        wolfAPI.displayHotModeWarning();
      }
      wolfAPI.stepInWolf();
    }
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
            "Wolf detected a change to the Hot Mode configuration and was shut off. " +
              "Start Wolf again to continue."
          );
          wolfAPI.setConfigUpdatedFlag(false);
          stopWolf();
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

  function changedConfiguration(event): void {
    if (
      event.affectsConfiguration("wolf.pawPrintsInGutter") ||
      event.affectsConfiguration("wolf.updateFrequency")
    ) {
      wolfAPI.setConfigUpdatedFlag(true);
    }
  }

  let updateTimeout = null;

  function cancelPending(): void {
    [updateTimeout].forEach(pending => {
      if (pending) clearTimeout(pending);
    });
  }

  function throttledHandleDidChangeTextDocument(
    event: TextDocumentChangeEvent
  ): void {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(
      () => wolfAPI.handleDidChangeTextDocument(event),
      clamp(100, 10000, wolfAPI.updateFrequency)
    );
  }
}
