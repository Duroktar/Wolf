import * as path from "path";
import * as vscode from "vscode";
import type { WolfTraceLineResult } from "./types";
import type { Disposable, TextEditor } from "vscode";

import * as tmp from "tmp";

export function formatWolfResponseElement(
  element: WolfTraceLineResult
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

export function getActiveEditor(): TextEditor {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor == null)
    throw new Error('No active TextEditor')
  return activeEditor;
}

export function registerCommand(
  cmdName: string,
  callBack: (...args: unknown[]) => unknown
): Disposable {
  return vscode.commands.registerCommand(cmdName, callBack);
}

export function makeTempFile(filename: string): tmp.FileResult {
  return tmp.fileSync({
    dir: path.dirname(filename),
    prefix: "/.wolf",
    postfix: ".py"
  });
}
