import test, { before, beforeEach, after } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment, assertFails, assertSucceeds
} from "@firebase/rules-unit-testing";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp
} from "firebase/firestore";

let env;
let anon;
let user;
let admin;
const col = (db) => collection(db, "libraryEntries");
const entry = (db, id = "example") => doc(col(db), id);
const fixture = (patch = {}) => ({
  schemaVersion: 1, kind: "note", subject: "mathematics", status: "published",
  title: "Test note", summary: "", body: "", url: "", tags: ["olympiad"],
  ownerUid: "admin-user",
  createdAt: Timestamp.fromMillis(1000),
  updatedAt: Timestamp.fromMillis(1000),
  ...patch
});

before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Run through npm run test:rules (Firestore emulator required)");
  }
  env = await initializeTestEnvironment({
    projectId: "demo-scientific-library",
    firestore: { rules: readFileSync("firestore.rules", "utf8") }
  });
  anon = env.unauthenticatedContext().firestore();
  user = env.authenticatedContext("ordinary-user").firestore();
  admin = env.authenticatedContext("admin-user", { siteAdmin: true }).firestore();
});
beforeEach(async () => {
  await env.clearFirestore();
});
after(async () => {
  if (env) await env.cleanup();
});
async function seed(data = fixture()) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(entry(context.firestore()), data);
  });
}

test("published documents are public, drafts are private", async () => {
  await seed();
  await assertSucceeds(getDoc(entry(anon)));
  await seed(fixture({ status: "draft" }));
  await assertFails(getDoc(entry(anon)));
  await assertSucceeds(getDoc(entry(admin)));
});
test("public lists require a published filter and a bounded limit", async () => {
  await seed();
  await assertSucceeds(getDocs(query(col(anon),
    where("status", "==", "published"), orderBy("updatedAt", "desc"), limit(20))));
  await assertFails(getDocs(query(col(anon), limit(20))));
  await assertFails(getDocs(query(col(anon), where("status", "==", "published"))));
  await assertFails(getDocs(query(col(anon), where("status", "==", "published"), limit(26))));
});
test("unauthenticated and ordinary users cannot write", async () => {
  await assertFails(setDoc(entry(anon), fixture()));
  await assertFails(setDoc(entry(user), fixture()));
  await seed();
  await assertFails(updateDoc(entry(user), { title: "Bad edit" }));
  await assertFails(deleteDoc(entry(user)));
});
test("admin can create with server timestamps and delete", async () => {
  const data = fixture({
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  await assertSucceeds(setDoc(entry(admin), data));
  await assertSucceeds(deleteDoc(entry(admin)));
});
test("invalid schema and forged timestamps are denied", async () => {
  const valid = fixture({
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  await assertFails(setDoc(entry(admin, "unknown"), { ...valid, extra: "no" }));
  await assertFails(setDoc(entry(admin, "oversized"), {
    ...valid, body: "a".repeat(20001)
  }));
  await assertFails(setDoc(entry(admin, "fakeowner"), {
    ...valid, ownerUid: "ordinary-user"
  }));
  await assertFails(setDoc(entry(admin, "fakeclock"), {
    ...valid, createdAt: Timestamp.fromMillis(1000)
  }));
});
test("immutable ownership/creation fields cannot be changed", async () => {
  await seed();
  await assertFails(updateDoc(entry(admin), {
    ownerUid: "ordinary-user", updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(entry(admin), {
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(entry(admin), {
    title: "A safe update", updatedAt: serverTimestamp()
  }));
});
test("unknown collections are always denied", async () => {
  await assertFails(getDoc(doc(anon, "settings", "secrets")));
  await assertFails(setDoc(doc(admin, "settings", "secrets"), { any: true }));
});
