import type { OutputChannel } from "vscode";


export class WolfOutputController {
  constructor(private _channel: OutputChannel) {}

  public log(text: string): void {
    this._channel.append(text);
  }

  public clear(): void {
    this._channel.clear();
  }
}
