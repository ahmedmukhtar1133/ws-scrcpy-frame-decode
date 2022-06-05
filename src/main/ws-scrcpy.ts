/* eslint-disable no-param-reassign */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import AdbKit from '@devicefarmer/adbkit';
import path from 'path';
import { spawn } from 'child_process';
import url from 'url';
import querystring from 'querystring';
import DeviceClient from '@devicefarmer/adbkit/dist/src/adb/DeviceClient';
import WebSocket from 'ws';
import { WebsocketProxy } from './player/mw/WebSocketProxy';
// const WebSocket = window.require('ws');

const SERVER_PACKAGE = 'com.genymobile.scrcpy.Server';
const SERVER_PORT = 8886;
const SERVER_VERSION = '1.19-ws2';
const SERVER_TYPE = 'web';
const LOG_LEVEL = 'ERROR';
const SCRCPY_LISTENS_ON_ALL_INTERFACES = false;
const ARGUMENTS = [
  SERVER_VERSION,
  SERVER_TYPE,
  LOG_LEVEL,
  SERVER_PORT,
  SCRCPY_LISTENS_ON_ALL_INTERFACES,
];
const TEMP_PATH = '/data/local/tmp/';
const FILE_DIR = path.join(
  process.cwd(),
  'src',
  'main',
  'player',
  'vendor',
  'Genymobile',
  'scrcpy'
);
const FILE_NAME = 'scrcpy-server.jar';
const ARGS_STRING = `/ ${SERVER_PACKAGE} ${ARGUMENTS.join(
  ' '
)} 2>&1 > /dev/null`;
const RUN_COMMAND = `CLASSPATH=${TEMP_PATH}${FILE_NAME} nohup app_process ${ARGS_STRING}`;

/**
 * This class takes care of configuring the WS-ScrCpy app on the testing device
 * WS-ScrCpy with a player is used for streaming the device screen
 */
export default class ScrCpy {
  public client: any = null;

  public deviceId: any = null;

  public device: any = null;

  constructor() {
    this.client = AdbKit.createClient();
    this.client
      .listDevices()
      .then((devices: any) => {
        if (!devices.length) throw new Error('Attach device first.'); // no device attached

        // eslint-disable-next-line prefer-destructuring
        this.deviceId = devices[0]?.id; // get first device
        this.device = this.client.getDevice(this.deviceId);
        return this.deviceId;
      })
      .catch(undefined);
  }

  runShellCommandAdbKit = async (command: any) => {
    console.log('RunningShellCommand...', command);
    return this.device
      .shell(command)
      .then(AdbKit.util.readAll)
      .then((output: any) => output.toString().trim());
  };

  runShellCommandAdb = async (command: any) => {
    console.log('RunningADBCommand...', command);
    return new Promise((resolve, reject) => {
      const cmd = 'adb';
      const args = ['-s', `${this.deviceId}`, 'shell', command];
      const adb = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';

      adb.stdout.on('data', (data) => {
        output += data.toString();
        console.log(
          `[${this.deviceId}]`,
          `stdout: ${data.toString().replace(/\n$/, '')}`
        );
      });

      adb.stderr.on('data', (data) => {
        console.error(`[${this.deviceId}]`, `stderr: ${data}`);
      });

      adb.on('error', (e) => {
        console.error(
          `[${this.deviceId}]`,
          `failed to spawn adb process.\n${e.stack}`
        );
        reject(e);
      });

      adb.on('close', (code) => {
        console.log(
          `[${this.deviceId}]`,
          `adb process (${args.join(' ')}) exited with code ${code}`
        );
        resolve(output);
      });
    });
  };

  copyServer = async () => {
    const src = path.join(FILE_DIR, FILE_NAME);
    const dst = TEMP_PATH + FILE_NAME; // don't use path.join(): will not work on win host
    return this.device.push(src, dst);
  };

  // eslint-disable-next-line consistent-return
  getServerPid = async (tryCounter = 0) => {
    let pid = await this.runShellCommandAdbKit('pidof app_process');
    pid = parseInt(pid, 10);

    if (pid && Number.isInteger(pid)) {
      return pid;
    }

    await this.copyServer();
    this.runShellCommandAdb(RUN_COMMAND);

    if (tryCounter > 5) throw new Error('Failed to start server');
    // eslint-disable-next-line no-plusplus
    tryCounter++;

    await this.getServerPid(tryCounter);
  };

  connect = async () => {
    // await this.startWs()
    const pid = await this.getServerPid();
    console.log('PidFound', pid);
  };

  forward = async (serial: any, remote: any) => {
    const client = new DeviceClient(this.client, serial);
    const forwards = await client.listForwards();
    const forward = forwards.find((item: any) => {
      return (
        item.remote === remote &&
        item.local.startsWith('tcp:') &&
        item.serial === serial
      );
    });
    if (forward) {
      const { local } = forward;
      return parseInt(local.split('tcp:')[1], 10);
    }
    const port = 1234;
    console.log('startingOnPort', port);
    const local = `tcp:${port}`;
    await client.forward(local, remote);
    return port;
  };

  createProxyOverAdb = (ws: any, udid: any, remote: any, tPath: any) => {
    console.log('createProxyOverAdb', udid, remote, tPath);
    const service = new WebsocketProxy(ws);
    console.log('ProxyService', service);
    this.forward(udid, remote)
      .then((port) => {
        console.log('AdbUtilsForward', `ws://127.0.0.1:${port}${tPath || ''}`);
        return service.init(`ws://127.0.0.1:${port}${tPath || ''}`);
      })
      .catch((e) => {
        const msg = `[Failed to start service: ${e.message}`;
        console.error(msg);
        ws.close(4005, msg);
      });
    return service;
  };

  processWSRequest = (ws: any, params: any) => {
    const { parsedQuery, parsedUrl } = params;
    let udid = '';
    let remote = '';
    let tmpPath = '';
    if (parsedQuery?.action === 'proxy-adb') {
      remote = parsedQuery.remote;
      udid = parsedQuery.udid;
      tmpPath = parsedQuery.path;
    }
    this.createProxyOverAdb(ws, udid, remote, tmpPath);
    return true;
  };

  startWs = () => {
    const wss = new WebSocket.Server({ port: 8085 });
    console.log('wss', wss);
    // const clientWs = new WebSocket('ws://' + window.location.hostname + ':8085')

    wss.on('connection', async (ws: any, request: any) => {
      console.log('RequestUrl', request.url);
      if (!request.url) {
        ws.close(4001, 'Invalid url.');
        return;
      }
      const parsedUrl = url.parse(request.url);
      const parsedQuery = querystring.parse(parsedUrl.query || '');
      console.log('ProcessWsRequest', parsedUrl, parsedQuery);
      const processed = this.processWSRequest(ws, {
        request,
        parsedUrl,
        parsedQuery,
      });

      if (!processed) {
        ws.close(4002, 'Unsupported WS request.');
      }
    });

    return wss;
  };
}
