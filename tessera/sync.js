import {firebaseConfig} from "./firebase-config.js";
/*
  Optional sync. Google signs the user in; Firestore keeps only review progress,
  no flashcard text and no passwords. Firestore rules restrict reads/writes to
  the authenticated user's own document.
*/
export async function bootSync({onReady,onRemote,onNotice}){
  if(!firebaseConfig?.apiKey||!firebaseConfig?.authDomain||!firebaseConfig?.projectId||!firebaseConfig?.appId)return null;
  const [appMod,authMod,dbMod]=await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js")
  ]);
  const app=appMod.initializeApp(firebaseConfig,"tessera");
  const auth=authMod.getAuth(app),db=dbMod.getFirestore(app);
  const provider=new authMod.GoogleAuthProvider();
  let uid=null,rev=0,ready=false;
  const docFor=id=>dbMod.doc(db,"users",id,"state","main");
  const api={
    connected:()=>Boolean(uid&&ready),
    login:()=>authMod.signInWithPopup(auth,provider),
    logout:()=>authMod.signOut(auth),
    async save(data){
      if(!uid||!ready)throw Error("Not signed in");
      const id=uid;
      const next=await dbMod.runTransaction(db,async tx=>{
        const ref=docFor(id),snapshot=await tx.get(ref),version=snapshot.exists()?snapshot.data().version||0:0;
        if(version!==rev)throw Error("Another device changed your progress. Export a backup, then reload to reconcile.");
        const nextVersion=version+1;
        tx.set(ref,{version:nextVersion,payload:structuredClone(data),savedAt:dbMod.serverTimestamp()});
        return nextVersion;
      },{maxAttempts:2});
      if(uid===id)rev=next;
    }
  };
  onReady(api);
  authMod.onAuthStateChanged(auth,async user=>{
    ready=false;
    if(!user){uid=null;rev=0;onReady(api);return}
    uid=user.uid;
    try{
      const snapshot=await dbMod.getDoc(docFor(uid));
      rev=snapshot.exists()?snapshot.data().version||0:0;
      ready=true;onReady(api);
      if(snapshot.exists()&&snapshot.data().payload)await onRemote(snapshot.data().payload);
      else onNotice("Google sync connected. New reviews will be saved to the cloud.");
    }catch(error){ready=false;onReady(api);onNotice("Could not load cloud data: "+error.message)}
  });
  return api;
}
