// node --test tools/lib/eta.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { quantile, remaining, simulate, spread, STALE } from "./eta.mjs";

const durs = [20, 22, 25, 28, 30, 31, 33, 36, 40, 45, 60, 90];

test("quantile interpolates and spread needs six durations", () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(spread([30, 31, 32]), null);
  const s = spread(durs);
  assert.ok(s.lo < s.typical && s.typical < s.mean && s.mean < s.hi + 40, "skewed to the right: the mean is above the median");
});

test("a running slice is predicted from the longer durations, a leftover from nothing", () => {
  const r = remaining(durs, 35);
  assert.ok(r.typical > 0 && r.lo <= r.typical && r.typical <= r.hi);
  assert.deepEqual(remaining(durs, STALE + 1).sample, [5]);
  assert.ok(remaining(durs, 120).typical >= 5, "past every duration: a third of the elapsed time again");
});

test("the simulation is repeatable and a sum of medians is shorter than its median", () => {
  const once = (rnd) => new Map([["sum", Array.from({ length: 8 }, () => durs[Math.floor(rnd() * durs.length)]).reduce((a, b) => a + b, 0)]]);
  const a = simulate(once, 7).get("sum"), b = simulate(once, 7).get("sum");
  assert.deepEqual(a, b);
  assert.ok(a.typical > 8 * spread(durs).typical);
  assert.ok(a.lo < a.typical && a.typical < a.hi);
});
