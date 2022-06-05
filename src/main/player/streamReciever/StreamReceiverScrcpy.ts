import { StreamReceiver } from './StreamReceiver';
import Util from '../player-util';

export enum ACTION {
  LIST_HOSTS = 'list-hosts',
  APPL_DEVICE_LIST = 'appl-device-list',
  GOOG_DEVICE_LIST = 'goog-device-list',
  MULTIPLEX = 'multiplex',
  SHELL = 'shell',
  PROXY_WS = 'proxy-ws',
  PROXY_ADB = 'proxy-adb',
  DEVTOOLS = 'devtools',
  STREAM_SCRCPY = 'stream',
  STREAM_WS_QVH = 'stream-qvh',
  PROXY_WDA = 'proxy-wda',
  FILE_LISTING = 'list-files',
}

export class StreamReceiverScrcpy extends StreamReceiver<any> {
  public parseParameters(params: any): any {
    console.log('params', params);
    const typedParams = super.parseParameters(params);
    const { action } = typedParams;
    if (action !== ACTION.STREAM_SCRCPY) {
      throw Error('Incorrect action');
    }
    console.log('StreamRecieverTypedParams', typedParams);
    return {
      ...typedParams,
      action,
      udid: Util.parseStringEnv(params.udid),
      ws: Util.parseStringEnv(params.ws),
      player: Util.parseStringEnv(params.player),
    };
  }
  protected buildDirectWebSocketUrl(): URL {
    return new URL((this.params as any).ws);
  }
}
