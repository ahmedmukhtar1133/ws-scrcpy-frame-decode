/* eslint-disable no-bitwise */
/* eslint-disable no-plusplus */
/* eslint-disable no-param-reassign */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line import/no-webpack-loader-syntax
import TinyH264Worker from 'worker-loader!./vendor/tinyh264/H264NALDecoder.worker';
import { BaseCanvasBasedPlayer } from './BaseCanvasBasedPlayer';
import VideoSettings from './VideoSettings';
import YUVWebGLCanvas from './vendor/tinyh264/YUVWebGLCanvas';
import YUVCanvas from './vendor/tinyh264/YUVCanvas';
import Size from './Size';
import { DisplayInfo } from './DisplayInfo';

type WorkerMessage = {
  type: string;
  width: number;
  height: number;
  data: ArrayBuffer;
  renderStateId: number;
};

// eslint-disable-next-line import/prefer-default-export
export class TinyH264Player extends BaseCanvasBasedPlayer {
  public static readonly storageKeyPrefix = 'Tinyh264Decoder';

  public static readonly playerFullName = 'Tiny H264';

  public static readonly playerCodeName = 'tinyh264';

  private static videoStreamId = 1;

  public static readonly preferredVideoSettings: VideoSettings =
    new VideoSettings({
      lockedVideoOrientation: -1,
      bitrate: 524288,
      maxFps: 24,
      iFrameInterval: 5,
      bounds: new Size(480, 480),
      sendFrameMeta: false,
    });

  private worker?: TinyH264Worker;

  private isDecoderReady = false;

  protected canvas?: YUVWebGLCanvas | YUVCanvas;

  public readonly supportsScreenshot: boolean = true;

  public listener: any;

  static getFitToScreenStatus: any;

  static loadVideoSettings: any;

  public udid: any = '';

  public displayInfo: any = '';

  public static isSupported(): boolean {
    return (
      typeof WebAssembly === 'object' &&
      typeof WebAssembly.instantiate === 'function'
    );
  }

  constructor(
    udid: string,
    listener?: any,
    displayInfo?: DisplayInfo,
    name = TinyH264Player.playerFullName
  ) {
    super(udid, displayInfo, name, TinyH264Player.storageKeyPrefix);
    this.listener = listener;
  }

  private onWorkerMessage = (e: MessageEvent): void => {
    const message: WorkerMessage = e.data;
    switch (message.type) {
      case 'pictureReady':
        // eslint-disable-next-line no-case-declarations
        const { width, height, data } = message;
        // this.listener(data, width, height);
        this.listener(new Uint8Array(data), width, height);
        // this.listener(this.decodeC(new Uint8Array(data), width, height), width, height)
        this.onFrameDecoded(width, height, new Uint8Array(data));
        // console.log('ahmad-decoded', this.decodeC(new Uint8Array(data), width, height))
        console.log('hereOnWorkerMessage.');
        break;
      case 'decoderReady':
        this.isDecoderReady = true;
        break;
      default:
        console.error(Error(`Wrong message type "${message.type}"`));
    }
  };

  private initWorker(): void {
    this.worker = new TinyH264Worker();
    this.worker.addEventListener('message', this.onWorkerMessage);
  }

  protected initCanvas(width: number, height: number): void {
    super.initCanvas(width, height);

    if (BaseCanvasBasedPlayer.hasWebGLSupport()) {
      this.canvas = new YUVWebGLCanvas(this.tag);
    } else {
      this.canvas = new YUVCanvas(this.tag);
    }
  }

  protected decode(data: Uint8Array): void {
    if (!this.worker || !this.isDecoderReady) {
      return;
    }

    this.worker.postMessage(
      {
        type: 'decode',
        data: data.buffer,
        offset: data.byteOffset,
        length: data.byteLength,
        renderStateId: TinyH264Player.videoStreamId,
      },
      [data.buffer]
    );
  }

  public play(): void {
    super.play();
    if (!this.worker) {
      this.initWorker();
    }
  }

  public stop(): void {
    super.stop();
    if (this.worker) {
      this.worker.removeEventListener('message', this.onWorkerMessage);
      this.worker.postMessage({
        type: 'release',
        renderStateId: TinyH264Player.videoStreamId,
      });
      delete this.worker;
    }
  }

  // eslint-disable-next-line class-methods-use-this
  public getPreferredVideoSetting(): VideoSettings {
    return TinyH264Player.preferredVideoSettings;
  }

  protected clearState(): void {
    super.clearState();
    if (this.worker) {
      this.worker.postMessage({
        type: 'release',
        renderStateId: TinyH264Player.videoStreamId,
      });
      TinyH264Player.videoStreamId++;
    }
  }

  public getFitToScreenStatus(): boolean {
    return TinyH264Player.getFitToScreenStatus(this.udid, this.displayInfo);
  }

  public loadVideoSettings(): VideoSettings {
    return TinyH264Player.loadVideoSettings(this.udid, this.displayInfo);
  }
}
