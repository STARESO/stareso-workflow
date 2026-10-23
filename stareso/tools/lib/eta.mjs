// ETA estimator of progress-graph.mjs: pure functions, no file access (tools/eta-backtest.mjs checks them against the history).
//
// Why not one number: the minutes a helper needs for a slice are skewed to the right (typical 30, one in five over 50, a few
// over 100) and nothing known at the start explains it (brief length, kind, milestone and tier were tried, tools/eta-backtest.mjs).
// So the estimate of a slice is the spread of the last durations, and the ETA of a lane or of the whole build is the median of a
// seeded simulation that draws every slice from that spread. A sum of medians is about 20 % too short, the simulation is not.
// A running slice is predicted from what is left among the durations longer than its elapsed time.

export const WINDOW = 30; // last durations that make the spread
export const MIN_SAMPLES = 6; // fewer than this: no spread, the caller falls back to one number
export const RUNS = 100; // simulated builds (about 10 ms for 150 open slices)
export const STALE = 240; // minutes: a helper running longer than any slice ever took is a leftover, not a slice about to end

export const quantile = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
export const median = (xs) => quantile(xs, 0.5);
export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Durations in minutes of the merged slices, oldest first. `etaActual` (id → minutes from the first sight of the helper to its
// merge) wins over the helper minutes of the build record, which differ by a few minutes at most.
export function durationRecords(builds, etaActual = new Map()) {
  const out = [];
  for (const e of builds) {
    if (e.type !== "slice" || e.result !== "ok") continue;
    const at = Date.parse(e.merge?.at || (e.t ? e.t.replace(" ", "T") + ":00" : ""));
    const minutes = etaActual.get(`${e.id}@${at}`) ?? e.usage?.minutes;
    if (!isNaN(at) && minutes > 0) out.push({ id: e.id, at, minutes });
  }
  return out.sort((a, b) => a.at - b.at);
}
export const durationsOf = (builds, etaActual) => durationRecords(builds, etaActual).map((d) => d.minutes);

// The spread of a slice's duration: typical (median), the 10 % and 90 % points, and the mean (what sums add up).
export function spread(durs) {
  const d = durs.slice(-WINDOW);
  return d.length < MIN_SAMPLES ? null : { n: d.length, typical: median(d), lo: quantile(d, 0.1), hi: quantile(d, 0.9), mean: mean(d), sample: d };
}

// Minutes left of a slice that has run `elapsed` minutes: the durations longer than that, minus the elapsed time. With fewer
// than three of them (it runs longer than nearly all) a slice is assumed to need about a third of its time again.
export function remaining(sample, elapsed) {
  if (elapsed > STALE) return { typical: 5, lo: 5, hi: 5, mean: 5, sample: [5] };
  const c = sample.filter((d) => d > elapsed + 2).map((d) => d - elapsed);
  if (c.length >= 3) return { typical: median(c), lo: quantile(c, 0.1), hi: quantile(c, 0.9), mean: mean(c), sample: c };
  const typical = Math.max(5, 0.35 * elapsed), lo = Math.max(3, 0.15 * elapsed), hi = 0.8 * elapsed + 5;
  return { typical, lo, hi, mean: typical, sample: [lo, typical, hi] };
}

// A small seeded generator, so the same records always draw the same ETA (the panel refreshes every minute).
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
export const draw = (sample, rnd) => sample[Math.floor(rnd() * sample.length)];

// Runs `once(rnd)` RUNS times, each returning a Map id → minutes, and gives per id the median and the 10 % and 90 % points.
export function simulate(once, seed = 1, runs = RUNS) {
  const rnd = rng(seed), by = new Map();
  for (let i = 0; i < runs; i++) for (const [k, v] of once(rnd)) (by.get(k) || by.set(k, []).get(k)).push(v);
  return new Map([...by].map(([k, v]) => [k, { typical: median(v), lo: quantile(v, 0.1), hi: quantile(v, 0.9) }]));
}
