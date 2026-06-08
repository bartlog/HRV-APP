# Bluetooth Connection

**Prerequisite:** H10 worn, electrodes moistened (→ Guide: Wearing H10).
LED blinks **once green** = H10 active and transmitting.

---

## Chrome / Edge — Windows, macOS, Android

**Step 1 — Enable Bluetooth**

- Windows: Settings → Bluetooth → **ON**
- macOS: System Preferences → Bluetooth → **ON**
- Android: Quick Settings → Bluetooth → **ON**

**Step 2 — Connect in the app**

1. Open the **"Live"** tab
2. Click **"Connect H10"**
3. The browser opens a Bluetooth device dialog
   *(Security mechanism: the browser — not the app — requests permission)*
4. Select **"Polar H10 XXXXXXXX"** from the list → **"Pair"**

**Step 3 — Confirm connection**

- Badge switches to **LIVE — Connected**
- ECG chart and RR display start immediately

> **Note for offline recording:** For a 24h session, the H10 must be **paired in Windows Bluetooth settings**
> (Settings → Bluetooth & devices → Add device → Polar H10). For live measurement only, Web Bluetooth without OS pairing is sufficient.

> **Two BLE connections:** The H10 allows only one BLE connection by default. To use Flow app and measurement app simultaneously:
> Polar Flow → H10 → ⚙️ Settings → Connections → **Allow two connections → ON**

**Common Errors**

| Error | Solution |
|---|---|
| H10 not in browser dialog | Moisten electrodes, remove and re-wear H10 |
| "Device not available" | Close the Polar app on your phone |
| Bluetooth permission missing (macOS) | System Preferences → Privacy → Bluetooth → Chrome ✓ |

---

## iOS — Bluefy (required)

iOS Safari and Chrome for iOS do not support Web Bluetooth (Apple's WebKit restriction).

**Step 1 — Install Bluefy**

- **Bluefy** from the App Store: approx. €2
- Alternative: **WebBLE** (free, less stable)

**Step 2 — Open URL in Bluefy** *(not in Safari!)*

1. Open Bluefy
2. Address bar → `https://bartlog.github.io/HRV-APP/`
3. Page loads normally

**Step 3 — Grant Bluetooth permission (once)**

- iOS asks: "Bluefy would like to use Bluetooth" → **Allow**

**Step 4 — Connect** as above (Steps 2–3)

**Common Errors (iOS)**

| Error | Solution |
|---|---|
| "Web Bluetooth not available" | App is running in Safari instead of Bluefy |
| Connection drops immediately | Disable/re-enable iOS Bluetooth |

---

## Firefox / Safari (Desktop)

These browsers do not implement Web Bluetooth.
The app automatically shows a notice on startup.
→ Please switch to **Chrome** or **Edge**.
