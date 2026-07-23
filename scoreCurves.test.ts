// backend/test/scoreCurves.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { WAD_ONE, WAD_ZERO } from "../wad/wadTypes";
import {
  numberToWad,
  scoreLowerIsBetter,
  scoreHigherIsBetter,
  scoreTier,
  scoreBoolean,
} from "../normalize/scoreCurves";

test("numberToWad: converts whole numbers correctly", () => {
  assert.equal(numberToWad(5), 5n * WAD_ONE);
});

test("numberToWad: converts decimals correctly", () => {
  assert.equal(numberToWad(0.5), WAD_ONE / 2n);
});

test("numberToWad: handles negative numbers", () => {
  assert.equal(numberToWad(-2.5), -25n * (WAD_ONE / 10n));
});

test("scoreLowerIsBetter: below bestAt scores 1.0", () => {
  const result = scoreLowerIsBetter(numberToWad(10), numberToWad(20), numberToWad(90));
  assert.equal(result, WAD_ONE);
});

test("scoreLowerIsBetter: above worstAt scores 0.0", () => {
  const result = scoreLowerIsBetter(numberToWad(95), numberToWad(20), numberToWad(90));
  assert.equal(result, WAD_ZERO);
});

test("scoreLowerIsBetter: midpoint scores ~0.5", () => {
  const result = scoreLowerIsBetter(numberToWad(55), numberToWad(20), numberToWad(90));
  // midpoint of [20,90] is 55 -> penalty 0.5 -> score 0.5
  assert.equal(result, WAD_ONE / 2n);
});

test("scoreHigherIsBetter: above bestAt scores 1.0", () => {
  const result = scoreHigherIsBetter(numberToWad(800), numberToWad(580), numberToWad(760));
  assert.equal(result, WAD_ONE);
});

test("scoreHigherIsBetter: below worstAt scores 0.0", () => {
  const result = scoreHigherIsBetter(numberToWad(500), numberToWad(580), numberToWad(760));
  assert.equal(result, WAD_ZERO);
});

test("scoreTier: returns table value for known category", () => {
  const table = { good: numberToWad(1), bad: numberToWad(0) };
  assert.equal(scoreTier("good", table), numberToWad(1));
});

test("scoreTier: returns default for unknown category", () => {
  const table = { good: numberToWad(1) };
  assert.equal(scoreTier("unknown", table, numberToWad(0.5)), numberToWad(0.5));
});

test("scoreBoolean: returns correct branch", () => {
  assert.equal(scoreBoolean(true, numberToWad(1), numberToWad(0)), numberToWad(1));
  assert.equal(scoreBoolean(false, numberToWad(1), numberToWad(0)), numberToWad(0));
});
