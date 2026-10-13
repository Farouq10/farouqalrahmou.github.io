// Run only from a trusted local machine with Application Default Credentials.
// Never place service-account JSON, refresh tokens or admin credentials in Git.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf("--" + name);
  return index >= 0 ? args[index + 1] : undefined;
};
const projectId = option("project");
const uid = option("uid");
const action = option("action");
const confirmation = option("confirm");
if (!projectId || !uid || !["grant", "revoke"].includes(action) ||
    confirmation !== projectId) {
  console.error("Usage: npm run admin -- --project PROJECT_ID --uid AUTH_UID --action grant|revoke --confirm PROJECT_ID");
  process.exit(2);
}
const app = initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const user = await auth.getUser(uid);
const claims = { ...(user.customClaims ?? {}) };
if (action === "grant") claims.siteAdmin = true;
else delete claims.siteAdmin;
await auth.setCustomUserClaims(uid, claims);
console.log(action + " siteAdmin for UID " + uid + " in " + projectId);
console.log("The user must refresh their ID token (normally sign out/in).");
