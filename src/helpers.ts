import * as path from "path";
import * as vscode from "vscode";
import {
  WolfDecorationMapping,
  WolfTraceLineResult,
  WolfActiveSessionCollection,
} from "./types";
import { Disposable, Position, TextDocument, TextEditor } from "vscode";

import * as tmp from "tmp";

export function annotatedLineIsChanged(
  document: TextDocument,
  line: number,
  decorations: WolfDecorationMapping
): boolean {
  const source = { ...decorations[line + 1] }.source.trim();
  const documentTextLine = document.lineAt(line).text.trim();
  return documentTextLine !== "" && source !== documentTextLine;
}

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

export function getActiveFileName(): string | undefined {
  return getActiveEditor()?.document.fileName;
}

export function indexOrLast(string: string, target: string): number {
  const idx = string.indexOf(target);
  return idx === -1 ? -1 : idx + target.length;
}

export function isActiveSession(
  document: TextDocument,
  sessions: WolfActiveSessionCollection
): boolean {
  return !!sessions[path.basename(document.fileName)];
}

export function isPositionAtEndOfLine(
  endPos: Position,
  document: TextDocument
): boolean {
  const line = document.lineAt(endPos.line);
  return endPos.isEqual(line.range.end);
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

export function stringEscape(text: string | number): string {
  // From: `js-string-escape` https://github.com/joliss/js-string-escape
  // License: MIT ~ https://github.com/joliss/js-string-escape/blob/master/LICENSE

  return ("" + text).replace(/[\\\n\r\u2028\u2029]/g, (char: string) => {
    // Escape all characters not included in SingleStringCharacters and
    // DoubleStringCharacters on
    // http://www.ecma-international.org/ecma-262/5.1/#sec-7.8.4
    switch (char) {
      case "\\":
        return "\\" + char;
      // Four possible LineTerminator characters need to be escaped:
      case "\n":
        return "\\n";
      case "\r":
        return "\\r";
      case "\u2028":
        return "\\u2028";
      case "\u2029":
        return "\\u2029";
      default:
        return char;
    }
  });
}
