import * as vscode from "vscode";
import {
  ExtensionContext,
  TextDocument,
  TextDocumentChangeEvent
} from "vscode";

import { wolfStandardApiFactory, WolfAPI } from "./api";
import { hotModeWarning } from "./hotWarning";
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
    const _init = () => {
      wolfAPI.stepInWolf();
      wolfAPI.enterWolfContext();
      throttledHandleDidSaveTextDocument();
    };
    if (wolfAPI.isHot && !wolfAPI.hotModeWarningDisabled) {
      hotModeWarning(_init);
    } else {
      _init();
    }
  }

  function stopWolf(): void {
    wolfAPI.stopWolf();
    wolfAPI.exitWolfContext();
    cancelPending();
  }

  function changedActiveTextEditor(
    editor: ActiveTextEditorChangeEventResult
  ): void {
    if (editor) {
      wolfAPI.updateLineCount(editor.document.lineCount);
      if (wolfAPI.sessions.sessionIsActiveByDocument(editor.document)) {
        if (wolfAPI.configChanged) {
          vscode.window.showInformationMessage(
            "Wolf detected a change to its configuration and was shut off. Please start Wolf again to continue."
          );
          wolfAPI.setConfigUpdatedFlag(false);
          stopWolf();
        } else {
          throttledHandleDidSaveTextDocument(false);
          wolfAPI.enterWolfContext();
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
