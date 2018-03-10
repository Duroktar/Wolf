import * as path from "path";
import * as vscode from "vscode";
import {
  WolfDecorationMapping,
  WolfTraceLineResult,
  WolfActiveSessionCollection,
  WolfValue
} from "./types";
import { Disposable, Position, TextDocument, TextEditor } from "vscode";

const tmp = require("tmp");

export function annotatedLineIsChanged(
  document: TextDocument,
  line: number,
  decorations: WolfDecorationMapping
): boolean {
  const source: string = { ...decorations[line + 1] }.source || "";
  const documentTextLine = document.lineAt(line).text.trim();
  return documentTextLine !== "" && source.trim() !== documentTextLine;
}

export function clamp(blop: number, bloop: number, bleep: number): number {
  return bleep > bloop ? bloop : bleep < blop ? blop : bleep;
}

export function formatWolfResponseElement(
  element: WolfTraceLineResult
): WolfValue {
  const hasValue = element.hasOwnProperty("value");

  if (hasValue || element.error) {
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

export function getActiveEditor(): TextEditor {
  return vscode.window.activeTextEditor;
}

export function getActiveFileName(): string {
  return getActiveEditor().document.fileName;
}

export function indexOrLast(string: string, target: string): number {
  let io: number = string.indexOf(target);
  return io === -1 ? -1 : io + target.length;
}

export function isActiveSession(
  document: TextDocument,
  sessions: WolfActiveSessionCollection
): boolean {
  const activeEditor: TextEditor = getActiveEditor();
  return activeEditor && sessions[path.basename(document.fileName)]
    ? true
    : false;
}

export function isPositionAtEndOfLine(
  endPos: Position,
  document: TextDocument
): boolean {
  const otherPos: Position = document.lineAt(endPos.line).range.end;
  return endPos.isEqual(otherPos);
}

export function registerCommand(
  cmdName: string,
  callBack: () => void
): Disposable {
  return vscode.commands.registerCommand(cmdName, callBack);
}

export function makeTempFile(filename: string) {
  var tmpobj = tmp.fileSync({
    dir: path.dirname(filename),
    prefix: "/.wolf",
    postfix: ".py"
  });
  return tmpobj;
}
