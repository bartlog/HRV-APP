/**
 * PFTP Offline Session Sync
 *
 * Protocol (verified from polar-ble-sdk BlePsFtpClient.kt + BlePsFtpUtils.kt):
 *
 *  Service: 0000FEEE (PSFTP)
 *    FB005C51 (SDK: RFC77_PFTP_MTU_CHARACTERISTIC)
 *      write  → send all commands (request/query/write) here
 *      notify → ALL command responses come back here (readResponse reads mtuInputQueue)
 *    FB005C52 (SDK: RFC77_PFTP_D2H_CHARACTERISTIC)
 *      notify → unsolicited device→host events only (not command responses)
 *    FB005C53 (SDK: RFC77_PFTP_H2D_CHARACTERISTIC)
 *      write  → unsolicited host→device notifications (sendNotification)
 *
 *  Message framing:
 *    RFC60 header (2 bytes, prepended to proto bytes):
 *      REQUEST (GET/PUT/REMOVE): [proto_len_LSB, proto_len_MSB]  (MSB bit7=0)
 *      QUERY   (start/stop/status recording): [query_id_LSB, query_id_MSB|0x80]
 *    RFC76 air-packet header byte: (seq<<4) | status_bits | next_bit
 *      status 0x06 = MORE (bits2-1 = 0b11)
 *      status 0x02 = LAST (bits2-1 = 0b01)
 *    Device response on FB005C51:
 *      status 0x01 = LAST data   → payload = response bytes, done
 *      status 0x03 = MORE data   → payload = chunk, wait for more
 *      status 0x00 = ERROR/RESP  → bytes[1..2] = LE uint16 error code (0=OK)
 *
 *  SDK flow for request/query (BlePsFtpClient.request / .query):
 *    1. waitPsFtpClientReady: subscribe both FB005C51 AND FB005C52 notifications
 *    2. transmitMessages → FB005C51 with writeWithoutResponse
 *    3. waitPacketsWritten (ATT write ACK counter per packet)
 *    4. readResponse: loop on mtuInputQueue (=FB005C51 notifications)
 *       accumulate MORE, complete on LAST, return/throw on ERROR
 */

import {
  PSFTP_SERVICE, PSFTP_CMD_CHAR, PSFTP_D2H_CHAR,
  BATTERY_SERVICE, BATTERY_LEVEL_CHAR,
  buildStartRecordingCmd, buildStopRecordingCmd, buildRecordingStatusCmd,
  buildListExercisesCmd, buildFetchExerciseCmd, buildRemoveExerciseCmd,
  parseRecordingStatus, parseExerciseList, parseExerciseData,
  rfc76Fragment, parseRfc76Header,
} from './polar_pmd.js';

import { db } from '../storage/db.js';
import { t, tf } from '../i18n/index.js';

const PFTP_TIMEOUT_MS = 10000;

// --------------------------------------------------------------------------
// PFTPSession
// --------------------------------------------------------------------------

export class PFTPSession {
  constructor(onProgress) {
    this._device = null;
    this._server = null;
    this._cmd  = null;  // FB005C51: write commands + subscribe for responses
    this._d2h  = null;  // FB005C52: subscribe for unsolicited dev→host notifications
    this._onProgress = onProgress ?? (() => {});

    // Response state (set up before each _sendCommand, resolved by _onCmdNotification)
    this._responseResolve = null;
    this._responseReject  = null;
    this._responseTimer   = null;
    this._dataChunks      = [];
  }

  // -------------------------------------------------------------------------
  // Connection
  // -------------------------------------------------------------------------

  async connect() {
    this._log('Requesting Polar H10 via Web Bluetooth…');
    this._device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Polar H10' }],
      optionalServices: [PSFTP_SERVICE, BATTERY_SERVICE],
    });

    this._log(`Found: ${this._device.name}`);

    // Chrome/Windows: after OS pairing the first connect may drop during security
    // re-exchange. Retry up to 3 times with increasing delay.
    let server = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      server = await this._device.gatt.connect();
      await new Promise(r => setTimeout(r, attempt * 500));
      if (server.connected) break;
      this._log(`GATT connect attempt ${attempt} unstable, retrying…`);
      if (attempt === 3) throw new Error('GATT failed to stabilise after 3 attempts');
    }
    this._server = server;

    const svc = await this._server.getPrimaryService(PSFTP_SERVICE);

    // FB005C51: command channel — subscribe FIRST (SDK requires MTU notifications
    // enabled before any request/query will be accepted)
    this._cmd = await svc.getCharacteristic(PSFTP_CMD_CHAR);
    await this._cmd.startNotifications();
    this._cmd.addEventListener('characteristicvaluechanged', e => this._onCmdNotification(e));

    // FB005C52: unsolicited dev→host notifications — subscribe as SDK requires
    // (waitPsFtpClientReady checks both CCCDs are enabled)
    this._d2h = await svc.getCharacteristic(PSFTP_D2H_CHAR);
    await this._d2h.startNotifications();
    // We don't need to handle D2H events for offline recording — just subscribe.

    this._log('PSFTP channel ready');
    return this._device.name;
  }

  disconnect() {
    try { this._device?.gatt?.disconnect(); } catch {}
    this._device = null; this._server = null;
    this._cmd = null; this._d2h = null;
  }

  // -------------------------------------------------------------------------
  // Battery
  // -------------------------------------------------------------------------

  async readBattery() {
    try {
      const svc = await this._server.getPrimaryService(BATTERY_SERVICE);
      const chr = await svc.getCharacteristic(BATTERY_LEVEL_CHAR);
      const val = await chr.readValue();
      return val.getUint8(0);
    } catch { return null; }
  }

  // -------------------------------------------------------------------------
  // Recording control
  // -------------------------------------------------------------------------

  async requestRecordingStatus() {
    const resp = await this._sendCommand(buildRecordingStatusCmd());
    return parseRecordingStatus(Array.from(new Uint8Array(resp)));
  }

  async startRecording(exerciseId) {
    // H10 requires valid system time before startRecording (creates dated exercise files)
    await this._setLocalTime();

    let status;
    try { status = await this.requestRecordingStatus(); }
    catch { status = { recording: false, exerciseId: null }; }

    if (status.recording) {
      this._log('Active recording found — stopping first…');
      await this.stopRecording();
      await new Promise(r => setTimeout(r, 1500));
    }

    let exercises;
    try { exercises = await this.listExercises(); }
    catch { exercises = []; }

    if (exercises.length > 0) {
      const existing = exercises[0];
      const isSynced = await this._isSynced(existing);
      if (!isSynced) {
        throw new BlockerError('UNSYNCED_SESSION', 'UNSYNCED_SESSION', existing);
      }
      this._log(`Removing already-synced exercise "${existing}"…`);
      await this.removeExercise(existing);
    }

    this._log(`Starting recording: ${exerciseId}`);
    const startResp = await this._sendCommand(buildStartRecordingCmd(exerciseId));
    const startBytes = Array.from(new Uint8Array(startResp));
    const errorCode = startBytes[0] | ((startBytes[1] ?? 0) << 8);
    if (errorCode !== 0) {
      throw new Error(`H10 recording rejected. PFTP error ${errorCode}.`);
    }
    this._log('✓ Recording started');

    await db.sessions.add({
      startTime: Date.now(),
      mode: 'offline',
      synced: false,
      exerciseId,
      startUtc: new Date().toISOString(),
      deviceFingerprint: _deviceFingerprint(),
    });

    await new Promise(r => setTimeout(r, 1500));
    this.disconnect();
    return exerciseId;
  }

  async stopRecording() {
    const resp = await this._sendCommand(buildStopRecordingCmd());
    const bytes = Array.from(new Uint8Array(resp));
    return bytes[0] | ((bytes[1] ?? 0) << 8);
  }

  // -------------------------------------------------------------------------
  // Exercise listing & download
  // -------------------------------------------------------------------------

  async listExercises() {
    // H10 stores exercises at root level: /1/, /2/, etc.
    // GET / returns PbPFtpDirectory with all entries (DEVICE.BPB + exercise dirs)
    const resp = await this._sendCommand(_buildGetCmd('/'));
    const bytes = Array.from(new Uint8Array(resp));
    const dirs = [];
    let i = 0;
    while (i < bytes.length) {
      const tag = bytes[i++];
      if ((tag & 0x07) !== 2) { while (i < bytes.length && (bytes[i++] & 0x80)); continue; }
      const outerLen = bytes[i++];
      const outerEnd = i + outerLen;
      let name = '', size = 0;
      while (i < outerEnd) {
        const innerTag = bytes[i++];
        const innerField = innerTag >>> 3;
        if ((innerTag & 0x07) === 2) {
          const sLen = bytes[i++]; const sb = bytes.slice(i, i+sLen); i += sLen;
          if (innerField === 1) name = new TextDecoder().decode(Uint8Array.from(sb));
        } else if ((innerTag & 0x07) === 0) {
          let v = 0, sh = 0;
          while (i < outerEnd) { const b = bytes[i++]; v |= (b&0x7f)<<sh; if(!(b&0x80)) break; sh+=7; }
          if (innerField === 2) size = v;
        } else { i++; }
      }
      i = outerEnd;
      // Only numeric exercise dirs (1/, 2/, etc.), skip DEVICE.BPB and ERRORLOG.BPB
      if (name.endsWith('/') && /^\d+\/$/.test(name)) {
        dirs.push(name.replace(/\/$/, ''));
      }
    }
    return dirs;
  }

  async fetchExercise(exerciseId) {
    const dirPath = `/${exerciseId}/`;
    const dirResp = await this._sendCommand(_buildGetCmd(dirPath));
    const dirBytes = Array.from(new Uint8Array(dirResp));
    this._log(`Dir ${dirPath} response: ${dirBytes.length}b`);

    for (const filename of ['SAMPLES.BPB', 'RR.BIN', '00000000.BIN', 'SAMPLES.GZ', 'AUTO.BIN']) {
      const path = `${dirPath}${filename}`;
      try {
        const fileResp = await this._sendCommand(_buildGetCmd(path));
        const fileBytes = Array.from(new Uint8Array(fileResp));
        if (fileBytes.length > 4) {
          const rr = parseExerciseData(fileBytes);
          this._log(`Downloaded ${rr.length} RR values from ${filename}`);
          return rr;
        }
      } catch (e) {
        this._log(`${filename}: ${e.message}`);
      }
    }
    throw new Error(`No data file found in ${dirPath}`);
  }

  async removeExercise(exerciseId) {
    const dirPath = `/${exerciseId}/`;
    // H10 requires files removed before directory (REMOVE on non-empty dir → error 103)
    for (const fname of ['SAMPLES.BPB', 'RR.BIN', 'AUTO.BIN', '00000000.BIN', 'SAMPLES.GZ']) {
      try { await this._sendCommand(_buildRemoveCmd(`${dirPath}${fname}`)); } catch {}
    }
    // H10 auto-removes the directory when the last file is deleted.
    // REMOVE /dir/ → 103 ("not found") = already gone = OK.
    try { await this._sendCommand(_buildRemoveCmd(dirPath)); }
    catch (e) { if (!e.message.includes('103')) throw e; }
  }

  // -------------------------------------------------------------------------
  // Sync flow (entry point for UI)
  // -------------------------------------------------------------------------

  async sync(onStatus) {
    const log = msg => { this._log(msg); onStatus?.(msg); };

    log(t('sync.connecting'));
    await this.connect();
    log(tf('sync.connected', { name: this._device.name }));

    const battery = await this.readBattery();
    if (battery !== null) log(tf('sync.battery', { pct: battery }));

    log(t('sync.stopping'));
    try { await this.stopRecording(); await new Promise(r => setTimeout(r, 3000)); }
    catch (e) { this._log(`Stop warning: ${e.message}`); }

    let exercises = await this.listExercises();

    if (exercises.length === 0) {
      const pending = await db.sessions.where('mode').equals('offline').filter(s=>!s.synced).last();
      for (const id of [pending?.exerciseId, '1', '2', '00000001'].filter(Boolean)) {
        try {
          const resp = await this._sendCommand(buildFetchExerciseCmd(id));
          const bytes = Array.from(new Uint8Array(resp));
          if (bytes.length > 0) { exercises = [id]; break; }
        } catch {}
      }
    }

    if (exercises.length === 0) {
      this.disconnect();
      throw new Error(t('sync.no_session'));
    }

    const exerciseId = exercises[0];
    log(tf('sync.loading', { id: exerciseId }));
    const rrValues = await this.fetchExercise(exerciseId);

    if (rrValues.length < 10) {
      this.disconnect();
      throw new Error(tf('sync.too_few_rr', { count: rrValues.length }));
    }

    const pending = await db.sessions.where('mode').equals('offline').filter(s=>!s.synced).last();
    const startUtc = pending?.startUtc ? new Date(pending.startUtc).getTime() : Date.now();
    const rrWithTimestamps = _reconstructTimeline(rrValues, startUtc);
    const durationH = +(rrValues.reduce((a,b)=>a+b,0)/1000/3600).toFixed(2);
    log(tf('sync.rrcount', { count: rrValues.length, h: durationH }));

    log(t('sync.deleting'));
    await this.removeExercise(exerciseId);
    this.disconnect();

    if (pending) await db.sessions.update(pending.id, { synced: true, rrCount: rrValues.length });

    log(t('sync.done'));
    return { exerciseId, sessionId: pending?.id, rrValues, rrWithTimestamps, durationH };
  }

  // -------------------------------------------------------------------------
  // RFC76 send / receive — mirrors BlePsFtpClient request/query + readResponse
  // -------------------------------------------------------------------------

  async _sendCommand(payload) {
    if (!this._cmd) throw new Error('Not connected');

    const packets = rfc76Fragment(payload, 20);
    this._log(`TX (${packets.length} pkt): ${packets.map(p=>_hex(p)).join(' | ')}`);

    this._dataChunks = [];
    const responsePromise = new Promise((resolve, reject) => {
      this._responseResolve = resolve;
      this._responseReject  = reject;
      this._responseTimer   = setTimeout(() => {
        this._responseResolve = null; this._responseReject = null;
        reject(new Error(`PFTP timeout (${PFTP_TIMEOUT_MS}ms)`));
      }, PFTP_TIMEOUT_MS);
    });

    // SDK uses writeWithoutResponse for all packets by default
    for (const pkt of packets) {
      await this._cmd.writeValueWithoutResponse(pkt);
    }

    return responsePromise;
  }

  // Mirrors BlePsFtpClient.readResponse — reads from mtuInputQueue (=FB005C51 notifications)
  _onCmdNotification(event) {
    const raw = new Uint8Array(event.target.value.buffer);
    const h = parseRfc76Header(raw[0]);
    const payload = raw.slice(1);
    this._log(`RX 51: ${_hex(raw)} (status=${h.status} seq=${h.seq})`);

    switch (h.status) {
      case 3: // MORE — accumulate chunk
        this._dataChunks.push(Array.from(payload));
        break;

      case 1: { // LAST — final data chunk, response complete
        this._dataChunks.push(Array.from(payload));
        const combined = _flattenChunks(this._dataChunks);
        this._dataChunks = [];
        clearTimeout(this._responseTimer);
        this._responseResolve?.(combined.buffer);
        this._responseResolve = null; this._responseReject = null;
        break;
      }

      case 0: { // ERROR_OR_RESPONSE — LE uint16 error code in bytes 1-2
        const errorCode = (payload[0] ?? 0) | ((payload[1] ?? 0) << 8);
        clearTimeout(this._responseTimer);
        if (errorCode === 0) {
          // Success — return any accumulated data (may be empty for simple ACKs)
          const combined = _flattenChunks(this._dataChunks);
          this._dataChunks = [];
          this._responseResolve?.(combined.buffer);
        } else {
          this._dataChunks = [];
          this._responseReject?.(new Error(`PFTP error ${errorCode}`));
        }
        this._responseResolve = null; this._responseReject = null;
        break;
      }
    }
  }

  async _setLocalTime() {
    // QUERY 3 = SET_LOCAL_TIME — H10 needs valid timestamp before startRecording
    // PbPFtpSetLocalTimeParams { date(1), time(2), tz_offset_minutes(3) }
    // PbDate { year(1), month(2), day(3) }, PbTime { hour(1), minute(2), seconds(3), millis(4) }
    const now = new Date();
    const encV = (f, v) => { const out = []; let n = v; while (n > 0x7f) { out.push((n & 0x7f) | 0x80); n >>>= 7; } out.push(n & 0x7f); return [(f << 3), ...out]; };
    const encLen = (f, b) => [(f << 3) | 2, b.length, ...b];
    const dateBytes = [...encV(1, now.getFullYear()), ...encV(2, now.getMonth()+1), ...encV(3, now.getDate())];
    const timeBytes = [...encV(1, now.getHours()), ...encV(2, now.getMinutes()), ...encV(3, now.getSeconds())];
    const tzMin = -now.getTimezoneOffset();
    const tzBytes = tzMin !== 0 ? [...encV(3, tzMin)] : [];
    const params = [...encLen(1, dateBytes), ...encLen(2, timeBytes), ...tzBytes];
    const cmd = new Uint8Array([0x03, 0x80, ...params]);
    try {
      await this._sendCommand(cmd);
      this._log(`SET_LOCAL_TIME OK (${now.toLocaleString()})`);
    } catch (e) {
      this._log(`SET_LOCAL_TIME warning: ${e.message}`);
    }
  }

  async _isSynced(exerciseId) {
    const s = await db.sessions.where('exerciseId').equals(exerciseId).filter(s=>s.synced).first();
    return !!s;
  }

  _log(msg) { console.log(`[PFTP] ${msg}`); }
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function _hex(bytes) {
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join(' ');
}

function _flattenChunks(chunks) {
  const total = chunks.reduce((s,c)=>s+c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

function _buildGetCmd(path) {
  const pathBytes = new TextEncoder().encode(path);
  const proto = new Uint8Array([0x08, 0x00, 0x12, pathBytes.length, ...pathBytes]);
  return new Uint8Array([proto.length & 0xFF, (proto.length >> 8) & 0x7F, ...proto]);
}

function _buildRemoveCmd(path) {
  const pathBytes = new TextEncoder().encode(path);
  const proto = new Uint8Array([0x08, 0x03, 0x12, pathBytes.length, ...pathBytes]);
  return new Uint8Array([proto.length & 0xFF, (proto.length >> 8) & 0x7F, ...proto]);
}

function _deviceFingerprint() {
  return `${navigator.userAgent}|${navigator.platform}`;
}

function _reconstructTimeline(rrValues, startUtcMs) {
  let t = startUtcMs;
  return rrValues.map(rr => { const ts = t; t += rr; return { timestamp: ts, rrMs: rr }; });
}

// -------------------------------------------------------------------------
// BlockerError
// -------------------------------------------------------------------------

export class BlockerError extends Error {
  constructor(message, code, exerciseId = null) {
    super(message);
    this.name = 'BlockerError';
    this.code = code;
    this.exerciseId = exerciseId;
  }
}
