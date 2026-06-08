# 24–30h Offline-Messung

Der H10 speichert bis zu **~95.000 RR-Intervalle** (≈ 20–30 Stunden) intern —
kein dauerhaftes Bluetooth nötig.

> **Wichtig:** Der H10 kann nur **eine** Session speichern. Vorherige Daten werden beim nächsten Start überschrieben → zuerst synchronisieren!

---

## Schritt 1 — Aufzeichnung starten (~5 Sek. BLE)

H10 anlegen (→ Guide: H10 anlegen). PC/Laptop in BLE-Reichweite (~5 m).

1. App → Tab **„Aufzeichnen"** → **„Aufzeichnung starten"**
2. Browser-Dialog → Polar H10 auswählen
3. App zeigt: *„Aufzeichnung aktiv. H10 zeichnet autonom auf."*
4. BLE-Verbindung trennt sich automatisch
5. Gerät kann weggelegt oder ausgeschaltet werden

> **Wichtig:** Sync muss vom **selben Gerät** (Browser + Betriebssystem) erfolgen!
> *(Firmware ≥ 4.1.10 Gerätebindung — Details am Ende dieser Anleitung)*

---

## Schritt 2 — 24–30 Stunden tragen

- LED blinkt **einmal pro Minute grün** = Aufzeichnung aktiv
- Normale Aktivitäten: Schlafen, Sport, Arbeit, Duschen
- Nach 8–10 Stunden: Elektroden nachbefeuchten (falls möglich)
- **NICHT:** Polar App auf dem Handy öffnen → unterbricht/überschreibt die Session!

---

## Schritt 3 — Synchronisieren (selbes Gerät!)

PC/Laptop in BLE-Reichweite:

1. App öffnen → Tab **„Aufzeichnen"** → **„Aufzeichnung beenden und speichern"**
2. Browser-Dialog → Polar H10 auswählen
3. Fortschrittsbalken: *„Lade Session herunter…"*
4. App berechnet HRV-Metriken → speichert in IndexedDB
5. Tab **„Auswerten":** Session erscheint mit korrekter Dauer

---

## Schritt 4 — Auswertung

- Tab **„Auswerten"** → Session auswählen → **„Analysieren"**
- Diagramm: RMSSD und Stress-Index über die Messung (Uhrzeit auf x-Achse)
- Schlaf-Phasen erkennbar: niedriger SI + hoher RMSSD
- **„CSV"**-Button: exportiert alle RR-Intervalle + HRV-Fenster als `.csv`-Datei

> **Hinweis:** EDF+D-Export ist geplant und wird in einer der nächsten Versionen verfügbar sein.

---

## ⚠️ Geräte-Bindung — Firmware ≥ 4.1.10

Ab Firmware 4.1.10 bindet der H10 eine Session an das BLE-Gerät, das die Aufzeichnung **gestartet** hat.

- Start auf **Windows-PC** → Sync muss auf demselben Windows-PC erfolgen
- Start auf **MacBook** → Sync muss auf demselben MacBook erfolgen
- Start auf **iPhone (Bluefy)** → Sync muss auf demselben iPhone in Bluefy erfolgen

Die App warnt beim Sync, wenn das Gerät vom gespeicherten Wert abweicht.

---

## ⚠️ Batterie-Warnung

- CR2025 hält ~400 h bei normalem Training (Polar-Angabe)
- Im Offline-Recording-Modus deutlich geringerer Verbrauch (kein BLE-Dauerstrom)
- App zeigt Ladestand nach BLE-Verbindung

**Wechsel nötig wenn:** LED blinkt rot beim Anlegen, oder Ladestand < 20 %

**Community-Workaround — CR2032 statt CR2025:**
0,7 mm dicker, passt mit minimal gebogener Plastiklippe am Batteriefachdeckel.
Kapazität: 160 mAh → 225 mAh **(+40 %)**.
*Nicht offiziell von Polar unterstützt. Auf eigene Verantwortung.*

---

## Häufige Fehler

| Fehler | Lösung |
|---|---|
| „Kein aktives Recording" | „Aufzeichnung starten" war nicht erfolgreich — erneut versuchen |
| „Session vorhanden, nicht synced" | Erst synchronisieren, dann neu starten |
| PFTP-Fehler 106 beim Starten | Zombie-Verzeichnis → **Werkseinstellungen zurücksetzen** (Guide: H10 Troubleshoot) |
| Polar App hatte sich verbunden | Daten bis zum Verbindungszeitpunkt vorhanden |
| Verbindung schlägt fehl / Timeout | Polar Flow App vollständig schließen, dann erneut verbinden |
| Weniger als 20 h Daten | Lead-Off-Kontaktverlust — Elektroden-Sitz prüfen |
| Session bricht nach ~15 h ab | Batterie leer → CR2032 einlegen |
