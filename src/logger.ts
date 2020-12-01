/* eslint-disable @typescript-eslint/no-explicit-any */
import { ILogger } from "./types"


export enum LogLevel {
  OFF = 'OFF',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  ALL = 'ALL',
  DEBUG = 'DEBUG',
}

export class ConsoleLogger implements ILogger {
  constructor(
    private id: string,
    private level = LogLevel.DEBUG,
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

  private shouldPrint = (lvl: LogLevel) => this.level <= lvl
  private formatLogString = () =>
    `[${new Date().toISOString()}][${this.id}]:`
}
