// Copies this app's documents, unchanged, from one Firestore database to another in the same
// project. Used to move the app from the shared "(default)" database to its own "finance" one.
//   node scripts/copy-firestore.js "(default)" finance
// Documents already in the target are overwritten. Signs in like the app (FIREBASE_SERVICE_ACCOUNT).
import "../src/config.js";
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { parseServiceAccount } from "../src/storage.js";

const [from, to] = process.argv.slice(2);
if (!from || !to || from === to) {
  console.error('Usage: node scripts/copy-firestore.js <from database> <to database>, e.g. "(default)" finance');
  process.exit(1);
}

const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT ?? "").trim();
if (!raw) {
  console.error("FIREBASE_SERVICE_ACCOUNT is not set (a service-account key, or adc).");
  process.exit(1);
}
const adc = raw.toLowerCase() === "adc";
const key = adc ? null : parseServiceAccount(raw);
const app = initializeApp(
  adc
    ? { credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || "ai-foundation-firebase" }
    : { credential: cert(key), projectId: key.project_id },
);
const source = getFirestore(app, from);
const target = getFirestore(app, to);
const prefix = process.env.FIRESTORE_COLLECTION_PREFIX || "myAsxOptions_";

for (const name of ["app", "reports", "runtime"].map((c) => `${prefix}${c}`)) {
  const snap = await source.collection(name).get();
  for (const doc of snap.docs) await target.collection(name).doc(doc.id).set(doc.data());
  const copied = await target.collection(name).count().get();
  console.log(`${name}: ${snap.size} copied; ${copied.data().count} now in "${to}"`);
}
