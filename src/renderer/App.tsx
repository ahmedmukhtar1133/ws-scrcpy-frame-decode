/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { BasePlayer } from 'main/player/BasePlayer';
import { CommandControlMessage } from 'main/player/controlMessage/CommandControlMessage';
import { StreamReceiverScrcpy } from 'main/player/streamReciever/StreamReceiverScrcpy';
import { TinyH264Player } from 'main/player/TinyH264Player';
import VideoSettings from 'main/player/VideoSettings';
import React from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import icon from '../../assets/icon.svg';
import './App.css';

let fitToScreen: any = false;
let joinedStream = true;
let streamReceiver: any = null;
let clientsCount = 0;
let streamConnected = false;

const createVideoSettingsWithBounds = (old: any, newBounds: any) => {
  return new VideoSettings({
    crop: old.crop,
    bitrate: old.bitrate,
    bounds: newBounds,
    maxFps: old.maxFps,
    iFrameInterval: old.iFrameInterval,
    sendFrameMeta: old.sendFrameMeta,
    lockedVideoOrientation: old.lockedVideoOrientation,
    displayId: old.displayId,
    codecOptions: old.codecOptions,
    encoderName: old.encoderName,
  });
};

const applyNewVideoSettings = (
  player: any,
  videoSettings: any,
  saveToStorage: any
) => {
  if (player) {
    player.setVideoSettings(videoSettings, fitToScreen, saveToStorage);
  }
};

const onVideo = (data: any, player: any) => {
  console.log('player', player);
  streamConnected = true;
  if (!player) {
    return;
  }
  console.log('RenderingVideo...', data.byteLength);
  const { STATE } = BasePlayer;
  if (player.getState() === STATE.PAUSED) {
    player.play();
  }
  if (player.getState() === STATE.PLAYING) {
    player.pushFrame(new Uint8Array(data));
  }
};

const sendMessage = (e: any) => {
  console.log('MessageEventRecievedStreamClient', e);
  streamReceiver.sendEvent(e);
};

const onDisplayInfo = (player: any, infoArray: any) => {
  if (!player) {
    return;
  }
  let currentSettings = player.getVideoSettings();
  const { displayId } = currentSettings;
  const info = infoArray.find((value: any) => {
    return value.displayInfo.displayId === displayId;
  });
  console.log('DisplayInfo', currentSettings, displayId, info);
  if (!info) {
    return;
  }
  if (player.getState() === BasePlayer.STATE.PAUSED) {
    console.log('PlayPlayer...');
    player.play();
  }
  const { videoSettings, screenInfo } = info;
  player.setDisplayInfo(info.displayInfo);
  if (typeof fitToScreen !== 'boolean') {
    fitToScreen = player.getFitToScreenStatus();
  }
  if (fitToScreen) {
    const newBounds = this.getMaxSize();
    if (newBounds) {
      currentSettings = createVideoSettingsWithBounds(
        currentSettings,
        newBounds
      );
      player.setVideoSettings(currentSettings, fitToScreen, false);
    }
  }
  if (!videoSettings || !screenInfo) {
    joinedStream = true;
    console.log('JoinedStream...', joinedStream);
    sendMessage(
      CommandControlMessage.createSetVideoSettingsCommand(currentSettings)
    );
    return;
  }

  clientsCount = info.connectionCount;
  let min = VideoSettings.copy(videoSettings);
  const oldInfo = player.getScreenInfo();
  console.log('VideoSettingsCopy', min, oldInfo, clientsCount);
  if (!screenInfo.equals(oldInfo)) {
    player.setScreenInfo(screenInfo);
  }

  if (!videoSettings.equals(currentSettings)) {
    applyNewVideoSettings(
      player,
      videoSettings,
      videoSettings.equals(this.requestedVideoSettings)
    );
  }
  if (!oldInfo) {
    console.log('OldInfoNotFound...');
    const { bounds } = currentSettings;
    const { videoSize } = screenInfo;
    const onlyOneClient = this.clientsCount === 0;
    const smallerThenCurrent =
      bounds &&
      (bounds.width < videoSize.width || bounds.height < videoSize.height);
    if (onlyOneClient || smallerThenCurrent) {
      min = currentSettings;
    }
    const minBounds = currentSettings.bounds?.intersect(min.bounds);
    if (minBounds && !minBounds.equals(min.bounds)) {
      min = createVideoSettingsWithBounds(min, minBounds);
    }
  }
  if (!min.equals(videoSettings) || !joinedStream) {
    joinedStream = true;
    sendMessage(CommandControlMessage.createSetVideoSettingsCommand(min));
  }
};

window.electron.ipcRenderer.sendMessage('ipc-example', ['ping']);

// this is the function where we'll be recieveing decorded frame in YUV420
// for more details see TinyH264Player lineNo: 84
const decodedFrames = (frames: any) => {
  console.log('decodedFrames', frames);
};

const Hello = () => {
  React.useEffect(() => {
    if (streamConnected) return;
    window.electron.ipcRenderer.once('ipc-example', (deviceId: any) => {
      console.log('deviceId', deviceId);

      const params = {
        action: 'stream',
        hostname: '',
        player: 'mse',
        udid: deviceId,
        ws:
          `ws://${window.location.hostname}:8085` +
          `/?action=proxy-adb&remote=tcp%3A8886&udid=${deviceId}`,
      };

      const playerSet = new TinyH264Player(deviceId, decodedFrames);

      console.log('pForPlayer', playerSet.getTouchableElement());

      // this.setTouchListeners(player);
      playerSet.setParent(document.getElementsByClassName('video')[0] as any);
      const videoSettings = playerSet.getVideoSettings();
      applyNewVideoSettings(playerSet, videoSettings, false);
      playerSet.play();
      streamReceiver = new StreamReceiverScrcpy(params);
      streamReceiver.on('video', (data: any) => onVideo(data, playerSet));
      streamReceiver.on('displayInfo', (data: any) =>
        onDisplayInfo(playerSet, data)
      );
    });
  });

  return (
    <div>
      <div className="Hello">
        <img width="200px" alt="icon" src={icon} />
      </div>
      <h1>ws-scrcpy-frame-decode</h1>
      <div className="Hello">
        <div className="video" style={{ height: '720px', width: '336px' }} />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
