import * as http from 'http'
import * as querystring from 'querystring'
import url from 'url'

export type RequestParameters = {
  request: http.IncomingMessage
  parsedUrl: url.UrlWithStringQuery
  parsedQuery: querystring.ParsedUrlQuery
}

export interface MwFactory {
  processRequest(ws: any, params: RequestParameters): Mw | undefined
  processChannel(ws: any, code: string, data?: ArrayBuffer): Mw | undefined
}

export abstract class Mw {
  protected name = 'Mw'

  public static processChannel(_ws: any, _code: string, _data?: ArrayBuffer): Mw | undefined {
    return
  }

  public static processRequest(_ws: any, _params: RequestParameters): Mw | undefined {
    console.log('CallingThis')
    return
  }

  protected constructor(protected readonly ws: any | any) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.ws.addEventListener('message', this.onSocketMessage.bind(this))
    this.ws.addEventListener('close', this.onSocketClose.bind(this))
  }

  protected abstract onSocketMessage(event: any): void

  protected sendMessage = (data: any): void => {
    if (this.ws.readyState !== this.ws.OPEN) {
      return
    }
    this.ws.send(JSON.stringify(data))
  }

  protected onSocketClose(): void {
    this.release()
  }

  public release(): void {
    const { readyState, CLOSED, CLOSING } = this.ws
    if (readyState !== CLOSED && readyState !== CLOSING) {
      this.ws.close()
    }
  }
}
