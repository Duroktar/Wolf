import * as vscode from "vscode";
import {
  ExtensionContext,
  TextDocument,
  TextDocumentChangeEvent
} from "vscode";

import { wolfStandardApiFactory, WolfAPI } from "./api";
import { ActiveTextEditorChangeEventResult } from "./types";
import { clamp, registerCommand } from "./utils";

export function activate(context: ExtensionContext) {
  const wolfAPI: WolfAPI = wolfStandardApiFactory(context);

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
    vscode.workspace.onDidSaveTextDocument(savedTextDocument, ...opts);
    vscode.workspace.onDidChangeConfiguration(changedConfiguration, ...opts);
  }

  function startWolf(): void {
    if (wolfAPI.activeEditorIsDirty) {
      const message = "Please save the document before running Wolf.";
      vscode.window.showInformationMessage(message);
    } else {
      wolfAPI.stepInWolf();
      throttledHandleDidSaveTextDocument();
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
        wolfAPI.updateLineCount(editor.document.lineCount);
        if (wolfAPI.configChanged) {
          vscode.window.showInformationMessage(
            "Wolf detected a change to its configuration and was shut off. Please start Wolf again to continue."
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

  function savedTextDocument(document: TextDocument): void {
    if (wolfAPI.isDocumentWolfSession(document)) {
      wolfAPI.updateLineCount(document.lineCount);
      throttledHandleDidSaveTextDocument(true);
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
  let stickyTimeout = null;

  function cancelPending(): void {
    [updateTimeout, stickyTimeout].forEach(pending => {
      if (pending) clearTimeout(pending);
    });
  }

  function throttledHandleDidSaveTextDocument(trace: boolean = true): void {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(
      () => wolfAPI.handleDidSaveTextDocument(trace),
      wolfAPI.isHot ? clamp(100, 10000, wolfAPI.updateFrequency) : 500
    );
  }

  function throttledHandleDidChangeTextDocument(
    event: TextDocumentChangeEvent
  ): void {
    if (stickyTimeout) {
      clearTimeout(stickyTimeout);
    }
    stickyTimeout = setTimeout(
      () => wolfAPI.handleDidChangeTextDocument(event),
      450
    );
  }
}
