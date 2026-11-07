import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  STUDY_ID, EXPECTED_TRIALS, MAX_PLAYS, shuffled,
  validateConditions, makeSession, validSession, validRating, validResponseList
} from "../docs/lib/experiment.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const conditions = JSON.parse(fs.readFileSync(path.join(here, "../docs/conditions.json"), "utf8"));

test("conditions are exactly nine unique masked paths", () => {
  assert.equal(validateConditions(conditions).length, 9);
  assert.equal(new Set(conditions.map((x) => x.id)).size, 9);
  assert.ok(conditions.every((x) => !x.audio.includes("r_")));
  assert.throws(() => validateConditions(conditions.slice(1)));
});

test("shuffling preserves each condition once", () => {
  const ids = conditions.map((x) => x.id);
  assert.deepEqual([...shuffled(ids, () => 0)].sort(), [...ids].sort());
  assert.deepEqual([...shuffled(ids, () => 0.9999999)].sort(), [...ids].sort());
});

test("session has correct ID, order and progress", () => {
  const session = makeSession(
    conditions,
    { device: "headphones", ttsExperience: "rarely" },
    () => "ffba0b9e-8789-4d16-b39f-7937eaf514d8",
    () => "2026-11-07T00:00:00.000Z"
  );
  assert.equal(session.studyId, STUDY_ID);
  assert.equal(session.order.length, EXPECTED_TRIALS);
  assert.ok(validSession(session, conditions));
  assert.equal(MAX_PLAYS, 2);
  session.index = 10;
  assert.equal(validSession(session, conditions), false);
});

test("rating boundaries and response completeness", () => {
  assert.ok(validRating(1, 1));
  assert.ok(validRating(7, 5));
  assert.ok(!validRating(0, 1));
  assert.ok(!validRating(7, 6));
  assert.ok(!validRating("7", 5));
  const responses = conditions.map((c, i) => ({
    stimulusId: c.id,
    trialIndex: i + 1,
    joy: 1,
    naturalness: 5,
    playCount: 1
  }));
  assert.equal(validResponseList(responses), true);
  responses[0].playCount = 3;
  assert.equal(validResponseList(responses), false);
  responses[0].playCount = 1;
  responses[1].stimulusId = responses[0].stimulusId;
  assert.equal(validResponseList(responses), false);
});
