# HRV-APP — Polar H10 PFTP Debugging Log

Letzter Stand: 2026-06-05  
Ziel: Polar H10 Offline-Aufzeichnung (RR-Intervalle) via Web Bluetooth + PFTP

---

## Was das Projekt tut

Web-App (Vite 5 + Vanilla JS) die über Web Bluetooth:
1. Eine Aufzeichnung auf dem Polar H10 startet (`PUT /R/` via PFTP)
2. Der H10 zeichnet autonom RR-Intervalle auf (kein Bluetooth nötig)
3. Nach dem Tragen: Daten via PFTP herunterlädt und HRV-Metriken berechnet

Hauptdateien:
- `src/ble/session_sync.js` — PFTP-Protokoll, RFC-76-Framing, Sync-Logik
- `src/ble/polar_pmd.js` — Proto-Encoder, Command-Builder, Response-Parser
- `src/main.js` — UI-Handler, Diagnostic-Tests
- `index.html` — UI mit Buttons für alle Tests

Dev-Server: `npm run dev` → `http://localhost:5174/hrv-app/`

---

## Protokoll-Grundlagen (verifiziert)

### BLE-Charakteristiken auf dem H10
Service: `FB005C80-02E7-F387-1CAD-8ACD2D8DF0C8`
- `FB005C81` — write + indicate — PFTP-Befehle schreiben, Antworten empfangen
- `FB005C82` — notify — PMD-Streaming (ECG/ACC), bisher nie genutzt

### RFC-76-Framing
- Jedes BLE-Paket hat 1 Header-Byte: `[seq:4bit | bit4:isLast | ...]`
- `bit4 = 1` → letztes Paket; `bit4 = 0` → mehr folgen
- Max 20 Bytes pro Paket (BLE 4.x MTU)
- Bei längeren Befehlen: mehrere Pakete mit aufsteigendem seq

### PFTP-Proto-Encoding (PbPFSRequest)
```
field 1 (string path):  0a [len] [utf8-bytes]
field 2 (op varint):    10 [value]   (1=PUT, 2=DELETE, fehlt=GET)
field 3 (bytes data):   1a [len] [payload-bytes]
```

### PbRecordingRequest (payload für PUT /R/)
```
field 1 (exerciseId string):   0a [len] [utf8-bytes]
field 2 (PbDuration embedded): 12 [len] 08 [seconds-varint]
field 3 (sampleType varint):   18 [value]  (3=RR_INTERVAL)
```

**Wichtig:** `recordingInterval` ist ein eingebettetes Proto-Message (`PbDuration`), KEIN Varint direkt.
Falsches Encoding: `10 01` (Varint)  
Richtiges Encoding: `12 02 08 01` (LEN-Wire, PbDuration{seconds:1})

---

## Was FUNKTIONIERT ✓

1. **BLE-Verbindung** — H10 verbindet zuverlässig
2. **RFC-76-Framing** — TX/RX korrekt, Pakete kommen an
3. **Notifications** — H10 antwortet auf jeden Befehl
4. **GATT-Race-Fix** — `writeValueWithResponse` sequentiell abgewartet, kein "operation already in progress"
5. **Transport-ACK-Fix** — H10 schickt 1 Notification pro TX-Paket; 2-Paket-Befehle erzeugten 2 Notifications, zweite vergiftete nächsten Befehl → `_awaitedAcks`-Counter wartet auf alle ACKs, nutzt erste als Antwort, verwirft Rest

---

## Was NICHT FUNKTIONIERT ✗

### `startRecording` startet keine Aufzeichnung

**Alle PFTP-Antworten sind 3 Bytes:**
```
GET /  → [xx 0a 01]  — immer "leer/nicht gefunden"
GET /E/ → [xx 0a 01]  — leer
GET /R/ → [xx 0a 01]  — kein aktives Recording
PUT /R/ (startRecording) → [xx 0a 02]  — einzige Antwort die sich unterscheidet
DELETE /R/ (stopRecording) → [xx 0a 01]  — wie GET, nichts zu stoppen
```

**Beobachtung:**
- `PUT /R/` liefert konsistent `0a 02` (anderer letzter Byte als `0a 01`)
- Aber: `/R/` bleibt nach dem Start `0a 01` (kein aktives Recording erkennbar)
- `/E/` bleibt nach Stop leer — keine Exercise-Datei angelegt
- `stopRecording` liefert `0a 01` (wie "nichts da") — bestätigt, nie etwas aufgenommen

**Beweis dass BLE-Disconnect NICHT das Problem ist:**  
Verbundener Test (BLE 30s offen lassen): Gleiches Ergebnis. `/E/` bleibt leer.

---

## Aktuelle Hypothesen (offen)

### Hypothese A: Falsche Bedeutung von `0a 01` / `0a 02`

Mögliche Proto-Error-Code-Bedeutungen:
- `0x01` = `PB_PFS_NOT_FOUND` → alle Pfade existieren nicht
- `0x02` = `PB_PFS_ILLEGAL_ACCESS` → PUT /R/ wird abgewiesen!

Unter dieser Interpretation: `startRecording` schlägt immer fehl (0x02 = Fehler, nicht Erfolg).

### Hypothese B: FB005C81 ist nur PMD-CP, PFTP auf anderen Characteristic

Polar H10 könnte PFTP auf einer anderen Characteristic haben:
- Service `0xFEEE` mit Char `0xFEED` für PFTP
- Oder ein anderer Service den wir nicht in `optionalServices` anfordern

**Test dafür:** "PMD Direkttest"-Button in der App  
→ Sendet `0x01 0x00` (raw PMD REQUEST ohne RFC-76) an FB005C81  
→ Wenn Antwort mit `0xF0` beginnt → echter PMD-Response → FB005C81 = PMD CP (kein PFTP)  
→ Wenn Antwort `0a 01` → kein echter PMD-CP-Handler

### Hypothese C: Falscher sampleType

`sampleType = 3` ist als `RR_INTERVAL` dokumentiert, aber vielleicht:
- H10 braucht `sampleType = 1` oder `sampleType = 9` für PPI
- Ohne korrekten sampleType wird Recording silently abgelehnt

### Hypothese D: H10 braucht aktive HR-Messung vor Aufzeichnung

Theoretisch möglich: H10 startet keine Offline-Aufzeichnung ohne aktive Elektroden-Erkennung.  
**Gegenargument:** User trägt H10 korrekt, Elite HRV streamt live problemlos.

---

## Nächste Schritte (Priorität)

### 1. PMD Direkttest ausführen (HÖCHSTE PRIORITÄT)
Button "PMD Direkttest" in der App klicken.  
Interpretation der Antwort:
- `f0 01 00 00 ...` (lang, beginnt mit `f0`) → PMD CP funktioniert → FB005C81 korrekt für PMD
- `0a 01` (3 Bytes) → FB005C81 antwortet nicht als PMD CP

### 2. Je nach PMD-Test-Ergebnis

**Wenn PMD CP funktioniert (0xF0-Antwort):**
- PFTP läuft wahrscheinlich auf FB005C81 korrekt
- Nächster Test: `sampleType = 1` statt 3 in `buildStartRecordingCmd`
- Test: Minimaler PUT /R/ ohne Payload (nur path + op)
- Test: exerciseId als Zahl `"1"` statt "TEST0001"

**Wenn PMD CP NICHT antwortet (0a 01):**
- FB005C81 wird falsch genutzt ODER ist ausschließlich PFTP
- Andere Services am H10 scannen: Web Bluetooth `requestDevice` mit breiteren `optionalServices`
- Prüfen ob Service `0xFEEE` oder anderer PFTP-Service existiert

### 3. Alternative: Polar Flow App BLE-Traffic capturen
Mit nRF Sniffer oder ähnlichem aufzeichnen was die offizielle Polar Flow App sendet.
Das würde die korrekten Bytes zeigen.

---

## Aktuelle Bugs / Offene TODOs

| Status | Issue |
|--------|-------|
| ✓ FIXED | GATT race: "operation already in progress" nach 1. Probe |
| ✓ FIXED | DB `.first()` lieferte falsche (älteste) Session statt neueste |
| ✓ FIXED | `recordingInterval` als Varint statt PbDuration encoded |
| ✓ FIXED | Late-ACK: 2. Notification von 2-Paket-Befehlen vergiftete nächsten Command |
| ✗ OPEN | `startRecording` startet keine Aufzeichnung (Kern-Problem) |
| ✗ OPEN | `parseExerciseData` Endianness unbekannt (noch kein Datei-Response erhalten) |
| ✗ OPEN | Richtige `sampleType`-Werte für H10 unbekannt |

---

## Wichtige Code-Stellen

| Was | Datei | Zeile |
|-----|-------|-------|
| RFC-76 Fragmentierung | session_sync.js | `_sendCommand()` ~L452 |
| Transport-ACK-Fix | session_sync.js | `_onNotification()` ~L502 |
| startRecording Proto-Encoding | polar_pmd.js | `buildStartRecordingCmd()` ~L77 |
| PMD Direkttest | main.js | `pmdDirectTest()` ~L246 |
| Verbundener Aufzeichnungstest | main.js | `connectedRecordingTest()` ~L326 |

---

## Kontext: Was dieses Projekt NICHT hat

- Kein echter HRV-Flow funktioniert noch — solange `startRecording` kaputt ist, ist alles downstream (Sync, RR-Parsing, Metriken) ungetestet
- Die Mock-Session und Dashboard-UI funktionieren komplett (unabhängig von BLE)
- Das Offline-Tab hat 5 Diagnose-Buttons: Kanaltest, Verbundener Test, PMD Direkttest, Aufzeichnung starten, Synchronisieren
