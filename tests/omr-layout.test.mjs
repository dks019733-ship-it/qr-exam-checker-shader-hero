import assert from "node:assert/strict";
import test from "node:test";
import { getOmrBubbleCenter } from "../lib/omr-layout.ts";

test("OMR V1 maps first and last question rows to calibrated coordinates", () => {
  assert.deepEqual(getOmrBubbleCenter(1, 0, 4, 100), { x: 122.625, y: 314 });
  assert.deepEqual(getOmrBubbleCenter(50, 3, 4, 100), { x: 348.375, y: 1000 });
  assert.deepEqual(getOmrBubbleCenter(51, 0, 4, 100), { x: 477.625, y: 314 });
  assert.deepEqual(getOmrBubbleCenter(100, 4, 5, 100), { x: 710.9, y: 1000 });
});

test("OMR V1 supports both four-choice and five-choice grids", () => {
  assert.equal(getOmrBubbleCenter(1, 3, 4, 100).x, 348.375);
  assert.equal(getOmrBubbleCenter(1, 4, 5, 100).x, 355.9);
});

test("OMR V1 balances short exams across both columns", () => {
  assert.deepEqual(getOmrBubbleCenter(20, 0, 4, 40), { x: 122.625, y: 580 });
  assert.deepEqual(getOmrBubbleCenter(21, 0, 4, 40), { x: 477.625, y: 314 });
  assert.deepEqual(getOmrBubbleCenter(40, 3, 4, 40), { x: 703.375, y: 580 });
});

test("OMR V1 rejects invalid question and choice coordinates", () => {
  assert.throws(() => getOmrBubbleCenter(0, 0, 4, 100), RangeError);
  assert.throws(() => getOmrBubbleCenter(101, 0, 4, 100), RangeError);
  assert.throws(() => getOmrBubbleCenter(1, 4, 4, 100), RangeError);
  assert.throws(() => getOmrBubbleCenter(1, 0, 3, 100), RangeError);
});
