import { TextEditor, TextDocument } from "vscode";
import { WolfActiveSessionCollection } from "./types";
import { getActiveEditor } from "./helpers";

export function wolfSessionStoreFactory(): WolfSessionController {
  return new WolfSessionController();
}

export class WolfSessionController {
  private _sessions: WolfActiveSessionCollection = {};

  public clearAllSessions(): void {
    this._sessions = {} as WolfActiveSessionCollection;
  }

  public clearSessionByName(name: string): void {
    delete this._sessions[name];
  }

  public createSessionFromEditor(editor: TextEditor): void {
    this._sessions[editor.document.fileName] = editor;
  }

  public getActiveSession(): TextEditor {
    const activeEditor = getActiveEditor();
    return this._sessions[activeEditor.document.fileName];
  }

  public getAllSessions(): WolfActiveSessionCollection {
    return this._sessions;
  }

  public getSessionByFileName(fileName: string): TextEditor {
    return this._sessions[fileName];
  }

  public sessionIsActiveByDocument(document: TextDocument): boolean {
    return this._sessions[document.fileName] ? true : false;
  }

  public sessionIsActiveByFileName(fileName: string): boolean {
    return this._sessions[fileName] ? true : false;
  }

  public get collection(): WolfActiveSessionCollection {
    return this._sessions;
  }

  public get sessionNames(): string[] {
    return Object.keys(this._sessions);
  }
}
