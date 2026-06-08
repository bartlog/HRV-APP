# Datenschutz & Datenspeicherung

## Alle Daten bleiben auf deinem Gerät

Diese App speichert **ausschließlich lokal** — direkt im Browser deines Geräts. Es gibt:

- ❌ keinen Server
- ❌ kein Cloud-Backup
- ❌ keinen Account
- ❌ keine Datenübertragung ins Internet

Die Herzratendaten verlassen dein Gerät zu keinem Zeitpunkt.

---

## Wo werden die Daten gespeichert?

Die App nutzt **IndexedDB** — eine in jedem modernen Browser eingebaute lokale Datenbank.

Die Daten sind an drei Dinge gebunden:
1. **Diesen Browser** (Chrome/Edge auf diesem Gerät)
2. **Dieses Gerät** (kein Sync zwischen PC und Smartphone)
3. **Diesen Browser-Nutzer** (kein Sync zwischen Browser-Profilen)

Startest du die App in einem anderen Browser oder auf einem anderen Gerät, sind die bisher gespeicherten Sitzungen dort nicht sichtbar.

---

## Was wird gespeichert?

| Tabelle | Inhalt |
|---|---|
| `sessions` | Startzeit, Dauer, Geräte-ID, RR-Anzahl |
| `rrIntervals` | Einzelne RR-Intervalle in ms mit Zeitstempel |
| `hrvMetrics` | RMSSD, SDNN, Stress-Index je Zeitfenster |

Keine Namen, keine persönlichen Identifikatoren. Die Geräte-ID ist ein Hash aus Browser-User-Agent — kein direkter Personenbezug.

---

## Daten löschen

**Einzelne Aufzeichnung:**
Tab **„Auswerten"** → **✕**-Button neben der Sitzung

**Alle Daten auf einmal:**
> Browser-Einstellungen → Datenschutz → Website-Daten verwalten → `localhost` (oder deine Domain) → Löschen

Nach dem Löschen der Website-Daten sind alle Sitzungen unwiderruflich weg.

---

## Daten exportieren / sichern

Ein Export (CSV, EDF+D) ist geplant und wird in einer der nächsten Versionen verfügbar sein.
Bis dahin: Die Rohdaten liegen in IndexedDB und können mit Browser-Entwicklertools (F12 → Application → IndexedDB) eingesehen werden.

---

## Open Source

Der gesamte Quellcode dieser App ist öffentlich einsehbar. Es gibt keine versteckten Netzwerkanfragen.
