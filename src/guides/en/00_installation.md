# Installation & Quickstart

**No download or installation required.**

## End Users (recommended)

1. Open **Chrome** or **Edge** (version ≥ 89)
2. Visit: `https://bartlog.github.io/HRV-APP/`
3. Done — the app runs entirely in the browser

## Simulation without H10

To test without a sensor:

- Open the **"Live"** tab → click **"Simulation"** → badge shows **SIMULATION**
- Synthetic ECG/RR data starts immediately
- All metrics (RMSSD, SDNN, Stress Index) are visible

## Developers — Local Build

Requirements: Node.js ≥ 18 + Git

```bash
git clone https://github.com/bartlog/HRV-APP.git
cd HRV-APP
npm install
npm run dev   # → http://localhost:5173
```

## Browser Compatibility

| Browser | Web Bluetooth | Recommendation |
|---|---|---|
| Chrome ≥ 89 (Win/Mac/Android) | ✓ | **Primary** |
| Edge ≥ 89 | ✓ | Fully supported |
| Firefox | ✗ | Not supported |
| Safari (macOS) | ✗ | Not supported |
| iOS Safari / Chrome | ✗ | → **Bluefy** app (Guide 01) |

## Next Steps

- [Bluetooth Connection](01_bluetooth_pairing.md) — Connect the H10
- [Wearing the H10](02_wearing_h10.md) — Correct placement
- [First Session](03_first_session.md) — Start a live session
