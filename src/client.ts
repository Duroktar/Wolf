import * as Websocket from 'ws';
import { EventEmitter } from 'events';
import { clampBelow, nameOf } from './utils';
import { WolfClientEventCallbackMap } from './types';
import { consoleLoggerFactory } from './factories';


export class WolfClient {
  private _logger = consoleLoggerFactory(nameOf(WolfClient))
  public constructor(
    private host: string,
    private port: string,
    public identifier: string,
    private authToken?: string,
  ) { }

  public connect(retry = 10, wait = 100): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._closed = false;
      this._connectReject = reject;
      this._logger.debug('Connecting')

      this._socket = new Websocket(this.connectionString(), this.authToken ? {
        headers: { Authorization: `Bearer ${this.authToken}` },
      } : undefined);
      const socket = this._socket;
      let opened = false;

      socket.once('error', err => {
        // The client always tries connecting too soon so retry a few times.
        const connectionError = err.message.includes('ECONNREFUSED');
        if (connectionError && retry > 0 && !this._closed) {
          this._logger.debug(`... Retrying in ${wait}ms`)
          this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = undefined;
            this.connect(retry - 1, clampBelow(1500, wait * 2)).then(resolve, reject)
          }, wait)
        }
        else if (!this._closed) {
          reject(connectionError
            ? this._logger.error('Retries exceeded. Aborting..')
            : err)
        }
      })

      socket.once('close', () => {
        if (!opened && !this._closed && this._socket === socket && !this._reconnectTimer)
          reject(new Error('Wolf server closed before the connection opened'));
      });

      socket.once('open', () => {
        if (this._closed) {
          socket.close();
          return;
        }
        opened = true;
        this._logger.info('Connected')
        this._connectReject = undefined;

        socket.on('message', this.handleMessage)

        socket.on('close', () => {
          this._logger.debug('Closed')
          this.emit('close')
        })

        resolve(this.emit('ready', this.identifier))
      })
    })
  }

  public close = (): void => {
    this._closed = true;
    if (this._reconnectTimer)
      clearTimeout(this._reconnectTimer)
    this._reconnectTimer = undefined;
    this._connectReject?.(new Error('Wolf client closed before connecting'));
    this._connectReject = undefined;
    this._emitter.removeAllListeners()
    if (this._socket && this._socket.readyState < Websocket.CLOSING)
      this._socket.terminate()
    this._socket = undefined;
  }

  public traceScript = (filepath: string): void => {
    this._socket?.send(JSON.stringify({ filepath }))
  }

  public traceRawSrc(src: string): void {
    this._socket?.send(JSON.stringify({ data: src, raw: true }))
  }

  public on = <E extends keyof WolfClientEventCallbackMap>(
    event: E,
    handler: WolfClientEventCallbackMap[E],
  ): void => {
    this._emitter.on(event, handler)
  }

  public off = <E extends keyof WolfClientEventCallbackMap>(
    event: E,
    handler: WolfClientEventCallbackMap[E],
  ): void => {
    this._emitter.off(event, handler)
  }

  private emit = <E extends keyof WolfClientEventCallbackMap>(
    event: E,
    ...data: Parameters<WolfClientEventCallbackMap[E]>
  ) => {
    this._emitter.emit(event, ...data)
  }

  private handleMessage = (data: Buffer): void => {
    try {
      const message = JSON.parse(data.toString())

      if (message.eof) {
        this.emit('eof', message)
      } else {
        this.emit('data', message)
      }
    }
    catch (err) {
      this._logger.warn(`Error parsing data: ${data.toString()}`)
      this.emit('error', err instanceof Error ? err : new Error(String(err)))
    }

  }

  private connectionString(): string | import("url").URL {
    const url = new URL(`ws://${this.host}:${this.port}`);
    url.pathname = `/${this.identifier}`;
    return url;
  }

  private _socket: Websocket | undefined
  private _emitter = new EventEmitter()
  private _reconnectTimer: NodeJS.Timeout | undefined
  private _connectReject: ((reason?: Error) => void) | undefined
  private _closed = false
}
