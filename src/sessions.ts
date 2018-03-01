import * as path from "path";
import { TextEditor, TextDocument, WorkspaceConfiguration } from "vscode";
import { WolfActiveSessionCollection } from "./types";
import { getActiveEditor } from "./utils";

export class WolfSessionController {
  private _sessions: WolfActiveSessionCollection = {};

  constructor(config: WorkspaceConfiguration) {}

  public get collection(): WolfActiveSessionCollection {
    return this._sessions;
  }

  public createSessionFromEditor(editor: TextEditor): void {
    this._sessions[path.basename(editor.document.fileName)] = editor;
  }

  public getActiveSession() {
    const activeEditor: TextEditor = getActiveEditor();
    return this._sessions[path.basename(activeEditor.document.fileName)];
  }

  public getSessionByName(name: string): TextEditor {
    return this._sessions[name];
  }

  public sessionIsActiveByFileName(fileName: string): boolean {
    return this._sessions[path.basename(fileName)] ? true : false;
  }

  public sessionIsActiveByDocument(document: TextDocument): boolean {
    return this._sessions[path.basename(document.fileName)] ? true : false;
  }

  public getAllSessions(): WolfActiveSessionCollection {
    return this._sessions;
  }

  public clearSessionByName(name): void {
    delete this._sessions[name];
  }

  public clearAllSessions(): void {
    this._sessions = {} as WolfActiveSessionCollection;
  }

  public get sessionNames(): string[] {
    return Object.keys(this._sessions);
  }
}

export function wolfSessionStoreFactory(config: WorkspaceConfiguration) {
  return new WolfSessionController(config);
}
