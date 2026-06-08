# H10 Troubleshooting

Collected insights from protocol analysis and practical testing (Firmware 4.2.0).

---

## H10 Settings in Polar Flow

The H10 has few but important settings, accessible only through the **Polar Flow app** (iOS/Android) — not through Polar Beat or the measurement app.

### Allow Two BLE Connections

By default, the H10 only allows **one** BLE connection at a time. If connected to Polar Flow, it rejects all further connection attempts.

**Enable the setting:**
> Polar Flow App → Select H10 → ⚙️ Settings → **Connections** → "Allow two connections" → **ON**

Relevance:
- **Polar Flow App** and **Polar Beat App** each count as one separate BLE connection
- With "Two" enabled, the measurement app can connect while Flow runs in the background
- After a BLE reset (re-wearing H10), the setting reverts to "One" — check after each re-pairing

### Factory Reset

Deletes **all stored sessions** and resets all settings. The **firmware remains unchanged**.

> Polar Flow App → H10 → ⚙️ Settings → **Reset device** → Confirm

⚠️ **After reset: BLE pairing in Windows/macOS/Android is removed.** Re-pairing required (see below).

When necessary:
- H10 shows `OPERATION_NOT_PERMITTED` (error 106) when starting a new recording — a corrupt directory entry permanently blocks the H10 until reset
- H10 no longer responds to connection attempts
- Extreme case: soft reset (restart via BLE command) hasn't helped

---

## Windows Bluetooth Pairing

For **offline recording** (PSFTP protocol), the H10 requires a full OS pairing with bonding — a simple Web Bluetooth connection is not sufficient.

### Initial Pairing

1. Wear H10 (LED blinks once green)
2. Windows: **Settings → Bluetooth & devices → Add device → Bluetooth**
3. Select "Polar H10 XXXXXXXX" → **Pair**
4. Confirm pairing — no PIN required
5. H10 appears permanently in the device list

### Re-pair after Factory Reset

The H10 "forgets" all paired devices on reset. Windows keeps the old entry — this causes GATT connection errors.

1. Windows: Settings → Bluetooth → **remove old H10 entry** (… → Remove device)
2. Remove and briefly wait (LED goes off)
3. Re-wear H10 (LED blinks)
4. Start new pairing process (same as initial pairing)
5. Then open Polar Flow app → connect H10 → check settings

---

## Polar Flow App — Avoiding Conflicts

The Polar Flow app communicates via the same GATT service (0xFEEE) as the measurement app. Both simultaneously → GATT collision → timeouts or disconnections.

| Situation | Behavior |
|---|---|
| Flow app in foreground | Flow holds GATT handle → measurement app cannot connect |
| Flow app in background (iOS) | iOS freezes app → usually no conflict, but uncertain |
| Flow app in background (Android) | Android allows background BLE → conflict possible |
| Flow app completely closed | No conflict ✓ |

**Recommendation:** Before every offline recording and every sync, **completely close** the Polar Flow app (don't just minimize it).

---

## Known Error Codes

| Code | Name | Meaning | Solution |
|---|---|---|---|
| 103 on GET | NO_SUCH_FILE | Path not found | Normal for `GET /E/` — H10 uses root level `/1/` |
| 103 on REMOVE /dir/ | NO_SUCH_FILE | Directory already auto-deleted | **Not an error!** H10 removes directory automatically when last file is deleted |
| 106 | OPERATION_NOT_PERMITTED | Zombie directory blocks new start | Factory reset |
| Timeout | — | No response to command | Close Polar Flow, re-wear H10, reconnect |

---

## Zombie State (Error 106)

The most common showstopper during development and testing.

**What happens:**
The H10 creates directory entry `/1/` immediately on `startRecording` — before any RR data is written to flash. If the recording is stopped within the first ~2 minutes, the directory remains empty and corrupt. A later `REMOVE /1/` fails with 103, even though `GET /` shows the directory in the listing. All new `startRecording` attempts fail with 106.

**⚠️ Important — Difference from normal REMOVE-103:**

| Situation | `GET /1/` | `REMOVE /1/` → 103 | Cause |
|---|---|---|---|
| **Zombie** | → 103 (directory broken) | Error, unsolvable | Corrupt flash entry |
| **Normal (auto-remove)** | → 18b (files visible) | OK = already gone | Last file deleted → dir auto-removed |

**Zombie detection (correct):**
```
GET /1/ → errorCode=103  ← directory in listing, but not readable
startRecording → errorCode=106
```
If `GET /1/` returns filenames (≥ 18 bytes), `/1/` is NOT a zombie — follow normal REMOVE sequence.

**Solution:** Only factory reset. Soft reset via BLE doesn't help — the flash filesystem remains unchanged.

**In production use this NEVER occurs:** A 24h recording writes data continuously to flash. The directory never stays empty.

---

## H10 Filesystem

Structure on an H10 with firmware 4.2.0:

```
/
├── DEVICE.BPB       (127 bytes — device configuration)
└── 1/               (exercise directory, created on startRecording)
    └── SAMPLES.BPB  (RR data, ~2 bytes/beat × number of beats)
```

- Exercises are stored **directly in root** (`/1/`), **not** under `/E/` (older SDK assumption)
- `SAMPLES.BPB` is a protobuf file: field 28 → field 1 → packed varints = RR intervals in ms
- Example: `d4 07` → varint decode = 980 ms = 61 bpm ✓

---

## LED Blink Codes

| Pattern | Meaning |
|---|---|
| 1× green (when worn) | H10 active, transmitting HR |
| 1× green per minute | Offline recording running autonomously |
| Green + orange alternating | Firmware update in progress — do not interrupt! |
| 1× red (when worn) | Battery almost empty |

---

## Typical Production Sequence

```
1. Close Polar Flow
2. Wear H10 → LED blinks
3. App: "Start Recording" → BLE connects
4. SET_LOCAL_TIME → startRecording → BLE disconnects
5. H10 records autonomously (1×/min green blink)
6. [24 hours later]
7. App: "Record" tab → "Stop & Save Recording" → BLE connects
8. stopRecording → download SAMPLES.BPB → REMOVE /1/
9. BLE disconnects
```

Step 8 (REMOVE) is critical: only delete after successful download, otherwise data is lost.

---

## Quick Fixes at a Glance

| Problem | Quick Fix |
|---|---|
| startRecording → 106 | Factory Reset → re-pair Windows |
| Connection fails / timeout | Close Polar Flow, remove and re-wear H10 |
| Device not in BLE dialog | Toggle Windows Bluetooth off/on, re-wear H10 |
| "Bonding failed" / pairing error | Remove old BT entry in Windows, re-pair |
| Need two apps simultaneously | In Polar Flow: Settings → enable 2 BLE connections |
| Polar Flow cannot connect after app use | Check 2-connections setting / re-wear H10 |
