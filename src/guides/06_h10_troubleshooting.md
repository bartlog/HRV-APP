# H10 Troubleshooting

Gesammelte Erkenntnisse aus der Protokoll-Analyse und Praxis-Tests (Firmware 4.2.0).

---

## H10-Einstellungen in Polar Flow

Der H10 hat wenige, aber wichtige Einstellungen, die ausschließlich über die **Polar Flow App** (iOS/Android) zugänglich sind — nicht über Polar Beat oder die Messdaten-App.

### Zwei BLE-Verbindungen erlauben

Standardmäßig erlaubt der H10 nur **eine** BLE-Verbindung gleichzeitig. Ist das Gerät mit Polar Flow verbunden, lehnt es alle weiteren Verbindungsversuche ab.

**Einstellung aktivieren:**
> Polar Flow App → H10 auswählen → ⚙️ Einstellungen → **Verbindungen** → „Zwei Verbindungen erlauben" → **AN**

Relevanz:
- **Polar Flow App** und **Polar Beat App** zählen als je eine separate BLE-Verbindung
- Mit der Einstellung auf „Zwei" kann die Messdaten-App verbinden, während Flow im Hintergrund läuft
- Bei einem BLE-Reset (H10 neu anlegen) fällt die Einstellung auf „Eine" zurück — nach jedem Neuankoppeln prüfen

### Werkseinstellungen zurücksetzen

Löscht **alle gespeicherten Sessions** und setzt alle Einstellungen zurück. Die **Firmware bleibt unverändert**.

> Polar Flow App → H10 → ⚙️ Einstellungen → **Gerät zurücksetzen** → Bestätigen

⚠️ **Nach dem Zurücksetzen: BLE-Kopplung in Windows/macOS/Android ist aufgehoben.** Neu koppeln erforderlich (siehe unten).

Wann notwendig:
- H10 zeigt `OPERATION_NOT_PERMITTED` (Fehler 106) beim Starten einer neuen Aufzeichnung — ein korrupter Verzeichniseintrag blockiert den H10 dauerhaft bis zum Reset
- H10 reagiert nicht mehr auf Verbindungsversuche
- Extremfall: Soft-Reset (Neustart über BLE-Befehl) hat nicht geholfen

---

## Windows Bluetooth Kopplung

Für die **Offline-Aufzeichnung** (PSFTP-Protokoll) braucht der H10 eine vollständige OS-Kopplung mit Bonding — ein reines Web-Bluetooth-Verbinden reicht nicht aus.

### Erstkopplung

1. H10 anlegen (LED blinkt einmal grün)
2. Windows: **Einstellungen → Bluetooth & Geräte → Gerät hinzufügen → Bluetooth**
3. „Polar H10 XXXXXXXX" auswählen → **Koppeln**
4. Kopplung bestätigen — kein PIN nötig
5. H10 erscheint dauerhaft in der Geräteliste

### Nach Factory Reset neu koppeln

Der H10 „vergisst" alle gekoppelten Geräte beim Zurücksetzen. Windows behält den alten Eintrag — das führt zu GATT-Verbindungsfehlern.

1. Windows: Einstellungen → Bluetooth → **alten H10-Eintrag entfernen** (… → Gerät entfernen)
2. H10 abnehmen und kurz warten (LED erlischt)
3. H10 neu anlegen (LED blinkt)
4. Neuen Kopplungsvorgang starten (wie Erstkopplung)
5. Danach Polar Flow App öffnen → H10 verbinden → Einstellungen prüfen

---

## Polar Flow App — Konflikte vermeiden

Die Polar Flow App kommuniziert über denselben GATT-Service (0xFEEE) wie die Messdaten-App. Beide gleichzeitig → GATT-Kollision → Timeouts oder Verbindungsabbrüche.

| Situation | Verhalten |
|---|---|
| Flow App im Vordergrund | Flow hält GATT-Handle → Messdaten-App kann nicht verbinden |
| Flow App im Hintergrund (iOS) | iOS friert App ein → meist kein Konflikt, aber unsicher |
| Flow App im Hintergrund (Android) | Android lässt Background-BLE zu → Konflikt möglich |
| Flow App vollständig beendet | Kein Konflikt ✓ |

**Empfehlung:** Vor jeder Offline-Aufzeichnung und jedem Sync die Polar Flow App **vollständig schließen** (nicht nur minimieren).

---

## Bekannte Fehlercodes

| Code | Name | Bedeutung | Lösung |
|---|---|---|---|
| 103 bei GET | NO_SUCH_FILE | Pfad nicht gefunden | Normal bei `GET /E/` — H10 nutzt Root-Level `/1/` |
| 103 bei REMOVE /dir/ | NO_SUCH_FILE | Verzeichnis bereits automatisch gelöscht | **Kein Fehler!** H10 entfernt Verzeichnis automatisch, wenn letzte Datei gelöscht wird |
| 106 | OPERATION_NOT_PERMITTED | Zombie-Verzeichnis blockiert neuen Start | Werkseinstellungen zurücksetzen |
| Timeout | — | Keine Antwort auf Befehl | Polar Flow schließen, H10 neu anlegen, erneut verbinden |

---

## Zombie-Zustand (Fehler 106)

Der häufigste Showstopper beim Entwickeln und Testen.

**Was passiert:**
Der H10 legt den Verzeichniseintrag `/1/` unmittelbar beim `startRecording` an — bevor irgendwelche RR-Daten auf Flash geschrieben sind. Wird die Aufzeichnung innerhalb der ersten ~2 Minuten gestoppt, bleibt das Verzeichnis leer und korrupt. Ein späteres `REMOVE /1/` schlägt mit 103 fehl, obwohl `GET /` das Verzeichnis in der Liste zeigt. Alle neuen `startRecording`-Versuche scheitern mit 106.

**⚠️ Wichtig — Unterschied zu normalem REMOVE-103:**

| Situation | `GET /1/` | `REMOVE /1/` → 103 | Ursache |
|---|---|---|---|
| **Zombie** | → 103 (Verzeichnis kaputt) | Fehler, unlösbar | Korrupter Flash-Eintrag |
| **Normal (Auto-Remove)** | → 18b (Dateien sichtbar) | OK = bereits weg | Letzte Datei wurde gelöscht → dir auto-removed |

**Zombie-Erkennung (korrekt):**
```
GET /1/ → errorCode=103  ← Verzeichnis existiert in Listing, aber nicht lesbar
startRecording → errorCode=106
```
Wenn `GET /1/` Dateinamen zurückgibt (≥ 18 Bytes), ist `/1/` KEIN Zombie — normaler REMOVE-Ablauf.

**Lösung:** Nur Werkseinstellungen (Factory Reset). Soft-Reset über BLE hilft nicht — das Flash-Filesystem bleibt unverändert.

**Im Produktivbetrieb tritt das NICHT auf:** Eine 24h-Aufzeichnung schreibt Daten kontinuierlich auf Flash. Das Verzeichnis bleibt nie leer.

---

## H10 Filesystem

Struktur auf einem H10 mit Firmware 4.2.0:

```
/
├── DEVICE.BPB       (127 Bytes — Gerätekonfiguration)
└── 1/               (Exercise-Verzeichnis, nach startRecording angelegt)
    └── SAMPLES.BPB  (RR-Daten, ~2 Bytes/Schlag × Anzahl Schläge)
```

- Exercises liegen **direkt im Root** (`/1/`), **nicht** unter `/E/` (ältere SDK-Annahme)
- `SAMPLES.BPB` ist ein Protobuf-File: Feld 28 → Feld 1 → packed Varints = RR-Intervalle in ms
- Beispiel: `d4 07` → Varint-Decode = 980 ms = 61 bpm ✓

---

## LED-Blink-Codes

| Muster | Bedeutung |
|---|---|
| 1× grün (beim Anlegen) | H10 aktiv, sendet HR |
| 1× grün pro Minute | Offline-Recording läuft autonom |
| Grün + Orange abwechselnd | Firmware-Update läuft — nicht unterbrechen! |
| 1× rot (beim Anlegen) | Batterie fast leer |

---

## Typische Ablauf-Sequenz (Produktiv)

```
1. Polar Flow schließen
2. H10 anlegen → LED blinkt
3. App: "Aufzeichnung starten" → BLE verbindet
4. SET_LOCAL_TIME → startRecording → BLE trennt sich
5. H10 nimmt autonom auf (1×/Min grün blinkt)
6. [24 Stunden später]
7. App: Tab "Aufzeichnen" → "Aufzeichnung beenden und speichern" → BLE verbindet
8. stopRecording → SAMPLES.BPB herunterladen → REMOVE /1/
9. BLE trennt sich
```

Schritt 8 (REMOVE) ist kritisch: erst nach erfolgreichem Download löschen, sonst sind Daten weg.

---

## Diagnose-Log

Die App protokolliert automatisch jeden Schritt einer Aufzeichnung und Synchronisation — inklusive aller BLE-Pakete, Fehlercodes und Zeitstempel. Diese Daten lassen sich als Textdatei exportieren und zur Fehleranalyse weiterleiten.

### Wann exportieren?

**Nach dem Starten einer Aufzeichnung:**
Sobald die Aufzeichnung gestartet wurde (erfolgreich oder mit Fehler), erscheint der Button **„Diagnose-Log exportieren"** im Tab „Aufzeichnen". Bei Aufzeichnungen vom Smartphone: **Log direkt nach dem Start exportieren und aufheben** — der Speicher wird bei einem Geräteneustart geleert, das Protokoll des Starts wäre danach verloren.

**Nach einem Sync-Versuch:**
Nach jedem Sync-Versuch (egal ob erfolgreich oder fehlgeschlagen) erscheint der Button ebenfalls. Der Log enthält dann sowohl den Start- als auch den Sync-Verlauf in einer Datei — sofern das Gerät zwischen Start und Sync nicht neu gestartet wurde.

### Was enthält das Log?

```
=== HRV-Monitor Diagnose-Log ===
Datum:   2026-06-10T08:15:33.421Z
Browser: Mozilla/5.0 (iPhone; CPU iPhone OS 17_4...) Bluefy/...
URL:     https://bartlog.github.io/HRV-APP/
========================================

[08:15:33.421] [INFO ] Sync gestartet
[08:15:33.890] [DEBUG] Requesting Polar H10 via Web Bluetooth…
[08:15:35.102] [DEBUG] Found: Polar H10 A1B2C3D4
[08:15:36.450] [DEBUG] PSFTP channel ready
[08:15:36.451] [DEBUG] TX (3 pkt): 02 00 0f 80 | ...
[08:15:36.812] [DEBUG] RX 51: 01 00 00 (status=1 seq=0)
[08:15:39.001] [DEBUG] /6A270133/: [empty]
[08:15:39.002] [ERROR] No data file found in /6A270133/
```

Das Log enthält:
- Datum, Uhrzeit (ms-genau)
- Browser und Gerätekennung
- Jeden gesendeten BLE-Befehl (TX) und jede Antwort des H10 (RX)
- Fehlercodes und Fehlermeldungen
- Ergebnis von Start und Sync

### So weitergeben

Den Button „Diagnose-Log exportieren" klicken → eine `.txt`-Datei wird heruntergeladen → per E-Mail oder Chat weiterleiten.

---

## Quick-Fixes auf einen Blick

| Problem | Quick-Fix |
|---|---|
| startRecording → 106 | Factory Reset → Windows neu koppeln |
| Verbindung schlägt fehl / Timeout | Polar Flow schließen, H10 abnehmen + neu anlegen |
| Gerät erscheint nicht in BLE-Dialog | Windows Bluetooth aus/ein, H10 neu anlegen |
| „Bonding failed" / Pairing-Fehler | Alten BT-Eintrag in Windows entfernen, neu koppeln |
| Zwei Apps gleichzeitig nötig | In Polar Flow: Einstellungen → 2 BLE-Verbindungen aktivieren |
| Polar Flow kann sich nach App-Nutzung nicht verbinden | 2-Verbindungen-Einstellung prüfen / H10 neu anlegen |
