// backend/test/wadMath.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { WAD_ONE, WAD_ZERO } from "../wad/wadTypes";
import {
  wmul,
  wdiv,
  wadd,
  wsub,
  toWad,
  bpsToWad,
  applyWeightBps,
  clampWad,
  wadToPctString,
  weightedComposite,
} from "../wad/wadMath";

test("wmul: multiplies two WAD values correctly", () => {
  const half = wdiv(toWad(1), toWad(2)); // 0.5
  const result = wmul(half, half); // 0.25
  assert.equal(result, toWad(1) / 4n);
});

test("wdiv: throws on division by zero", () => {
  assert.throws(() => wdiv(toWad(1), WAD_ZERO));
});

test("wsub: floors at zero instead of going negative", () => {
  assert.equal(wsub(toWad(1), toWad(2)), WAD_ZERO);
});

test("wadd: simple addition", () => {
  assert.equal(wadd(toWad(2), toWad(3)), toWad(5));
});

test("bpsToWad: converts basis points to WAD fraction", () => {
  assert.equal(bpsToWad(10000), WAD_ONE); // 100% = 1.0 WAD
  assert.equal(bpsToWad(5000), WAD_ONE / 2n); // 50%
});

test("applyWeightBps: applies a bps weight to a WAD value", () => {
  const result = applyWeightBps(toWad(1), 3500); // 35% of 1.0
  assert.equal(result, (WAD_ONE * 3500n) / 10000n);
});

test("clampWad: clamps within bounds", () => {
  assert.equal(clampWad(toWad(5), toWad(0), toWad(1)), toWad(1));
  assert.equal(clampWad(toWad(-5), toWad(0), toWad(1)), toWad(0));
  assert.equal(clampWad(toWad(0), toWad(0), toWad(1)) , toWad(0));
});

test("wadToPctString: formats WAD as percentage string", () => {
  assert.equal(wadToPctString(WAD_ONE), "100.00%");
  assert.equal(wadToPctString(WAD_ONE / 2n), "50.00%");
});

test("weightedComposite: matches manual weighted sum", () => {
  const scores = [toWad(1), toWad(1), toWad(0)]; // full, full, zero
  const weightsBps = [5000, 3000, 2000]; // 50%, 30%, 20%
  const composite = weightedComposite(scores, weightsBps);
  // Expect 0.5 + 0.3 + 0 = 0.8 WAD
  assert.equal(composite, (WAD_ONE * 8n) / 10n);
});

test("weightedComposite: throws on mismatched array lengths", () => {
  assert.throws(() => weightedComposite([toWad(1)], [5000, 5000]));
});
