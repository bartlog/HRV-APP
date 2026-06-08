# Installation & Quickstart

**Kein Download, keine Installation erforderlich.**

## Endnutzer (empfohlen)

1. **Chrome** oder **Edge** (Version ≥ 89) öffnen
2. URL aufrufen: `https://bartlog.github.io/HRV-APP/`
3. Fertig — die App läuft vollständig im Browser

## Simulation ohne H10

Zum Testen ohne Sensor:

- Tab **„Live"** öffnen → Klick auf **„Simulation"** → Badge zeigt **SIMULATION**
- Synthetische EKG/RR/ACC-Daten laufen sofort
- Alle Metriken (RMSSD, SDNN, Stress-Index) sind sichtbar

## Entwickler — lokaler Build

Voraussetzung: Node.js ≥ 18 + Git

```bash
git clone https://github.com/bartlog/HRV-APP.git
cd HRV-APP
npm install
npm run dev   # → http://localhost:5173
```

## Browser-Kompatibilität

| Browser | Web Bluetooth | Empfehlung |
|---|---|---|
| Chrome ≥ 89 (Win/Mac/Android) | ✓ | **Primär** |
| Edge ≥ 89 | ✓ | Vollständig |
| Firefox | ✗ | Nicht unterstützt |
| Safari (macOS) | ✗ | Nicht unterstützt |
| iOS Safari / Chrome | ✗ | → **Bluefy** App (Guide 01) |

## Nächste Schritte

- [Bluetooth-Verbindung](01_bluetooth_pairing.md) — H10 verbinden
- [H10 anlegen](02_wearing_h10.md) — Korrekte Platzierung
- [Erste Messung](03_first_session.md) — Live-Session starten
