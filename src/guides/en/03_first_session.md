# First Live Session

**Prerequisite:** Guides "Bluetooth Connection" and "Wearing H10" completed.

---

## Step 1 — Open App

`https://bartlog.github.io/HRV-APP/` in **Chrome** or **Edge**

---

## Step 2 — Connect H10

1. Open the **"Live"** tab
2. Click **"Connect H10"**
3. Browser dialog → select **"Polar H10 XXXXXXXX"**
4. Badge: **LIVE — Connected** (green)

---

## Step 3 — Monitor Live Values

- **"Live" tab:** RMSSD and Stress Index appear after ~5 heartbeats
- **LF/HF ratio** appears after ~60 RR intervals (≈ 1 minute)
- **ECG curve** at the bottom of the Live tab — live curve with visible R-peaks

---

## Step 4 — End Session

- Click **"Disconnect"**
- Session is automatically saved to IndexedDB
- **"Analyze"** tab: session appears in the list → **"CSV"** exports all RR intervals + HRV windows as a file

> **Note:** EDF+D export is planned and will be available in a future version.

---

## Error Scenarios

| Error | Cause | Solution |
|---|---|---|
| H10 not in browser dialog | H10 not worn / electrodes dry | Moisten electrodes |
| BLE connection lost | H10 out of range | App attempts reconnect (badge blinks yellow) |
| RMSSD < 15 ms | Electrode contact loss | Re-moisten electrodes, check fit |
| Polar app open on phone | 2 BLE connections | Close Polar app |
