const counters = new Map();
const durations = new Map();
const gauges = new Map();
export function incrementMetric(name, amount = 1) { counters.set(name, (counters.get(name) || 0) + amount); }
export function observeDuration(name, durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  const value = durations.get(name) || { count: 0, totalMs: 0, maxMs: 0 };
  value.count++; value.totalMs += durationMs; value.maxMs = Math.max(value.maxMs, durationMs); durations.set(name, value);
}
export function setGauge(name, value) { gauges.set(name, value); }
export function metricsSnapshot() {
  return Object.freeze({ counters: Object.fromEntries(counters), durations: Object.fromEntries([...durations].map(([key, value]) => [key, { ...value, averageMs: value.count ? Math.round(value.totalMs / value.count) : 0 }])), gauges: Object.fromEntries(gauges) });
}
export function resetMetrics() { counters.clear(); durations.clear(); gauges.clear(); }
