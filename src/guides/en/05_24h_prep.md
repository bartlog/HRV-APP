# 24–30h Offline Recording

The H10 stores up to **~95,000 RR intervals** (≈ 20–30 hours) internally —
no continuous Bluetooth required.

> **Important:** The H10 can only store **one** session. Previous data is overwritten on the next start → sync first!

---

## Step 1 — Start Recording (~5 sec BLE)

Wear the H10 (→ Guide: Wearing H10). PC/laptop within BLE range (~5 m).

1. App → **"Record"** tab → **"Start Recording"**
2. Browser dialog → select Polar H10
3. App shows: *"Recording active. H10 recording autonomously."*
4. BLE connection disconnects automatically
5. Device can be put away or turned off

> **Important:** Sync must be done from the **same device** (browser + operating system)!
> *(Firmware ≥ 4.1.10 device binding — details at the end of this guide)*

---

## Step 2 — Wear for 24–30 Hours

- LED blinks **once per minute green** = recording active
- Normal activities: sleeping, exercise, work, showering
- After 8–10 hours: re-moisten electrodes (if possible)
- **DON'T:** Open the Polar app on your phone → interrupts/overwrites the session!

---

## Step 3 — Sync (same device!)

PC/laptop within BLE range:

1. Open app → **"Record"** tab → **"Stop & Save Recording"**
2. Browser dialog → select Polar H10
3. Progress: *"Downloading session…"*
4. App calculates HRV metrics → saves to IndexedDB
5. **"Analyze"** tab: session appears with correct duration

---

## Step 4 — Analysis

- **"Analyze"** tab → select session → **"Analyze"**
- Chart: RMSSD and Stress Index over time (x-axis shows time of day)
- Sleep phases visible: low SI + high RMSSD
- **"CSV"** button: exports all RR intervals + HRV windows as `.csv` file

> **Note:** EDF+D export is planned and will be available in a future version.

---

## ⚠️ Device Binding — Firmware ≥ 4.1.10

From firmware 4.1.10, the H10 binds a session to the BLE device that **started** the recording.

- Start on **Windows PC** → sync must be done on the same Windows PC
- Start on **MacBook** → sync must be done on the same MacBook
- Start on **iPhone (Bluefy)** → sync must be done on the same iPhone in Bluefy

The app warns during sync if the device differs from the stored value.

---

## ⚠️ Battery Warning

- CR2025 lasts ~400 h with normal training (Polar specification)
- In offline recording mode, significantly lower power consumption (no continuous BLE)
- App shows battery level after BLE connection

**Replacement needed when:** LED blinks red when worn, or battery < 20%

**Community workaround — CR2032 instead of CR2025:**
0.7 mm thicker, fits with slightly bent plastic lip on battery compartment cover.
Capacity: 160 mAh → 225 mAh **(+40%)**.
*Not officially supported by Polar. Use at your own risk.*

---

## Common Errors

| Error | Solution |
|---|---|
| "No active recording" | "Start Recording" was unsuccessful — try again |
| "Session present, not synced" | Sync first, then start new recording |
| PFTP error 106 on start | Zombie directory → **Factory reset** (Guide: H10 Troubleshoot) |
| Polar app had connected | Data up to connection time is available |
| Connection fails / timeout | Close Polar Flow completely, then reconnect |
| Less than 20h of data | Lead-off contact loss — check electrode fit |
| Session breaks off after ~15h | Battery empty → insert CR2032 |
