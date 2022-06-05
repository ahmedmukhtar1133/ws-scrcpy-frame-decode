/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable consistent-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/prefer-default-export */
import WS from 'ws';
import { Mw } from './Mw';

// const WS = window.require('ws');

export class WebsocketProxy extends Mw {
  public static readonly TAG = 'WebsocketProxy';

  private remoteSocket?: any;

  private released = false;

  private storage: any = [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static processRequest(
    ws: any,
    params: any
  ): WebsocketProxy | undefined {
    const { parsedQuery } = params;
    console.log('WebsocketProxy', parsedQuery);
    if (!parsedQuery) {
      return;
    }
    if (parsedQuery.action !== 'proxy-ws') {
      return;
    }
    if (typeof parsedQuery.ws !== 'string') {
      ws.close(4003, `[${this.TAG}] Invalid value "${ws}" for "ws" parameter`);
      return;
    }
    return this.createProxy(ws, parsedQuery.ws);
  }

  public static createProxy(ws: any, remoteUrl: string): WebsocketProxy {
    console.log('createProxy', ws);
    const service = new WebsocketProxy(ws);
    service.init(remoteUrl).catch((e) => {
      console.log('StartingWebSocket...');
      const msg = `[${this.TAG}] Failed to start service: ${e.message}`;
      console.error(msg);
      ws.close(4005, msg);
    });
    return service;
  }

  constructor(ws: any) {
    super(ws);
  }

  public async init(remoteUrl: string): Promise<void> {
    this.name = `[${WebsocketProxy.TAG}{$${remoteUrl}}]`;
    const remoteSocket = new WS(remoteUrl);
    remoteSocket.onopen = () => {
      this.remoteSocket = remoteSocket;
      this.flush();
    };
    remoteSocket.onmessage = (event: any) => {
      if (this.ws && this.ws.readyState === this.ws.OPEN) {
        if (Array.isArray(event.data)) {
          event.data.forEach((data: any) => this.ws.send(data));
        } else {
          this.ws.send(event.data);
        }
      }
    };
    remoteSocket.onclose = (e: any) => {
      if (this.ws.readyState === this.ws.OPEN) {
        this.ws.close(e.wasClean ? 1000 : 4010);
      }
    };
    remoteSocket.onerror = (e: any) => {
      if (this.ws.readyState === this.ws.OPEN) {
        this.ws.close(4011, e.message);
      }
    };
  }

  private flush(): void {
    if (this.remoteSocket) {
      while (this.storage.length) {
        const event = this.storage.shift();
        if (event && event.data) {
          this.remoteSocket.send(event.data);
        }
      }
      if (this.released) {
        this.remoteSocket.close();
      }
    }
    this.storage.length = 0;
  }

  protected onSocketMessage(event: any): void {
    if (this.remoteSocket) {
      this.remoteSocket.send(event.data);
    } else {
      this.storage.push(event);
    }
  }

  public release(): void {
    if (this.released) {
      return;
    }
    super.release();
    this.released = true;
    this.flush();
  }
}
