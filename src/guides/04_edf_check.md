# EDF-Export in EDFbrowser prüfen

---

## Schritt 1 — EDF exportieren

1. **Sitzungen-Tab** → Session auswählen
2. **„EDF+D exportieren"** klicken
3. Browser-Dialog: Speicherort wählen (`session_YYYYMMDD_HHMMSS.edf`)

> **Fallback (Firefox/Safari):** Datei wird automatisch heruntergeladen.

---

## Schritt 2 — EDFbrowser installieren

Download: [https://www.teuniz.net/edfbrowser/](https://www.teuniz.net/edfbrowser/)
Kostenlos, läuft auf Windows, macOS, Linux.

---

## Schritt 3 — Datei öffnen

`File → Open → session_YYYYMMDD_HHMMSS.edf`

---

## Schritt 4 — EKG-Kanal prüfen

| Merkmal | Normalwert | Problem |
|---|---|---|
| R-Zacken-Amplitude | 0,5–2,0 mV | < 0,1 mV → Skalierungsfehler |
| Morphologie | Deutliche Spitzen, weiche T-Welle | Nur Rauschen → Lead-Off |
| Baseline-Wander | Leicht (Atemschwankung) — normal | Starkes Rauschen → Elektroden-Problem |

---

## Schritt 5 — Gaps prüfen

`View → Annotations` → Einträge **„Gap_BLE"** = BLE-Unterbrechungen

Die Zeitachse springt an Unterbrechungen — das ist EDF+D-Format und korrekt, kein Bug.

---

## Schritt 6 — ACC-Kanäle prüfen

- **ACC_Z** ≈ 1 mV (= 1 g, Gravitation) im Sitzen/Liegen
- Bei Bewegung: alle drei Achsen zeigen synchrone Ausschläge
