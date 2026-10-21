import assert from "node:assert/strict";
import { test } from "node:test";
import { canEdit, checkNotFuture, checkWithinPeriod } from "./activity.rules.js";

// UTC, because that is what the routes hand these: `2026-06-15` parses to UTC
// midnight and Postgres DateTime comes back UTC.
const d = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  new Date(Date.UTC(year, month - 1, day, hour, minute));

const now = d(2026, 10, 21);

test("allows today and earlier, rejects tomorrow", () => {
  assert.ok(checkNotFuture(d(2026, 10, 21), now).ok);
  assert.ok(checkNotFuture(d(2026, 10, 20), now).ok);
  assert.equal(checkNotFuture(d(2026, 10, 22), now).ok, false);
});

test("allows any late-hour timestamp on today", () => {
  assert.ok(checkNotFuture(d(2026, 10, 21, 23, 59), now).ok);
  assert.equal(checkNotFuture(d(2026, 10, 22, 0, 5), now).ok, false);
});

test("allows an entry from the last hour of today when the clock is already past midnight UTC", () => {
  // now is 00:20 UTC on the 22nd, but a student who logged 23:40 on the 21st
  // must not be told that is the future.
  const lateNow = d(2026, 10, 22, 0, 20);
  assert.ok(checkNotFuture(d(2026, 10, 21, 23, 40), lateNow).ok);
});

test("accepts a student's own today when the UTC clock is still a day behind", () => {
  // 23:30 UTC is 00:30 in Lagos: logging on the day that just begun locally is
  // not logging in the future.
  const utcStillYesterday = d(2026, 10, 20, 23, 30);
  assert.ok(checkNotFuture(d(2026, 10, 21), utcStillYesterday).ok);
  assert.equal(checkNotFuture(d(2026, 10, 22), utcStillYesterday).ok, false);
});

test("accepts a date inside the SIWES period", () => {
  const window = { start: d(2026, 5, 4), end: d(2026, 8, 24) };
  assert.ok(checkWithinPeriod(d(2026, 6, 15), window).ok);
});

test("treats both period bounds as inclusive days", () => {
  const window = { start: d(2026, 5, 4), end: d(2026, 8, 24) };
  assert.ok(checkWithinPeriod(d(2026, 5, 4), window).ok);
  assert.ok(checkWithinPeriod(d(2026, 5, 4, 23, 59), window).ok);
  assert.ok(checkWithinPeriod(d(2026, 8, 24), window).ok);
  assert.ok(checkWithinPeriod(d(2026, 8, 24, 23, 30), window).ok);
});

test("rejects a date outside the SIWES period", () => {
  const window = { start: d(2026, 5, 4), end: d(2026, 8, 24) };
  assert.equal(checkWithinPeriod(d(2026, 5, 3), window).ok, false);
  assert.equal(checkWithinPeriod(d(2026, 8, 25), window).ok, false);
});

test("skips the period check when no dates are on record", () => {
  assert.ok(checkWithinPeriod(d(1999, 1, 1), { start: null, end: null }).ok);
});

test("validates against a one-sided period", () => {
  assert.ok(checkWithinPeriod(d(2026, 12, 31), { start: d(2026, 5, 4), end: null }).ok);
  assert.equal(checkWithinPeriod(d(2026, 5, 3), { start: d(2026, 5, 4), end: null }).ok, false);
  assert.equal(checkWithinPeriod(d(2026, 8, 25), { start: null, end: d(2026, 8, 24) }).ok, false);
});

test("an entry is editable while it awaits review or was sent back", () => {
  assert.ok(canEdit("PENDING"));
  assert.ok(canEdit("NEEDS_REVISION"));
  assert.equal(canEdit("APPROVED"), false);
  assert.equal(canEdit("REJECTED"), false);
});
