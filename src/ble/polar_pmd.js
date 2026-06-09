/**
 * Polar H10 — BLE service UUIDs and command builders.
 *
 * Architecture (corrected via polar-ble-sdk source analysis):
 *
 *  PMD Service (FB005C80):
 *    FB005C81  write+indicate  — PMD Control Point: ECG/ACC streaming only
 *    FB005C82  notify          — PMD Data stream
 *
 *  PSFTP Service (0000FEEE):         ← THIS is for file transfer & recording
 *    FB005C51  notify          — MTU negotiation notifications
 *    FB005C52  notify          — Device→Host (D2H) responses
 *    FB005C53  write           — Host→Device (H2D) commands
 *
 * Wire format: RFC60 header (2-byte LE length/query-id) + proto bytes,
 * fragmented into RFC76 air packets (seq<<4 | status_bits | next_bit).
 */

// PMD Service (ECG/ACC streaming only — NOT for recording)
export const POLAR_PMD_SERVICE      = 'fb005c80-02e7-f387-1cad-8acd2d8df0c8';
export const PMD_CP_CHAR            = 'fb005c81-02e7-f387-1cad-8acd2d8df0c8';
export const PMD_DATA_CHAR          = 'fb005c82-02e7-f387-1cad-8acd2d8df0c8';

// PSFTP Service (file transfer & offline recording) — 16-bit UUID 0xFEEE (Polar Electro Oy)
//
// Verified from polar-ble-sdk BlePsFtpClient.kt (transmitMessages + readResponse):
//   FB005C51 (SDK: RFC77_PFTP_MTU_CHARACTERISTIC)
//     → write commands here (request/query/write)
//     → subscribe for notifications: ALL command responses come back here
//   FB005C52 (SDK: RFC77_PFTP_D2H_CHARACTERISTIC)
//     → subscribe only: unsolicited device→host notifications (workout events etc.)
//     → NOT used for command responses
//   FB005C53 (SDK: RFC77_PFTP_H2D_CHARACTERISTIC)
//     → write only: unsolicited host→device notifications (sendNotification)
//     → NOT for regular commands
export const PSFTP_SERVICE          = '0000feee-0000-1000-8000-00805f9b34fb';
export const PSFTP_CMD_CHAR         = 'fb005c51-02e7-f387-1cad-8acd2d8df0c8'; // write+notify: commands & responses
export const PSFTP_D2H_CHAR         = 'fb005c52-02e7-f387-1cad-8acd2d8df0c8'; // notify: unsolicited dev→host
export const PSFTP_H2D_NOTIFY_CHAR  = 'fb005c53-02e7-f387-1cad-8acd2d8df0c8'; // write: unsolicited host→dev

// HR service (standard BLE 0x180D) — RR intervals live streaming
export const HR_SERVICE             = 0x180D;
export const HR_MEASUREMENT_CHAR    = 0x2A37;

// Battery service
export const BATTERY_SERVICE        = 0x180F;
export const BATTERY_LEVEL_CHAR     = 0x2A19;

// Device Information Service
export const DIS_SERVICE            = 0x180A;

// --------------------------------------------------------------------------
// PbPFtpOperation.Command enum (proto field 1 in PbPFtpOperation)
// --------------------------------------------------------------------------
const CMD_GET    = 0;
const CMD_PUT    = 1;
const CMD_MERGE  = 2;
const CMD_REMOVE = 3;

// --------------------------------------------------------------------------
// PbPFtpQuery enum — query IDs for device commands (not file ops)
// --------------------------------------------------------------------------
const QUERY_REQUEST_START_RECORDING  = 14;
const QUERY_REQUEST_STOP_RECORDING   = 15;
const QUERY_REQUEST_RECORDING_STATUS = 16;

// --------------------------------------------------------------------------
// PbSampleType enum (for PbPFtpRequestStartRecordingParams.sample_type)
// --------------------------------------------------------------------------
// PbSampleType enum values (from polar-ble-sdk types.proto)
export const SAMPLE_TYPE = {
  HEART_RATE:  1,
  RR_INTERVAL: 16,  // SAMPLE_TYPE_RR_INTERVAL = 16 (NOT 3!)
};

// --------------------------------------------------------------------------
// Minimal protobuf encoder
// --------------------------------------------------------------------------

function encodeVarint(value) {
  const bytes = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return bytes;
}

function protoString(fieldNum, str) {
  const encoded = new TextEncoder().encode(str);
  return [(fieldNum << 3) | 2, encoded.length, ...encoded];
}

function protoVarint(fieldNum, value) {
  return [(fieldNum << 3) | 0, ...encodeVarint(value)];
}

function protoLen(fieldNum, bytes) {
  return [(fieldNum << 3) | 2, bytes.length, ...bytes];
}

export function protoStringBytes(fieldNum, str) { return protoString(fieldNum, str); }

// --------------------------------------------------------------------------
// RFC60 message framing
//
// REQUEST (file op): [proto_len_LSB, proto_len_MSB (no MSB set)] [proto_bytes]
// QUERY (device cmd): [query_id_LSB, (query_id_MSB | 0x80)] [params_bytes...]
// --------------------------------------------------------------------------

function rfc60Request(protoBytes) {
  const len = protoBytes.length;
  return new Uint8Array([len & 0xFF, (len >> 8) & 0x7F, ...protoBytes]);
}

function rfc60Query(queryId, paramsBytes = []) {
  return new Uint8Array([queryId & 0xFF, ((queryId >> 8) & 0x7F) | 0x80, ...paramsBytes]);
}

// --------------------------------------------------------------------------
// PbPFtpOperation proto builder (for file ops: GET, PUT, REMOVE)
// command = field 1 (VARINT), path = field 2 (string)
// --------------------------------------------------------------------------

function pbPFtpOperation(command, path) {
  return Uint8Array.from([
    ...protoVarint(1, command),
    ...protoString(2, path),
  ]);
}

// --------------------------------------------------------------------------
// Command builders — return full RFC60-wrapped payloads (ready for RFC76 fragmentation)
// --------------------------------------------------------------------------

/**
 * Start recording: QUERY id=14
 * PbPFtpRequestStartRecordingParams { sample_type(1), recording_interval(2), sample_data_identifier(3) }
 */
// PbDuration { hours=f1, minutes=f2, seconds=f3, millis=f4 }
function pbDuration(hours = 0, minutes = 0, seconds = 0) {
  const bytes = [];
  if (hours   > 0) bytes.push(...protoVarint(1, hours));
  if (minutes > 0) bytes.push(...protoVarint(2, minutes));
  if (seconds > 0) bytes.push(...protoVarint(3, seconds));
  return bytes;
}

// recording_interval = sample cadence in seconds (1 or 5), NOT total duration.
// For RR_INTERVAL the interval has no effect on data (event-driven), but must be a valid value.
export function buildStartRecordingCmd(identifier = '1', sampleType = SAMPLE_TYPE.RR_INTERVAL, intervalSeconds = 1) {
  const durationBytes = pbDuration(0, 0, intervalSeconds);
  const params = [
    ...protoVarint(1, sampleType),
    ...protoLen(2, durationBytes),
    ...(identifier ? protoString(3, identifier) : []),
  ];
  return rfc60Query(QUERY_REQUEST_START_RECORDING, params);
}

/**
 * Stop recording: QUERY id=15 (no params)
 */
export function buildStopRecordingCmd() {
  return rfc60Query(QUERY_REQUEST_STOP_RECORDING);
}

/**
 * Recording status: QUERY id=16 (no params)
 */
export function buildRecordingStatusCmd() {
  return rfc60Query(QUERY_REQUEST_RECORDING_STATUS);
}

/**
 * List exercises: REQUEST GET /E/
 */
export function buildListExercisesCmd() {
  return rfc60Request(pbPFtpOperation(CMD_GET, '/E/'));
}

/**
 * Fetch exercise directory: REQUEST GET /E/<id>/
 */
export function buildFetchExerciseCmd(exerciseId) {
  return rfc60Request(pbPFtpOperation(CMD_GET, `/E/${exerciseId}/`));
}

/**
 * Remove exercise: REQUEST REMOVE /E/<id>/
 */
export function buildRemoveExerciseCmd(exerciseId) {
  return rfc60Request(pbPFtpOperation(CMD_REMOVE, `/E/${exerciseId}/`));
}

// --------------------------------------------------------------------------
// RFC76 framing (Polar RFC77 convention)
//
// Header byte: (seq & 0x0F) << 4 | status_bits | next_bit
//   status 0x06 = MORE  (bits 2-1 = 0b11)
//   status 0x02 = LAST  (bits 2-1 = 0b01)
//   next = 0 for first packet of a message, 1 for continuations
//
// Response parsing:
//   header.status = (byte0 >> 1) & 0x03
//   header.seq    = (byte0 >> 4) & 0x0F
//   status==0: error code LE uint16 in bytes 1-2
//   status!=0: payload bytes start at byte 1
// --------------------------------------------------------------------------

export const RFC76_STATUS_MORE     = 0x06; // bits 2-1 = 0b11
export const RFC76_STATUS_LAST     = 0x02; // bits 2-1 = 0b01
export const RFC76_STATUS_RESPONSE = 0x00; // bits 2-1 = 0b00

export function rfc76Fragment(payload, mtu = 20) {
  const packets = [];
  let offset = 0;
  let next = 0;
  let seq = 0;
  while (offset < payload.length) {
    const remaining = payload.length - offset;
    const chunkSize = Math.min(mtu - 1, remaining);
    const isLast = offset + chunkSize >= payload.length;
    const statusBits = isLast ? RFC76_STATUS_LAST : RFC76_STATUS_MORE;
    const header = ((seq & 0x0F) << 4) | statusBits | next;
    const pkt = new Uint8Array(1 + chunkSize);
    pkt[0] = header;
    pkt.set(payload.slice(offset, offset + chunkSize), 1);
    packets.push(pkt);
    offset += chunkSize;
    next = 1;
    seq = (seq + 1) & 0x0F;
  }
  return packets;
}

export function parseRfc76Header(byte0) {
  return {
    next:   byte0 & 0x01,
    status: (byte0 >> 1) & 0x03,
    seq:    (byte0 >> 4) & 0x0F,
    isMore: ((byte0 >> 1) & 0x03) === 3, // status=0b11=MORE
    isLast: ((byte0 >> 1) & 0x03) === 1, // status=0b01=LAST
    isResponse: ((byte0 >> 1) & 0x03) === 0, // status=0b00=RESPONSE
  };
}

// --------------------------------------------------------------------------
// Response parsers
// --------------------------------------------------------------------------

export function parseRecordingStatus(bytes) {
  if (bytes.length === 0) return { recording: false, exerciseId: null };
  // QUERY response format: payload bytes after status=0 response termination
  // For now, if we get any response data, parse as proto
  if (bytes.length <= 2) return { recording: false, exerciseId: null };

  let recording = false, exerciseId = null, i = 0;
  while (i < bytes.length) {
    const tag = bytes[i++];
    const fieldNum = tag >>> 3, wireType = tag & 0x07;
    if (wireType === 0) {
      let val = 0, shift = 0;
      while (i < bytes.length) { const b = bytes[i++]; val |= (b & 0x7f) << shift; if (!(b & 0x80)) break; shift += 7; }
      if (fieldNum === 1) recording = val !== 0;
    } else if (wireType === 2) {
      const len = bytes[i++] ?? 0;
      const sb = bytes.slice(i, i + len); i += len;
      if (fieldNum === 2) exerciseId = new TextDecoder().decode(Uint8Array.from(sb));
    } else { i++; }
  }
  return { recording, exerciseId };
}

export function parseExerciseList(bytes) {
  console.log(`[PFTP] parseExerciseList raw (${bytes.length}b): [${Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`);
  if (bytes.length <= 2) return [];
  const entries = [];
  let i = 0;
  while (i < bytes.length) {
    const tag = bytes[i++];
    const fieldNum = tag >>> 3, wireType = tag & 0x07;
    if (wireType === 2 && i < bytes.length) {
      const len = bytes[i++];
      if (i + len > bytes.length) break;
      const str = new TextDecoder().decode(new Uint8Array(bytes.slice(i, i + len)));
      i += len;
      if (fieldNum === 1) {
        const clean = str.replace(/^\/E\/|\/$/g, '').replace(/\//g, '');
        if (clean) entries.push(clean);
      }
    } else if (wireType === 0) {
      while (i < bytes.length && (bytes[i++] & 0x80));
    } else { i++; }
  }
  return entries;
}

// Parse SAMPLES.BPB: outer proto → field 28 (repeated) → field 1 → packed varint RR in ms.
// Collects from ALL field-28 blocks (long recordings have multiple).
function _parseSamplesBpbRR(bytes) {
  const readVarint = (arr, pos) => {
    let val = 0, shift = 0;
    while (pos < arr.length) { const b = arr[pos++]; val |= (b & 0x7f) << shift; if (!(b & 0x80)) break; shift += 7; }
    return { val, pos };
  };
  const allRR = [];
  let i = 0;
  while (i < bytes.length) {
    let { val: tag, pos: i2 } = readVarint(bytes, i); i = i2;
    const fieldNum = tag >>> 3, wire = tag & 7;
    if (wire === 2) {
      let { val: len, pos: i3 } = readVarint(bytes, i); i = i3;
      if (fieldNum === 28 && len > 0) {
        const innerEnd = i + len;
        while (i < innerEnd) {
          let { val: itag, pos: i4 } = readVarint(bytes, i); i = i4;
          const iField = itag >>> 3, iWire = itag & 7;
          if (iWire === 2) {
            let { val: dLen, pos: i5 } = readVarint(bytes, i); i = i5;
            if (iField === 1 && dLen > 0) {
              const dataEnd = i + dLen;
              while (i < dataEnd) {
                let { val: v, pos: i6 } = readVarint(bytes, i); i = i6;
                if (v >= 300 && v <= 2500) allRR.push(v);
              }
            } else { i += dLen; }
          } else if (iWire === 0) { let { pos: ip } = readVarint(bytes, i); i = ip; }
          else { i++; }
        }
        i = innerEnd;
      } else { i += len; }
    } else if (wire === 0) { let { pos: ip } = readVarint(bytes, i); i = ip; }
    else { i++; }
  }
  return allRR;
}

export function parseExerciseData(bytes) {
  const arr = Array.isArray(bytes) ? bytes : Array.from(bytes);
  // Try SAMPLES.BPB proto format first (field 28 packed varint RR in ms)
  const fromProto = _parseSamplesBpbRR(arr);
  if (fromProto.length > 0) return fromProto;
  // Fallback: raw uint16 little-endian
  const out = [];
  for (let i = 0; i + 1 < arr.length; i += 2) {
    const v = arr[i] | (arr[i+1] << 8);
    if (v >= 300 && v <= 2500) out.push(v);
  }
  return out;
}
