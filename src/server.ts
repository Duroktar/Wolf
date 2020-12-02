import * as path from 'path';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { consoleLoggerFactory } from './factories';
import { nameOf } from './utils';


export class WolfServerDaemon {
  private _logger = consoleLoggerFactory(nameOf(WolfServerDaemon))
  public constructor(
    private host: string,
    private port: string,
  ) { }

  public start = (pythonPath: string, rootDir: string): this => {
    this._logger.log('Starting')
    this._service = this.getWolfRunner(pythonPath, rootDir)
    this._service.on('close', this.onClose)
    this._service.on('disconnect', this.onDisconnect)
    this._service.on('error', this.onError)
    this._service.on('exit', this.onExit)
    this._service.on('spawn', this.onSpawn)
    this._service.on('message', this.onMessage)
    this._service.stderr.on('data', this.onStderr)
    this._service.stdout.on('data', this.onStdout)
    return this
  }

  public stop = (): this => {
    this._logger.log('Stopping')
    this._service?.off('close', this.onClose)
    this._service?.off('disconnect', this.onDisconnect)
    this._service?.off('error', this.onError)
    this._service?.off('exit', this.onExit)
    this._service?.off('message', this.onMessage)
    this._service?.stderr.off('data', this.onStderr)
    this._service?.stdout.off('data', this.onStdout)
    this._service?.kill()
    return this
  }

  private onStderr = (data: Buffer) => this._logger.error('[onStderr]', data?.toString())
  private onStdout = (data: Buffer) => this._logger.info('[onStdout]', data?.toString())

  private onSpawn = () => this._logger.debug('[onSpawn] child process spawned')
  private onClose = (code?: number, sig?: string) => this._logger.debug('[onClose] code:', code, ', signal:', sig)
  private onDisconnect = () => this._logger.debug('[onDisconnect] disconnected')
  private onError = (err: Error) => this._logger.debug('[onError] Failed to start subprocess. err:', err?.message)
  private onExit = (code?: number) => this._logger.debug('[onExit] code:', code)
  private onMessage = (data: Buffer) => this._logger.debug('[onMessage] message', data?.toString())

  private getWolfRunner(pythonPath: string, rootDir: string) {
    const wolfPath: string = path.join(rootDir, "scripts/server.py");
    const options = { env: { ...process.env } as Record<string, string> }

    /* Copied from https://github.com/Almenon/AREPL-backend/blob/209eb5b8ae8cda1677f925749a10cd263f6d9860/index.ts#L85-L93 */
    if (process.platform == "darwin") {
			// needed for Mac to prevent ENOENT
			options.env.PATH = ["/usr/local/bin", process.env.PATH].join(":")
		}
    else if (process.platform == "win32") {
			// needed for windows for encoding to match what it would be in terminal
			// https://docs.python.org/3/library/sys.html#sys.stdin
      options.env.PYTHONIOENCODING = 'utf8'
    }

    return spawn(pythonPath, [wolfPath, this.host, this.port], options);
  }

  private _service: ChildProcessWithoutNullStreams | null = null
}
