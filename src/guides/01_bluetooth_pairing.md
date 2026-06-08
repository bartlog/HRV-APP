# Bluetooth-Verbindung

**Voraussetzung:** H10 angelegt, Elektroden befeuchtet (→ Guide: H10 anlegen).
LED blinkt **einmal grün** = H10 aktiv und sendet.

---

## Chrome / Edge — Windows, macOS, Android

**Schritt 1 — Bluetooth aktivieren**

- Windows: Einstellungen → Bluetooth → **EIN**
- macOS: Systemeinstellungen → Bluetooth → **EIN**
- Android: Schnelleinstellungen → Bluetooth → **EIN**

**Schritt 2 — In der App verbinden**

1. Klick auf **„H10 verbinden"** (grüner Button oben rechts)
2. Browser öffnet einen Bluetooth-Gerätedialog
   *(Sicherheitsmechanismus: der Browser — nicht die App — fragt nach Erlaubnis)*
3. **„Polar H10 XXXXXXXX"** in der Liste auswählen → **„Koppeln"**

**Schritt 3 — Verbindung bestätigen**

- Badge wechselt zu **LIVE — Verbunden**
- EKG-Chart und RR-Anzeige starten sofort

> **Hinweis Offline-Aufzeichnung:** Für die 24h-Session muss der H10 in den **Windows Bluetooth-Einstellungen gekoppelt** sein
> (Einstellungen → Bluetooth & Geräte → Gerät hinzufügen → Polar H10). Für reine Live-Messung reicht Web Bluetooth ohne OS-Kopplung.

> **Zwei BLE-Verbindungen:** Der H10 erlaubt standardmäßig nur eine BLE-Verbindung. Sollen Flow-App und Messdaten-App gleichzeitig verbunden sein:
> Polar Flow → H10 → ⚙️ Einstellungen → Verbindungen → **Zwei Verbindungen erlauben → AN**

**Häufige Fehler**

| Fehler | Lösung |
|---|---|
| H10 erscheint nicht im Dialog | Elektroden befeuchten, H10 kurz abnehmen und neu anlegen |
| „Gerät nicht verfügbar" | Polar App auf dem Handy schließen |
| Bluetooth-Berechtigung fehlt (macOS) | Systemeinstellungen → Datenschutz → Bluetooth → Chrome ✓ |

---

## iOS — Bluefy (zwingend erforderlich)

iOS Safari und Chrome für iOS unterstützen Web Bluetooth nicht (WebKit-Einschränkung von Apple).

**Schritt 1 — Bluefy installieren**

- **Bluefy** aus dem App Store: ca. 2 €
- Alternative: **WebBLE** (kostenlos, weniger stabil)

**Schritt 2 — URL in Bluefy öffnen** *(nicht in Safari!)*

1. Bluefy öffnen
2. Adressleiste → `https://<user>.github.io/hrv-app/`
3. Seite lädt wie gewohnt

**Schritt 3 — Bluetooth-Erlaubnis erteilen (einmalig)**

- iOS fragt: „Bluefy möchte Bluetooth verwenden" → **Erlauben**

**Schritt 4 — Verbinden** wie oben (Schritt 2–3)

**Häufige Fehler (iOS)**

| Fehler | Lösung |
|---|---|
| „Web Bluetooth not available" | App läuft in Safari statt Bluefy |
| Verbindung bricht sofort ab | iOS Bluetooth deaktivieren/reaktivieren |

---

## Firefox / Safari (Desktop)

Diese Browser implementieren Web Bluetooth nicht.
Die App zeigt beim Start automatisch einen Hinweis.
→ Bitte auf **Chrome** oder **Edge** wechseln.
