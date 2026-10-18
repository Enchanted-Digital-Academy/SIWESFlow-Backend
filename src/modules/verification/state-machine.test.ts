import assert from "node:assert/strict";
import { test } from "node:test";
import { canTransition, SUBMITTABLE } from "./state-machine.js";

test("follows pending -> under review -> verified/rejected", () => {
  assert.ok(canTransition("UNVERIFIED", "SUBMITTED"));
  assert.ok(canTransition("SUBMITTED", "UNDER_REVIEW"));
  assert.ok(canTransition("UNDER_REVIEW", "VERIFIED"));
  assert.ok(canTransition("UNDER_REVIEW", "REJECTED"));
  assert.ok(canTransition("REJECTED", "SUBMITTED"));
});

test("forbids skipping review or leaving a final state", () => {
  assert.equal(canTransition("SUBMITTED", "VERIFIED"), false);
  assert.equal(canTransition("SUBMITTED", "REJECTED"), false);
  assert.equal(canTransition("UNVERIFIED", "VERIFIED"), false);
  assert.equal(canTransition("VERIFIED", "REJECTED"), false);
  assert.equal(canTransition("VERIFIED", "SUBMITTED"), false);
});

test("only unverified and rejected profiles can be submitted", () => {
  assert.deepEqual([...SUBMITTABLE].sort(), ["REJECTED", "UNVERIFIED"]);
});
