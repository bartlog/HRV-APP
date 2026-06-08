# Erste Live-Messung

**Voraussetzung:** Guide „Bluetooth-Verbindung" und „H10 anlegen" abgeschlossen.

---

## Schritt 1 — App öffnen

`https://bartlog.github.io/HRV-APP/` in **Chrome** oder **Edge**

---

## Schritt 2 — H10 verbinden

1. Tab **„Live"** öffnen
2. Klick auf **„H10 verbinden"**
3. Browser-Dialog → **„Polar H10 XXXXXXXX"** auswählen
4. Badge: **LIVE — Verbunden** (grün)

---

## Schritt 3 — Live-Werte beobachten

- **Tab „Live":** RMSSD und Stress-Index erscheinen nach ~5 Herzschlägen
- **LF/HF-Ratio** erscheint nach ~60 RR-Intervallen (≈ 1 Minute)
- **EKG-Kurve** am unteren Ende des Live-Tabs — Live-Kurve mit erkennbaren R-Zacken

---

## Schritt 4 — Session beenden

- Klick auf **„Verbindung trennen"**
- Session wird automatisch in IndexedDB gespeichert
- Tab **„Auswerten":** Session erscheint in der Liste → **„CSV"** exportiert alle RR-Intervalle + HRV-Fenster als Datei

> **Hinweis:** EDF+D-Export ist geplant und wird in einer der nächsten Versionen verfügbar sein.

---

## Fehler-Szenarien

| Fehler | Ursache | Lösung |
|---|---|---|
| Kein H10 im Browser-Dialog | H10 nicht angelegt / trocken | Elektroden befeuchten |
| BLE-Verbindung verloren | H10 außer Reichweite | App versucht Reconnect (Badge blinkt gelb) |
| RMSSD < 15 ms | Elektroden-Kontaktverlust | Elektroden nachbefeuchten, Sitz prüfen |
| Polar App auf Handy offen | 2 BLE-Verbindungen | Polar App schließen |
