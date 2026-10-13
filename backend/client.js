// Browser-ready Firestore data-access layer; not imported by index.html yet.
// Uses pinned official Firebase ESM modules; no frontend framework required.
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getFirestore, connectFirestoreEmulator, collection, doc, query, where,
  orderBy, limit, startAfter, getDocs, getDoc, addDoc, serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import {
  getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  normalizeEntry, normalizePatch, pageSize, searchLoadedPage, KINDS, SUBJECTS
} from "./model.mjs";

const APP_NAME = "scientific-library";
const COLLECTION = "libraryEntries";

function validId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(value)) {
    throw new TypeError("Invalid document ID");
  }
  return value;
}

function unwrap(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

function verifyRevision(current, expected) {
  if (!expected || typeof expected.isEqual !== "function" ||
      !current.updatedAt || !current.updatedAt.isEqual(expected)) {
    throw new Error("Edit conflict: reload the latest entry before changing it");
  }
}

export function createLibraryBackend(config, { useEmulators = false } = {}) {
  if (!config || !config.apiKey || !config.projectId || !config.appId ||
      config.projectId === "YOUR_PROJECT") {
    throw new Error("A real Firebase web-app config is required");
  }
  const existing = getApps().find((item) => item.name === APP_NAME);
  if (existing && existing.options.projectId !== config.projectId) {
    throw new Error("Firebase app is already initialised for a different project");
  }
  const app = existing ?? initializeApp(config, APP_NAME);
  const db = getFirestore(app);
  const auth = getAuth(app);

  if (useEmulators) {
    if (!["localhost", "127.0.0.1"].includes(location.hostname)) {
      throw new Error("Emulators must only be used on localhost");
    }
    if (existing) throw new Error("Emulator mode must be selected before initialisation");
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }

  const entries = collection(db, COLLECTION);

  async function assertAdmin() {
    const user = auth.currentUser;
    if (!user || !(await user.getIdTokenResult()).claims.siteAdmin) {
      throw new Error("An authorised site administrator must sign in");
    }
    return user;
  }

  function listQuery({ published, kind, subject, size, cursor }) {
    if (kind && !KINDS.includes(kind)) throw new TypeError("Invalid kind filter");
    if (subject && !SUBJECTS.includes(subject)) throw new TypeError("Invalid subject filter");
    const constraints = [];
    if (published) constraints.push(where("status", "==", "published"));
    if (kind) constraints.push(where("kind", "==", kind));
    if (subject) constraints.push(where("subject", "==", subject));
    constraints.push(orderBy("updatedAt", "desc"), limit(pageSize(size)));
    if (cursor) constraints.push(startAfter(cursor));
    return query(entries, ...constraints);
  }

  async function listPublished(options = {}) {
    const snapshots = await getDocs(listQuery({ ...options, published: true }));
    return {
      items: snapshots.docs.map(unwrap),
      cursor: snapshots.docs.at(-1) ?? null
    };
  }

  async function listForAdmin(options = {}) {
    await assertAdmin();
    // Admin filters on kind/subject alone might require extra indexes:
    // fetch a bounded page, then filter locally or add an index deliberately.
    if (options.kind || options.subject) {
      throw new Error("Admin filtered listing is not supported; use listPublished or filter a page");
    }
    const snapshots = await getDocs(listQuery({ ...options, published: false }));
    return { items: snapshots.docs.map(unwrap), cursor: snapshots.docs.at(-1) ?? null };
  }

  async function getEntry(id) {
    const snapshot = await getDoc(doc(entries, validId(id)));
    return snapshot.exists() ? unwrap(snapshot) : null;
  }

  async function createEntry(input) {
    const user = await assertAdmin();
    const record = normalizeEntry(input);
    const reference = await addDoc(entries, {
      ...record, ownerUid: user.uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    return reference.id;
  }

  async function updateEntry(id, patch, expectedUpdatedAt) {
    await assertAdmin();
    const changes = normalizePatch(patch);
    const reference = doc(entries, validId(id));
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) throw new Error("Entry not found");
      const current = snapshot.data();
      verifyRevision(current, expectedUpdatedAt);
      const merged = normalizeEntry({
        kind: current.kind,
        subject: current.subject,
        status: current.status,
        title: current.title,
        summary: current.summary,
        body: current.body,
        url: current.url,
        tags: current.tags,
        ...changes
      });
      transaction.update(reference, { ...merged, updatedAt: serverTimestamp() });
    });
  }

  async function archiveEntry(id, expectedUpdatedAt) {
    return updateEntry(id, { status: "archived" }, expectedUpdatedAt);
  }

  async function deleteEntry(id, expectedUpdatedAt, { confirm = false } = {}) {
    if (confirm !== true) throw new Error("Explicit confirmation required for permanent deletion");
    await assertAdmin();
    const reference = doc(entries, validId(id));
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) throw new Error("Entry not found");
      verifyRevision(snapshot.data(), expectedUpdatedAt);
      transaction.delete(reference);
    });
  }

  return Object.freeze({
    app, db, auth,
    signInAdmin: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signOutAdmin: () => signOut(auth),
    isAdmin: async () => Boolean(auth.currentUser &&
      (await auth.currentUser.getIdTokenResult(true)).claims.siteAdmin),
    listPublished, listForAdmin, getEntry, createEntry,
    updateEntry, archiveEntry, deleteEntry, searchLoadedPage
  });
}
