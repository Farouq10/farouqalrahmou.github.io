// Shared client-side validation. Firestore Security Rules remain authoritative.
export const KINDS = Object.freeze(["note", "resource", "project"]);
export const SUBJECTS = Object.freeze([
  "mathematics", "physics", "chemistry", "engineering", "computing", "other"
]);
export const STATUSES = Object.freeze(["draft", "published", "archived"]);
export const PAGE_MAX = 25;
const FIELDS = ["kind", "subject", "status", "title", "summary", "body", "url", "tags"];
const MUTABLE = FIELDS.filter((key) => key !== "kind");

function boundedString(value, name, maximum, minimum = 0) {
  if (typeof value !== "string") throw new TypeError(name + " must be a string");
  const text = value.normalize("NFC").trim();
  if (text.length < minimum || text.length > maximum) {
    throw new RangeError(name + " must have " + minimum + "-" + maximum + " characters");
  }
  return text;
}

export function normalizeEntry(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Entry must be an object");
  }
  const unknown = Object.keys(input).filter((key) => !FIELDS.includes(key));
  if (unknown.length) throw new TypeError("Unknown entry fields: " + unknown.join(", "));
  const kind = input.kind;
  const subject = input.subject ?? "other";
  const status = input.status ?? "draft";
  if (!KINDS.includes(kind)) throw new TypeError("Invalid kind");
  if (!SUBJECTS.includes(subject)) throw new TypeError("Invalid subject");
  if (!STATUSES.includes(status)) throw new TypeError("Invalid status");
  const title = boundedString(input.title, "title", 160, 1);
  const summary = boundedString(input.summary ?? "", "summary", 2000);
  const body = boundedString(input.body ?? "", "body", 20000);
  const url = boundedString(input.url ?? "", "url", 2048);
  if (url && (!url.startsWith("https://") || /\s/.test(url))) {
    throw new TypeError("Only absolute HTTPS links are permitted");
  }
  if (!Array.isArray(input.tags) || input.tags.length > 8) {
    if (input.tags !== undefined) throw new TypeError("tags must be a list with <= 8 entries");
  }
  const tags = [...new Set((input.tags ?? []).map((value) =>
    boundedString(value, "tag", 40, 1).toLowerCase()
  ))];
  return { schemaVersion: 1, kind, subject, status, title, summary, body, url, tags };
}

export function normalizePatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new TypeError("Patch must be an object");
  }
  const keys = Object.keys(patch);
  if (!keys.length || keys.some((key) => !MUTABLE.includes(key))) {
    throw new TypeError("Only editable entry fields may be patched");
  }
  return { ...patch };
}

export function pageSize(value = 20) {
  if (!Number.isInteger(value) || value < 1 || value > PAGE_MAX) {
    throw new RangeError("pageSize must be an integer between 1 and 25");
  }
  return value;
}

// Deliberately searches an already-loaded page. This is NOT Firestore full-text search.
export function searchLoadedPage(entries, term) {
  if (!Array.isArray(entries)) throw new TypeError("Expected entries array");
  const query = boundedString(term, "term", 120).toLocaleLowerCase();
  if (!query) return entries;
  return entries.filter((entry) =>
    [entry.title, entry.summary, entry.subject, ...(entry.tags ?? [])]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(query))
  );
}
