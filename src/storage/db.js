import Dexie from 'dexie';

export const db = new Dexie('HRVMonitor');

db.version(1).stores({
  sessions:    '++id, startTime, mode, synced, exerciseId',
  rrIntervals: '++id, sessionId, timestamp, rrMs, artifactFlag',
  hrvMetrics:  '++id, sessionId, timestamp, rmssd, sdnn, si, lf, hf, lfhf, edr',
  ecgChunks:   '++id, [sessionId+offset]',
  accChunks:   '++id, [sessionId+offset]',
  // sessions also carry: startUtc, deviceFingerprint, rrCount (offline sessions)
});

export async function createSession(mode) {
  return db.sessions.add({ startTime: Date.now(), mode, synced: false });
}

export async function saveRR(sessionId, rrMs, artifactFlag = false) {
  return db.rrIntervals.add({ sessionId, timestamp: Date.now(), rrMs, artifactFlag });
}

export async function saveHRVMetrics(sessionId, metrics) {
  return db.hrvMetrics.add({ sessionId, timestamp: Date.now(), ...metrics });
}

export async function saveECGChunk(sessionId, offset, samples) {
  return db.ecgChunks.add({ sessionId, offset, samples });
}

export async function getECGChunk(sessionId, offset) {
  return db.ecgChunks.where('[sessionId+offset]').equals([sessionId, offset]).first();
}

export async function getSessionMetrics(sessionId) {
  return db.hrvMetrics.where('sessionId').equals(sessionId).toArray();
}

export async function listSessions() {
  return db.sessions.orderBy('startTime').reverse().toArray();
}

export async function deleteSession(sessionId) {
  await Promise.all([
    db.sessions.delete(sessionId),
    db.rrIntervals.where('sessionId').equals(sessionId).delete(),
    db.hrvMetrics.where('sessionId').equals(sessionId).delete(),
    db.ecgChunks.where('sessionId').equals(sessionId).delete(),
    db.accChunks.where('sessionId').equals(sessionId).delete(),
  ]);
}
