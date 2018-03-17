import { OutputChannel } from "vscode";

export function wolfOutputFactory(channel: OutputChannel) {
  return new WolfOutputController(channel);
}

export class WolfOutputController {
  constructor(private _channel: OutputChannel) {}

  public log(text: string): void {
    this._channel.append(text);
  }

  public clear(): void {
    this._channel.clear();
  }
}
