import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_SNAPSHOT } from "./demo-data.mjs";

test("public demo data is deterministic and contains no personal paths", () => {
  assert.equal(DEMO_SNAPSHOT.mode, "demo");
  assert.equal(DEMO_SNAPSHOT.status, "ready");
  assert.equal(DEMO_SNAPSHOT.visibleSignals.length, 5);
  for (const signal of DEMO_SNAPSHOT.visibleSignals) {
    assert.match(signal.source.path, /^samples\//);
    assert.doesNotMatch(JSON.stringify(signal), /\/Users\/|~\/|@[a-z0-9.-]+\.[a-z]{2,}/i);
  }
});
