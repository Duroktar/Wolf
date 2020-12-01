import * as path from "path";
import * as vscode from "vscode";
import type * as T from "./types";

import * as tmp from "tmp";
import { assert } from "console";

export function fileIdentifier(
  document: vscode.TextDocument,
): string | undefined {
  return document.fileName.startsWith('/')
    ? document.fileName.slice(1)
    : document.fileName;
}

export function parseAndValidateEofResponse(
  result: T.WolfClientEofResponse,
): T.WolfTraceLineResult[] {
  const totalOutput = JSON.parse(result.total_output);
  assert(Array.isArray(totalOutput), 'Wolf trace results not an array.')
  return totalOutput;
}

export function parseAndValidateResponse(
  result: T.WolfClientDataResponse,
): T.WolfTraceLineResult {
  const parsedResponse = JSON.parse(result.output);
  assert(typeof parsedResponse.lineno === 'number', 'Line number not defined')
  assert(typeof parsedResponse.value !== 'undefined', 'Line value not defined')
  return parsedResponse
}

export function formatWolfResponseElement(
  element: T.WolfTraceLineResult
): string {
  if (element.value || element.error) {
    if (Array.isArray(element.value)) {
      return "[" + element.value.join(", ") + "]";
    }
    switch (typeof element.value) {
      case "string":
      case "number":
        return element.value;
      case "object":
        return JSON.stringify(element.value);
      default:
        return `${element.value}`;
    }
  }
  return '';
}

export function getActiveEditor(): vscode.TextEditor {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor == null)
    throw new Error('No active TextEditor')
  return activeEditor;
}

export function registerCommand(
  cmdName: string,
  callBack: (...args: unknown[]) => unknown
): vscode.Disposable {
  return vscode.commands.registerCommand(cmdName, callBack);
}

export function makeTempFile(filename: string): tmp.FileResult {
  return tmp.fileSync({
    dir: path.dirname(filename),
    prefix: "/.wolf",
    postfix: ".py"
  });
}
