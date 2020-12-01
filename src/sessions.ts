import type { TextEditor, TextDocument } from "vscode";
import type { WolfActiveSessionCollection, WolfSession } from "./types";
import { consoleLoggerFactory } from "./factories";
import { nameOf } from "./utils";


export class WolfSessionController {
  private _logger = consoleLoggerFactory(nameOf(WolfSessionController))
  private _sessions: WolfActiveSessionCollection = {};

  public create(opts: WolfSession): void {
    this._logger.debug('Creating')
    this._sessions[opts.editor.document.fileName] = opts;
  }

  public get(document: TextDocument): WolfSession {
    return this._sessions[document.fileName];
  }

  public delete(session: WolfSession): void {
    delete this._sessions[session.editor.document.fileName];
  }

  public deleteFor(editor: TextEditor): void {
    delete this._sessions[editor.document.fileName];
  }

  public deleteByName(fileName: string): void {
    delete this._sessions[fileName];
  }

  public clearAll(): void {
    this._logger.debug('Clearing')
    this._sessions = {};
  }

  public getByFileName(fileName: string): WolfSession {
    return this._sessions[fileName];
  }

  public isActive(document: TextDocument): boolean {
    return !!this._sessions[document.fileName];
  }

  public isLiveEditing(document: TextDocument): boolean {
    return !!this._sessions[document.fileName]?.isLiveEditing;
  }

  public setIsLiveEditing(document: TextDocument, value: boolean): void {
    if (this._sessions[document.fileName])
      this._sessions[document.fileName].isLiveEditing = value;
  }

  public get names(): string[] {
    return Object.keys(this._sessions);
  }
}
