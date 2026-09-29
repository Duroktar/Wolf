/* eslint-disable @typescript-eslint/no-explicit-any */
import { ILogger } from "./types"


export enum LogLevel {
  OFF = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  ALL = 5,
}

export class ConsoleLogger implements ILogger {
  constructor(
    private id: string,
    private level = LogLevel.ERROR,
  ) {}

  public info(...args: any[]): void {
    if (this.shouldPrint(LogLevel.INFO))
      console.log(this.formatLogString(), ...args)
  }
  public log(...args: any[]): void {
    if (this.shouldPrint(LogLevel.INFO))
      console.log(this.formatLogString(), ...args)
  }
  public error(...args: any[]): void {
    if (this.shouldPrint(LogLevel.ERROR))
      console.error(this.formatLogString(), ...args)
  }
  public warn(...args: any[]): void {
    if (this.shouldPrint(LogLevel.WARN))
      console.warn(this.formatLogString(), ...args)
  }
  public debug(...args: any[]): void {
    if (this.shouldPrint(LogLevel.DEBUG))
      console.debug(this.formatLogString(), ...args)
  }

  private shouldPrint = (lvl: LogLevel) => this.level >= lvl
  private formatLogString = () =>
    `[${LogLevel[this.level]}][${new Date().toISOString()}][${this.id}]:`

}
