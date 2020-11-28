import type { TextEditor, TextDocument } from "vscode";
import type { WolfActiveSessionCollection } from "./types";

export function wolfSessionStoreFactory(): WolfSessionController {
  return new WolfSessionController();
}

export class WolfSessionController {
  private _sessions: WolfActiveSessionCollection = {};

  public clearAllSessions(): void {
    this._sessions = {};
  }

  public createSessionFromEditor(editor: TextEditor): void {
    this._sessions[editor.document.fileName] = editor;
  }

  public getSessionByFileName(fileName: string): TextEditor {
    return this._sessions[fileName];
  }

  public sessionIsActiveByDocument(document: TextDocument): boolean {
    return !!this._sessions[document.fileName];
  }

  public get sessionNames(): string[] {
    return Object.keys(this._sessions);
  }
}
