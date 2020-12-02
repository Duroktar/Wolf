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
  ) {}

  public connect(retry = 10, wait = 100): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._logger.debug('Connecting')

      this._socket = new Websocket(this.connectionString());

      this._socket?.on('error', err => {
        // The client always tries connecting too soon so retry a few times.
        const connectionError = err.message.includes('ECONNREFUSED');
        if (connectionError && retry > 0)   {
          this._logger.debug(`... Retrying in ${wait}ms`)
          this._reconnectTimer = setTimeout(() => {
            resolve(this.connect(retry - 1, clampBelow(1500, wait * 2)))
          }, wait)
        }
        else if (connectionError && retry === 0) {
          reject(this._logger.error('Retries exceeded. Aborting..'))
        }
        else {
          reject(err)
        }
      })

      this._socket?.once('open', () => {
        this._logger.info('Connected')
        this._socket?.on('close', () => {
          this.emit('close')
          this._logger.debug('Closed')
        })
        this._socket?.on('message', this.handleMessage)
        resolve(this.emit('ready', this.identifier))
      })
    })
  }

  public close = (): void => {
    if (this._reconnectTimer)
      clearTimeout(this._reconnectTimer)
    this._emitter.removeAllListeners()
    this._socket?.close()
  }

  public traceScript = (filepath: string): void => {
    this._socket?.send(JSON.stringify({ filepath  }))
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
      this.emit('error', err)
    }
  }

  private connectionString(): string | import("url").URL {
    return `ws://${this.host}:${this.port}/${this.identifier}`;
  }

  private _socket: Websocket | undefined
  private _emitter = new EventEmitter()
  private _reconnectTimer: NodeJS.Timeout | undefined
}
