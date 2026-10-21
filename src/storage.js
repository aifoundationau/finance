// Persistence for everything the app keeps: reports, settings, the token economy and run status.
// One small document interface over two backends:
//   files      data/ on this computer (the default; same layout as before)
//   firestore  Cloud Firestore when FIREBASE_SERVICE_ACCOUNT is set, for hosts such as Vercel
//              whose file system is read-only and whose instances share nothing.
// Collections: "app" (settings, commerce), "reports" (one document per report) and "runtime"
// (run status; kept in memory by the files backend because it only matters while running).
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";
import { config } from "./config.js";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export const firestoreConfigured = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);

// ------------------------------------------------------------------ memory (runtime state, tests)

export class MemoryBackend {
  kind = "memory";
  docs = new Map(); // "collection/id" -> { value, meta, version }
  #chain = Promise.resolve();

  async get(collection, id) {
    const doc = this.docs.get(`${collection}/${id}`);
    return doc ? structuredClone(doc.value) : null;
  }

  async put(collection, id, value, meta = null) {
    const key = `${collection}/${id}`;
    this.docs.set(key, { value: structuredClone(value), meta, version: (this.docs.get(key)?.version ?? 0) + 1 });
  }

  /** fn(current) -> { value, result }; `value` undefined leaves the document unchanged. */
  transact(collection, id, fn) {
    const next = this.#chain.then(async () => {
      const { value, result } = await fn(await this.get(collection, id));
      if (value !== undefined) await this.put(collection, id, value);
      return result;
    });
    this.#chain = next.catch(() => {});
    return next;
  }

  async list(collection) {
    return [...this.docs.entries()]
      .filter(([key]) => key.startsWith(`${collection}/`))
      .map(([key, doc]) => ({ id: key.slice(collection.length + 1), meta: doc.meta, version: doc.version }));
  }
}

// ------------------------------------------------------------------ files under data/

class FileBackend {
  kind = "files";
  runtime = new MemoryBackend();
  #chains = new Map(); // file -> promise, so read-modify-write cycles on one file never overlap

  fileFor(collection, id) {
    if (collection === "app") return path.join(config.dataDir, `${id}.json`);
    if (collection === "reports") return path.join(config.reportsDir, `${id}.json`);
    throw new Error(`Unknown collection: ${collection}`);
  }

  async get(collection, id) {
    if (collection === "runtime") return this.runtime.get(collection, id);
    try {
      return JSON.parse(await fs.readFile(this.fileFor(collection, id), "utf8"));
    } catch {
      return null;
    }
  }

  async put(collection, id, value) {
    if (collection === "runtime") return this.runtime.put(collection, id, value);
    const file = this.fileFor(collection, id);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, collection === "app" ? 1 : 0));
    await fs.rename(tmp, file);
  }

  transact(collection, id, fn) {
    if (collection === "runtime") return this.runtime.transact(collection, id, fn);
    const file = this.fileFor(collection, id);
    const next = (this.#chains.get(file) ?? Promise.resolve()).then(async () => {
      const { value, result } = await fn(await this.get(collection, id));
      if (value !== undefined) await this.put(collection, id, value);
      return result;
    });
    this.#chains.set(file, next.catch(() => {}));
    return next;
  }

  /** [{ id, meta: null, version }]: files carry no stored summary, so callers summarise on read. */
  async list(collection) {
    const dir = collection === "reports" ? config.reportsDir : config.dataDir;
    let names;
    try {
      names = await fs.readdir(dir);
    } catch {
      return [];
    }
    const ids = names.filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -5));
    const out = await Promise.all(
      ids.map(async (id) => {
        try {
          return { id, meta: null, version: (await fs.stat(this.fileFor(collection, id))).mtimeMs };
        } catch {
          return null;
        }
      }),
    );
    return out.filter(Boolean);
  }
}

// ------------------------------------------------------------------ Cloud Firestore

/** FIREBASE_SERVICE_ACCOUNT holds the service-account key JSON, as is or base64-encoded. */
export function parseServiceAccount(raw) {
  const text = String(raw ?? "").trim();
  const json = text.startsWith("{") ? text : Buffer.from(text, "base64").toString("utf8");
  const key = JSON.parse(json);
  if (!key.project_id || !key.client_email || !key.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT is not a service-account key (needs project_id, client_email and private_key).");
  return key;
}

class FirestoreBackend {
  kind = "firestore";
  #db = null;

  async db() {
    if (this.#db) return this.#db;
    const { applicationDefault, cert, getApps, initializeApp } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    // "adc" uses this computer's Google login (gcloud auth application-default login) instead of a key.
    const adc = process.env.FIREBASE_SERVICE_ACCOUNT.trim().toLowerCase() === "adc";
    const key = adc ? null : parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
    const options = adc
      ? { credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || "ai-foundation-firebase" }
      : { credential: cert(key), projectId: key.project_id };
    const app = getApps().find((a) => a.name === "my-asx-options") ?? initializeApp(options, "my-asx-options");
    this.#db = getFirestore(app, process.env.FIRESTORE_DATABASE_ID || "(default)");
    return this.#db;
  }

  // Collections are prefixed so the app can share a Firebase project with other apps.
  prefix = process.env.FIRESTORE_COLLECTION_PREFIX || "myAsxOptions_";

  async ref(collection, id) {
    return (await this.db()).collection(`${this.prefix}${collection}`).doc(id);
  }

  // Documents are stored gzip-compressed: a report is ~80 KB of JSON and Firestore caps a
  // document at 1 MiB, so this leaves ample room as wallets and reports grow.
  static async encode(value, meta) {
    return { ...(meta ? { meta } : {}), body: await gzip(JSON.stringify(value)), updatedAt: new Date().toISOString() };
  }

  static async decode(snap) {
    if (!snap.exists) return null;
    const body = snap.get("body");
    return body ? JSON.parse((await gunzip(Buffer.from(body))).toString("utf8")) : null;
  }

  async get(collection, id) {
    return FirestoreBackend.decode(await (await this.ref(collection, id)).get());
  }

  async put(collection, id, value, meta = null) {
    await (await this.ref(collection, id)).set(await FirestoreBackend.encode(value, meta));
  }

  /** Runs in a Firestore transaction, so concurrent instances never lose each other's writes. */
  async transact(collection, id, fn) {
    const db = await this.db();
    const ref = await this.ref(collection, id);
    return db.runTransaction(async (t) => {
      const { value, result } = await fn(await FirestoreBackend.decode(await t.get(ref)));
      if (value !== undefined) t.set(ref, await FirestoreBackend.encode(value));
      return result;
    });
  }

  async list(collection) {
    const db = await this.db();
    const snap = await db.collection(`${this.prefix}${collection}`).select("meta", "updatedAt").get();
    return snap.docs.map((d) => ({ id: d.id, meta: d.get("meta") ?? null, version: d.get("updatedAt") }));
  }
}

// ------------------------------------------------------------------ selection

let backend = null;

/** The active backend: Firestore when configured, otherwise files under data/. */
export function storage() {
  backend ??= firestoreConfigured() ? new FirestoreBackend() : new FileBackend();
  return backend;
}

/** Test hook: swap in a backend (for example a fresh MemoryBackend). */
export function _useBackendForTests(next) {
  backend = next;
  return next;
}
