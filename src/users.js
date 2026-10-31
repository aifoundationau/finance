// Registered people. Everyone signs in with Google; the first sign-in registers the person with
// the AI Foundation's standard role, "supporter". Later sign-ins never change a role, so a role
// given elsewhere (by an administrator or another AI Foundation app) is kept.
//   firestore  the shared AI Foundation directory in the Firebase project: a Firebase Auth account
//              (found by Google ID or email, else created and linked to Google, so the person is
//              the same user in every AI Foundation app) and its users/{uid} profile in the
//              project's (default) database, in the shape the other apps write.
//   otherwise  an "app/users" document in this app's own storage (data/users.json locally).
import { firebaseApp, storage } from "./storage.js";

export const DEFAULT_ROLE = "supporter";
// Shared profiles live in the (default) database, not in this app's own (FIRESTORE_DATABASE_ID).
const SHARED_DATABASE = "(default)";
const APP_ID = "my-asx-options";

/** Signs in a Google-verified person, registering them on their first visit. */
export async function registerUser(profile, { directory } = {}) {
  directory ??= storage().kind === "firestore" ? await sharedDirectory() : localDirectory;
  const uid = await directory.uidFor(profile);
  const { role, created } = await directory.signIn(uid, profile);
  return { uid, email: profile.email, name: profile.name, role, created };
}

// ------------------------------------------------------------------ this app's storage

const localDirectory = {
  uidFor: async (profile) => `google_${profile.sub}`,
  signIn: (uid, { email, name }) =>
    storage().transact("app", "users", (doc) => {
      const now = new Date().toISOString();
      const existing = doc?.[uid];
      const user = existing ? { ...existing, email, name, lastLoginAt: now } : { uid, email, name, role: DEFAULT_ROLE, registeredAt: now, lastLoginAt: now };
      return { value: { ...doc, [uid]: user }, result: { role: user.role, created: !existing } };
    }),
};

// ------------------------------------------------------------------ shared AI Foundation directory

async function sharedDirectory() {
  const app = await firebaseApp();
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");
  return firebaseDirectory({ auth: getAuth(app), db: getFirestore(app, SHARED_DATABASE) });
}

const notFoundAsNull = async (lookup) => {
  try {
    return await lookup();
  } catch (err) {
    if (err.code === "auth/user-not-found") return null;
    throw err;
  }
};

/** The directory over firebase-admin's Auth and Firestore (passed in, so tests can use fakes). */
export function firebaseDirectory({ auth, db }) {
  return {
    async uidFor({ sub, email, name, picture }) {
      const found = (await notFoundAsNull(() => auth.getUserByProviderUid("google.com", sub))) ?? (await notFoundAsNull(() => auth.getUserByEmail(email)));
      if (found) return found.uid;
      const details = { ...(name ? { displayName: name } : {}), ...(picture ? { photoURL: picture } : {}) };
      let created;
      try {
        created = await auth.createUser({ email, emailVerified: true, ...details });
      } catch (err) {
        // Two sign-ins at once: the other one made the account first.
        if (err.code !== "auth/email-already-exists") throw err;
        return (await auth.getUserByEmail(email)).uid;
      }
      // Linked to the Google account, so signing in with Google in any AI Foundation app finds this
      // account. Not fatal: later sign-ins still find it by email.
      try {
        await auth.updateUser(created.uid, { providerToLink: { providerId: "google.com", uid: sub, email, ...details } });
      } catch (err) {
        console.warn(`[users] Could not link Google to new account ${created.uid}: ${err.message}`);
      }
      return created.uid;
    },

    signIn(uid, { email, name, picture }) {
      const ref = db.collection("users").doc(uid);
      return db.runTransaction(async (t) => {
        const snap = await t.get(ref);
        const now = new Date().toISOString();
        if (snap.exists) {
          const role = snap.get("role");
          t.update(ref, { lastLoginAt: now, updatedAt: now, ...(role ? {} : { role: DEFAULT_ROLE }) });
          return { role: String(role || DEFAULT_ROLE), created: false };
        }
        t.create(ref, {
          uid,
          email,
          displayName: name,
          photoURL: picture,
          tag: "aifoundation",
          businessId: "aifoundation",
          businessName: "AI Foundation",
          source: "aifoundation",
          authProvider: "google",
          role: DEFAULT_ROLE,
          status: DEFAULT_ROLE,
          classification: "Supporter",
          isSuperAdmin: false,
          registeredVia: APP_ID,
          registeredAt: now,
          createdAt: now,
          lastLoginAt: now,
          updatedAt: now,
        });
        return { role: DEFAULT_ROLE, created: true };
      });
    },
  };
}
