/**
 * Live BLE streaming via standard HR service (GATT 0x180D / 0x2A37).
 * H10 embeds RR intervals in HR notifications (1/1024 s resolution).
 *
 * HR characteristic 0x2A37 packet layout:
 *   Byte 0:     flags
 *     bit 0:    HR format  (0=UINT8, 1=UINT16)
 *     bit 1-2:  sensor contact
 *     bit 3:    energy expended present
 *     bit 4:    RR intervals present
 *   Byte 1[–2]: HR value
 *   [2 bytes]:  energy expended (if present)
 *   [n×2 bytes]: RR values in 1/1024 s (if present)
 */
export class LiveSession {
  constructor() {
    this._device = null;
    this._server = null;
    this._hrChar = null;
    this.onDisconnect = null;
  }

  async connect() {
    this._device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Polar H10' }],
      optionalServices: [0x180D, 0x180F],
    });
    this._device.addEventListener('gattserverdisconnected', () => {
      this.onDisconnect?.();
    });
    this._server = await this._device.gatt.connect();
    return this._device.name;
  }

  async startStreaming(onRR) {
    const hrSvc = await this._server.getPrimaryService(0x180D);
    this._hrChar = await hrSvc.getCharacteristic(0x2A37);

    this._hrChar.addEventListener('characteristicvaluechanged', (evt) => {
      const dv = evt.target.value;
      const flags = dv.getUint8(0);
      const hr16 = flags & 0x01;
      const eePresent = (flags >> 3) & 0x01;
      const rrPresent = (flags >> 4) & 0x01;

      let off = 1;
      const hr = hr16 ? dv.getUint16(off, true) : dv.getUint8(off);
      off += hr16 ? 2 : 1;
      if (eePresent) off += 2;

      if (rrPresent) {
        while (off + 1 < dv.byteLength) {
          const raw = dv.getUint16(off, true);
          off += 2;
          const ms = Math.round(raw * 1000 / 1024);
          if (ms > 200 && ms < 3000) onRR(ms, hr);
        }
      }
    });

    await this._hrChar.startNotifications();
  }

  get connected() {
    return this._server?.connected ?? false;
  }

  disconnect() {
    try { this._device?.gatt?.disconnect(); } catch {}
  }
}
