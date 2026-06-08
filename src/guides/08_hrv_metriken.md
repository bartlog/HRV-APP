# HRV-Metriken erklärt

Diese App berechnet drei Kennzahlen aus deinen RR-Intervallen (die Zeit zwischen zwei Herzschlägen in Millisekunden).

---

## RMSSD — Kurzzeit-Variabilität

**Root Mean Square of Successive Differences**

```
RMSSD = √( Σ(RRᵢ₊₁ − RRᵢ)² / (n−1) )
```

Gemessen werden die **Unterschiede zwischen aufeinanderfolgenden** Herzschlägen.

| Wert | Bedeutung |
|---|---|
| **> 50 ms** | Gute Erholung, Parasympathikus aktiv |
| **30–50 ms** | Normal, leichte Belastung |
| **< 30 ms** | Schlechte Erholung, Stress, Erschöpfung |

RMSSD reagiert schnell — schon nach wenigen Minuten Ruhe steigt er. Er ist der **empfindlichste Alltagsmarker** für Schlafqualität und Training.

---

## SDNN — Gesamtvariabilität

**Standard Deviation of NN Intervals**

```
SDNN = √( Σ(RRᵢ − RR̄)² / (n−1) )
```

SDNN misst, wie stark alle Herzschlag-Abstände zusammen schwanken — also die **Gesamtbreite** der Verteilung.

| Wert | Bedeutung |
|---|---|
| **> 100 ms** | Gute kardiovaskuläre Anpassung |
| **50–100 ms** | Normbereich |
| **< 50 ms** | Klinisch relevant (bei Herzpatienten) |

Bei kurzen Aufzeichnungen (< 5 Min.) ist SDNN weniger aussagekräftig als RMSSD.

---

## Stress-Index (SI) — Baevsky

**Auch: Sympathische Aktivität, Spannungsindex**

```
SI = AMo / (2 × Mo × VR)
```

| Term | Bedeutung |
|---|---|
| **Mo** (Modus) | Häufigster RR-Wert im Histogramm (50ms-Bins, Bin-Mitte in Sekunden) |
| **AMo** (Amplitude) | Anteil der Intervalle im Modal-Bin, in % |
| **VR** (Variationsbreite) | max(RR) − min(RR) in Sekunden |

Die Logik dahinter: Wenn das Herz **sehr regelmäßig** schlägt (viele Intervalle clustern um einen Wert → hohe AMo, kleines VR), ist die Variabilität gering → hoher Stress-Index.

| Wert | Bedeutung |
|---|---|
| **< 50** | Sehr gute Variabilität, tiefer Parasympathikus |
| **50–150** | Normbereich Ruhe |
| **150–300** | Erhöhte Sympathikusaktivität, Stress/Belastung |
| **> 300** | Starker Stress, Erschöpfung, akute Erkrankung |

> **Wichtig:** Der SI steigt nachts oft an, weil der Herzrhythmus im Tiefschlaf besonders regelmäßig ist — das ist normal und kein Stresssignal.

---

## Zusammenspiel der Metriken

| Situation | RMSSD | SDNN | SI |
|---|---|---|---|
| Entspannte Ruhe | hoch | mittel | niedrig |
| Tiefschlaf | mittel–hoch | hoch | mittel–hoch |
| Körperlicher Stress | niedrig | niedrig | hoch |
| Mentaler Stress | niedrig | niedrig | mittel–hoch |
| Übertraining | sehr niedrig | niedrig | hoch |

---

## Auswertung im Zeitverlauf

In der **Auswerten**-Ansicht zeigt das Diagramm RMSSD und SI über die Zeit (je 50 RR-Intervalle = ein Datenpunkt). Die x-Achse zeigt die Uhrzeit.

- **RMSSD sinkend + SI steigend** = zunehmende Sympathikusaktivität (Stress, Belastung, Aufwachen)
- **RMSSD steigend + SI sinkend** = Erholung, Einschlafen

---

## Quellen & Weiterführendes

- Baevsky R.M. (1984): *Measurement and analysis of heart rate variability*
- Task Force of ESC/NASPE (1996): *Standards of Heart Rate Variability* — Europäische Norm, Grundlage vieler Wearable-Algorithmen
