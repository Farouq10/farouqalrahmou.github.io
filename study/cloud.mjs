/**
 * Optional Firebase cloud adapter (unloaded when no project is configured).
 * Uses Auth + Firestore with optimistic version checks.
 * A same-user doc is stored at studyProgress/{uid}.
 */
import { firebaseConfig } from "./firebase-config.mjs";

export function cloudIsConfigured(){
  return Boolean(firebaseConfig &&
    typeof firebaseConfig.apiKey==="string" &&
    typeof firebaseConfig.projectId==="string" &&
    typeof firebaseConfig.appId==="string" &&
    typeof firebaseConfig.authDomain==="string");
}
export async function openCloud(){
  if(!cloudIsConfigured())throw new Error("Firebase project not configured");
  const root="https://www.gstatic.com/firebasejs/13.0.0/";
  const [appSdk,authSdk,dbSdk]=await Promise.all([
    import(root+"firebase-app.js"),
    import(root+"firebase-auth.js"),
    import(root+"firebase-firestore.js")
  ]);
  const app=appSdk.getApps().find(x=>x.name==="scientific-study") ??
    appSdk.initializeApp(firebaseConfig,"scientific-study");
  const auth=authSdk.getAuth(app);
  const db=dbSdk.getFirestore(app);
  const provider=new authSdk.GoogleAuthProvider();
  const refFor=uid=>dbSdk.doc(db,"studyProgress",uid);
  return {
    onAuth: callback=>authSdk.onAuthStateChanged(auth,callback),
    user:()=>auth.currentUser,
    async signIn(){
      await authSdk.setPersistence(auth,authSdk.browserLocalPersistence);
      return authSdk.signInWithPopup(auth,provider);
    },
    signOut:()=>authSdk.signOut(auth),
    async read(uid){
      if(!auth.currentUser||auth.currentUser.uid!==uid)
        throw new Error("Not signed into the requested account");
      const snapshot=await dbSdk.getDocFromServer(refFor(uid));
      return snapshot.exists()?snapshot.data():null;
    },
    async push(uid,session,expectedVersion){
      if(!auth.currentUser||auth.currentUser.uid!==uid)
        throw new Error("Cloud account changed; please sign in again");
      if(!Number.isInteger(expectedVersion)||expectedVersion<0)
        throw new Error("Invalid cloud version");
      const nextVersion=expectedVersion+1;
      await dbSdk.runTransaction(db,async tx=>{
        const target=refFor(uid),snapshot=await tx.get(target);
        const version=snapshot.exists()?snapshot.data().version:0;
        if(version!==expectedVersion) {
          const e=new Error("Cloud progress was changed elsewhere");
          e.code="study/conflict";
          throw e;
        }
        const contents={
          schema:1,version:nextVersion,session:structuredClone(session),
          updatedAt:dbSdk.serverTimestamp()
        };
        tx.set(target,contents);
      },{maxAttempts:3});
      return nextVersion;
    }
  };
}
