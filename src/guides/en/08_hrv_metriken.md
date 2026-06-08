# HRV Metrics Explained

This app calculates three key metrics from your RR intervals (the time between two heartbeats in milliseconds).

---

## RMSSD — Short-Term Variability

**Root Mean Square of Successive Differences**

```
RMSSD = √( Σ(RRᵢ₊₁ − RRᵢ)² / (n−1) )
```

Measures the **differences between successive** heartbeats.

| Value | Meaning |
|---|---|
| **> 50 ms** | Good recovery, parasympathetic nervous system active |
| **30–50 ms** | Normal, mild exertion |
| **< 30 ms** | Poor recovery, stress, exhaustion |

RMSSD responds quickly — even after a few minutes of rest it rises. It is the **most sensitive everyday marker** for sleep quality and training.

---

## SDNN — Total Variability

**Standard Deviation of NN Intervals**

```
SDNN = √( Σ(RRᵢ − RR̄)² / (n−1) )
```

SDNN measures how much all heartbeat intervals fluctuate together — the **total width** of the distribution.

| Value | Meaning |
|---|---|
| **> 100 ms** | Good cardiovascular adaptation |
| **50–100 ms** | Normal range |
| **< 50 ms** | Clinically relevant (in cardiac patients) |

For short recordings (< 5 min), SDNN is less informative than RMSSD.

---

## Stress Index (SI) — Baevsky

**Also: Sympathetic Activity, Tension Index**

```
SI = AMo / (2 × Mo × VR)
```

| Term | Meaning |
|---|---|
| **Mo** (Mode) | Most frequent RR value in histogram (50ms bins, bin center in seconds) |
| **AMo** (Amplitude) | Proportion of intervals in the modal bin, in % |
| **VR** (Variation range) | max(RR) − min(RR) in seconds |

The logic: when the heart beats **very regularly** (many intervals cluster around one value → high AMo, small VR), variability is low → high Stress Index.

| Value | Meaning |
|---|---|
| **< 50** | Excellent variability, deep parasympathetic |
| **50–150** | Normal resting range |
| **150–300** | Elevated sympathetic activity, stress/exertion |
| **> 300** | High stress, exhaustion, acute illness |

> **Important:** The SI often rises at night because the heart rhythm is particularly regular during deep sleep — this is normal and not a stress signal.

---

## Interaction of Metrics

| Situation | RMSSD | SDNN | SI |
|---|---|---|---|
| Relaxed rest | high | medium | low |
| Deep sleep | medium–high | high | medium–high |
| Physical stress | low | low | high |
| Mental stress | low | low | medium–high |
| Overtraining | very low | low | high |

---

## Analysis Over Time

In the **Analyze** view, the chart shows RMSSD and SI over time (every 50 RR intervals = one data point). The x-axis shows the time of day.

- **RMSSD decreasing + SI increasing** = increasing sympathetic activity (stress, exertion, waking up)
- **RMSSD increasing + SI decreasing** = recovery, falling asleep

---

## Sources & Further Reading

- Baevsky R.M. (1984): *Measurement and analysis of heart rate variability*
- Task Force of ESC/NASPE (1996): *Standards of Heart Rate Variability* — European standard, basis of many wearable algorithms
