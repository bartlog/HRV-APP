import { describe, it, expect } from 'vitest';
import { rmssd, sdnn } from '../src/hrv/time_domain.js';
import { baevskySI } from '../src/hrv/baevsky.js';

// Reference RR array: 10 beats around 800 ms with small variation
const REF_RR = [800, 820, 790, 810, 800, 795, 815, 805, 800, 810];

describe('RMSSD', () => {
  it('returns NaN for fewer than 2 intervals', () => {
    expect(isNaN(rmssd([800]))).toBe(true);
  });

  it('is zero for identical intervals', () => {
    expect(rmssd([800, 800, 800])).toBeCloseTo(0);
  });

  it('is plausible for reference array (~14 ms)', () => {
    const val = rmssd(REF_RR);
    expect(val).toBeGreaterThan(5);
    expect(val).toBeLessThan(40);
  });
});

describe('SDNN', () => {
  it('returns NaN for single interval', () => {
    expect(isNaN(sdnn([800]))).toBe(true);
  });

  it('is plausible for reference array', () => {
    const val = sdnn(REF_RR);
    expect(val).toBeGreaterThan(3);
    expect(val).toBeLessThan(30);
  });
});

describe('Baevsky SI', () => {
  it('returns NaN for fewer than 10 intervals', () => {
    expect(isNaN(baevskySI([800, 810, 790]))).toBe(true);
  });

  it('returns physiologically plausible value for reference array (50-500 at rest)', () => {
    const val = baevskySI(REF_RR);
    expect(val).toBeGreaterThan(10);
    expect(val).toBeLessThan(2000);
  });
});
