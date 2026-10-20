import {firebaseConfig} from './firebase-config.js';
import {safeResourceUrl} from './account-state.mjs';
export const isConfigured = Boolean(firebaseConfig?.apiKey && firebaseConfig?.authDomain && firebaseConfig?.projectId && firebaseConfig?.appId);

// Firebase owns passwords and session tokens. No password is written to app storage.
export async function bootSync({onReady,onSession,onNotice}) {
  if(!isConfigured)return null;
  const [appMod,authMod,dbMod]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js')
  ]);
  return createAccountSync({appMod,authMod,dbMod}, {onReady,onSession,onNotice}, firebaseConfig);
}

// Kept separate so real Auth/Firestore emulators can test switching and saving.
export async function createAccountSync({appMod,authMod,dbMod},{onReady,onSession,onNotice},config){
  const app=appMod.initializeApp(config,'alpha');
  const auth=authMod.getAuth(app), db=dbMod.getFirestore(app);
  // Shared school computers should not retain a sign-in after the browser session.
  await authMod.setPersistence(auth,authMod.browserSessionPersistence);
  const provider=new authMod.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  let user=null, revision=0, ready=false, epoch=0, owner=false;
  const progressDoc=uid=>dbMod.doc(db,'users',uid,'state','main');
  const resourceCollection=uid=>dbMod.collection(db,'users',uid,'resources');
  function ownerUid(){if(!user || !ready || !owner)throw Error('This resource area is private.');return user.uid}
  const api={
    connected:()=>Boolean(user && ready),
    currentUser:()=>user,
    isOwner:()=>owner,
    loginGoogle:()=>authMod.signInWithPopup(auth,provider),
    loginEmail:(email,password)=>authMod.signInWithEmailAndPassword(auth,email,password),
    async signup(email,password){
      const result=await authMod.createUserWithEmailAndPassword(auth,email,password);
      try{await authMod.sendEmailVerification(result.user)}catch{onNotice('Account created. You can resend the verification email from Account.')}
      return result;
    },
    resetPassword:email=>authMod.sendPasswordResetEmail(auth,email),
    verifyEmail:()=>authMod.sendEmailVerification(auth.currentUser),
    async refresh(){if(auth.currentUser){await authMod.reload(auth.currentUser);await authMod.getIdToken(auth.currentUser,true);await receiveUser(auth.currentUser)}},
    async logout(){++epoch;ready=false;owner=false;user=null;revision=0;await onSession(null,null,'guest');onReady(api);await authMod.signOut(auth)},
    async save(data,expectedUid){
      if(!user || !ready || expectedUid!==user.uid)throw Error('Account changed before progress could save.');
      const uid=user.uid, generation=epoch, expectedRevision=revision;
      const next=await dbMod.runTransaction(db,async tx=>{
        if(generation!==epoch || uid!==user?.uid)throw Error('Account changed.');
        const ref=progressDoc(uid), snapshot=await tx.get(ref);
        const current=snapshot.exists()?snapshot.data().version || 0:0;
        if(current!==expectedRevision)throw Error('Another device saved newer progress. Reload before continuing.');
        tx.set(ref,{version:current+1,payload:structuredClone(data),savedAt:dbMod.serverTimestamp()});
        return current+1;
      },{maxAttempts:2});
      if(generation===epoch && user?.uid===uid)revision=next;
    },
    async resources(){
      const uid=ownerUid(), generation=epoch;
      const snap=await dbMod.getDocs(dbMod.query(resourceCollection(uid),dbMod.orderBy('updatedAt','desc'),dbMod.limit(100)));
      if(generation!==epoch || user?.uid!==uid)return [];
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    },
    async addResource({title,url,note}){
      const uid=ownerUid(), cleanUrl=safeResourceUrl(url);
      if(cleanUrl===null)throw Error('Use a full https:// link.');
      if(!title.trim() || title.length>160 || note.length>20000 || cleanUrl.length>2048)throw Error('Check the resource title and length.');
      await dbMod.addDoc(resourceCollection(uid),{title:title.trim(),url:cleanUrl,note,updatedAt:dbMod.serverTimestamp()});
    },
    async deleteResource(id){const uid=ownerUid();if(!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('Invalid resource.');await dbMod.deleteDoc(dbMod.doc(resourceCollection(uid),id))}
  };
  async function receiveUser(nextUser){
    const generation=++epoch;
    ready=false;owner=false;revision=0;user=nextUser;
    // Clear the old account immediately, before waiting for any network request.
    onReady(api);
    await onSession(nextUser,null,'loading');
    if(!nextUser){if(generation===epoch){await onSession(null,null,'guest');onReady(api)}return}
    try{
      const [snapshot,token]=await Promise.all([dbMod.getDoc(progressDoc(nextUser.uid)),authMod.getIdTokenResult(nextUser)]);
      if(generation!==epoch)return;
      revision=snapshot.exists()?snapshot.data().version || 0:0;
      owner=token.claims.siteAdmin===true && nextUser.emailVerified;
      await onSession(nextUser,snapshot.exists()?snapshot.data().payload:null,'loaded');
      if(generation!==epoch)return;
      ready=true;onReady(api);
    }catch(error){
      if(generation!==epoch)return;
      await onSession(nextUser,null,'error');onReady(api);
      onNotice('Cloud progress could not load. Your account data stays separate; try reloading.');
      console.warn('Cloud load failed:',error.code || error.message);
    }
  }
  onReady(api);
  authMod.onAuthStateChanged(auth,receiveUser);
  return api;
}
