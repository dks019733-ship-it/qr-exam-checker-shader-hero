import assert from "node:assert/strict";
import test from "node:test";
import { getOmrBubbleCenter } from "../lib/omr-layout.ts";

test("OMR V1 maps first and last question rows to calibrated coordinates", () => {
  assert.deepEqual(getOmrBubbleCenter(1, 0, 4), { x: 121.625, y: 313 });
  assert.deepEqual(getOmrBubbleCenter(50, 3, 4), { x: 347.375, y: 999 });
  assert.deepEqual(getOmrBubbleCenter(51, 0, 4), { x: 476.625, y: 313 });
  assert.deepEqual(getOmrBubbleCenter(100, 4, 5), { x: 747.9, y: 999 });
});

test("OMR V1 supports both four-choice and five-choice grids", () => {
  assert.equal(getOmrBubbleCenter(1, 3, 4).x, 347.375);
  assert.equal(getOmrBubbleCenter(1, 4, 5).x, 354.9);
});

test("OMR V1 rejects invalid question and choice coordinates", () => {
  assert.throws(() => getOmrBubbleCenter(0, 0, 4), RangeError);
  assert.throws(() => getOmrBubbleCenter(101, 0, 4), RangeError);
  assert.throws(() => getOmrBubbleCenter(1, 4, 4), RangeError);
  assert.throws(() => getOmrBubbleCenter(1, 0, 3), RangeError);
});
