import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEntry, normalizePatch, pageSize, searchLoadedPage
} from "../model.mjs";

const base = { kind: "note", title: "Number theory" };
test("valid records get explicit safe defaults", () => {
  assert.deepEqual(normalizeEntry(base), {
    schemaVersion: 1, kind: "note", subject: "other", status: "draft",
    title: "Number theory", summary: "", body: "", url: "", tags: []
  });
});
test("normalises and de-duplicates tags", () => {
  assert.deepEqual(normalizeEntry({
    ...base, tags: ["  GCSE ", "gcse", "Olympiad"]
  }).tags, ["gcse", "olympiad"]);
});
test("rejects unsafe links, unknown fields and oversized bodies", () => {
  assert.throws(() => normalizeEntry({ ...base, url: "javascript:alert(1)" }));
  assert.throws(() => normalizeEntry({ ...base, ownerUid: "attacker" }));
  assert.throws(() => normalizeEntry({ ...base, body: "x".repeat(20001) }));
});
test("only approved fields can be edited", () => {
  assert.deepEqual(normalizePatch({ title: "Updated" }), { title: "Updated" });
  assert.throws(() => normalizePatch({ ownerUid: "hijack" }));
  assert.throws(() => normalizePatch({ kind: "project" }));
  assert.throws(() => normalizePatch({}));
});
test("bounded reads cannot request unlimited pages", () => {
  assert.equal(pageSize(), 20);
  assert.equal(pageSize(25), 25);
  assert.throws(() => pageSize(26));
  assert.throws(() => pageSize(0));
  assert.throws(() => pageSize(1.5));
});
test("local search covers title, tags and subject without network calls", () => {
  const rows = [
    { title: "Maxwell", summary: "", subject: "physics", tags: ["electricity"] },
    { title: "BMO", summary: "", subject: "mathematics", tags: ["olympiad"] }
  ];
  assert.equal(searchLoadedPage(rows, "electric").length, 1);
  assert.equal(searchLoadedPage(rows, "math").length, 1);
});
