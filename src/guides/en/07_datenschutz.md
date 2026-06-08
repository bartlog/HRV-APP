# Privacy & Data Storage

## All Data Stays on Your Device

This app stores data **exclusively locally** — directly in your browser. There is:

- ❌ no server
- ❌ no cloud backup
- ❌ no account
- ❌ no data transmission to the internet

Your heart rate data never leaves your device.

---

## Where is Data Stored?

The app uses **IndexedDB** — a local database built into every modern browser.

Data is bound to three things:
1. **This browser** (Chrome/Edge on this device)
2. **This device** (no sync between PC and smartphone)
3. **This browser profile** (no sync between browser profiles)

If you open the app in a different browser or on a different device, previously saved sessions will not be visible there.

---

## What is Stored?

| Table | Content |
|---|---|
| `sessions` | Start time, duration, device ID, RR count |
| `rrIntervals` | Individual RR intervals in ms with timestamp |
| `hrvMetrics` | RMSSD, SDNN, Stress Index per time window |

No names, no personal identifiers. The device ID is a hash of the browser user agent — no direct personal identification.

---

## Deleting Data

**Single recording:**
**"Analyze"** tab → **✕** button next to the session

**All data at once:**
> Browser Settings → Privacy → Manage website data → `localhost` (or your domain) → Delete

After deleting website data, all sessions are permanently gone.

---

## Exporting / Backing Up Data

**CSV export** is available: **"Analyze"** tab → **"CSV"** button next to each session.

The CSV file contains all RR intervals with timestamps and the calculated HRV windows.
It can be further processed in Excel, Python (pandas), R, or MATLAB.

**EDF+D export** (for EDFbrowser / clinical software) is planned.

---

## Open Source

The entire source code of this app is publicly viewable. There are no hidden network requests.
