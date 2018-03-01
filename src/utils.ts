import * as path from "path";
import { Position, TextDocument, TextEditor } from "vscode";
import * as vscode from "vscode";

import {
  WolfDecorationMapping,
  WolfTraceLineResult,
  WolfActiveSessionCollection,
  WolfValue
} from "./types";

export function getActiveEditor() {
  return vscode.window.activeTextEditor;
}

export function getActiveFileName() {
  return getActiveEditor().document.fileName;
}

export function isActiveSession(
  document: TextDocument,
  sessions: WolfActiveSessionCollection
) {
  const activeEditor: TextEditor = getActiveEditor();
  return activeEditor && sessions[path.basename(document.fileName)]
    ? true
    : false;
}

export function indexOrLast(string: string, target: string) {
  let io: number = string.indexOf(target);
  return io === -1 ? -1 : io + target.length;
}

export function annotatedLineIsChanged(
  document: TextDocument,
  line: number,
  decorations: WolfDecorationMapping
): boolean {
  const source: string = { ...decorations[line + 1] }.source || "";
  const documentTextLine = document.lineAt(line).text.trim();
  return documentTextLine !== "" && source.trim() !== documentTextLine;
}

export function isPositionAtEndOfLine(
  endPos: Position,
  document: TextDocument
): boolean {
  const otherPos: Position = document.lineAt(endPos.line).range.end;
  return endPos.isEqual(otherPos);
}

export function formatWolfResponseElement(
  element: WolfTraceLineResult
): WolfValue {
  const hasValue = element.hasOwnProperty("value");

  if ((hasValue && element.kind === "line") || element.error) {
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
}
