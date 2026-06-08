# Checking EDF Export in EDFbrowser

> **Note:** EDF+D export is planned and not yet available. This guide describes the future workflow.

---

## Step 1 — Export EDF (planned)

1. **"Analyze"** tab → select session
2. Click **"Export EDF+D"**
3. Browser dialog: choose save location (`session_YYYYMMDD_HHMMSS.edf`)

---

## Step 2 — Install EDFbrowser

Download: [https://www.teuniz.net/edfbrowser/](https://www.teuniz.net/edfbrowser/)
Free, runs on Windows, macOS, Linux.

---

## Step 3 — Open File

`File → Open → session_YYYYMMDD_HHMMSS.edf`

---

## Step 4 — Check ECG Channel

| Feature | Normal value | Problem |
|---|---|---|
| R-peak amplitude | 0.5–2.0 mV | < 0.1 mV → scaling error |
| Morphology | Clear peaks, smooth T-wave | Only noise → Lead-Off |
| Baseline wander | Slight (respiratory) — normal | Heavy noise → electrode problem |

---

## Step 5 — Check Gaps

`View → Annotations` → entries **"Gap_BLE"** = BLE interruptions

The time axis jumps at interruptions — this is the EDF+D format and correct, not a bug.

---

## Step 6 — Check ACC Channels

- **ACC_Z** ≈ 1 mV (= 1 g, gravity) when sitting/lying
- During movement: all three axes show synchronous deflections
