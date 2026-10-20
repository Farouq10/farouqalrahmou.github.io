import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createAccountSync} from '../sync.js';
const require=createRequire(process.env.ALPHA_TEST_MODULES || new URL('../package.json',import.meta.url));
const appSdk=require('firebase/app'),authSdk=require('firebase/auth'),dbSdk=require('firebase/firestore');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const waitFor=async predicate=>{const start=Date.now();while(!predicate()){if(Date.now()-start>10000)throw Error('Timed out waiting for account state');await new Promise(r=>setTimeout(r,15))}};
test('real email sign-up, password reset and account switching keep cloud progress separate',async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-alpha',firestore:{host:'127.0.0.1',port:8180,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
 await env.clearFirestore();let app,auth,db,api;const sessions=[];
 const modules={
  appMod:{...appSdk,initializeApp(config){app=appSdk.initializeApp(config,'sync-integration');return app}},
  authMod:{...authSdk,browserSessionPersistence:authSdk.inMemoryPersistence,getAuth(a){auth=authSdk.getAuth(a);authSdk.connectAuthEmulator(auth,'http://127.0.0.1:9199',{disableWarnings:true});return auth}},
  dbMod:{...dbSdk,getFirestore(a){db=dbSdk.getFirestore(a);dbSdk.connectFirestoreEmulator(db,'127.0.0.1',8180);return db}}
 };
 try{
  api=await createAccountSync(modules,{onReady:()=>{},onSession:(user,remote,status)=>sessions.push({uid:user?.uid||null,remote,status}),onNotice:()=>{}},{apiKey:'demo-key',projectId:'demo-alpha',authDomain:'demo-alpha.firebaseapp.com',appId:'demo-app'});
  await waitFor(()=>sessions.some(s=>s.status==='guest'));
  await api.signup('alpha-alice@example.com','Alice-password-123');await waitFor(()=>api.connected());const alice=api.currentUser().uid;
  const payload={progress:{a:{dueAt:1,stability:1,lastAt:1}},reviews:[{id:'a',at:1,grade:2}],prefs:{selected:[]},modified:10};
  await api.save(payload,alice);assert.equal(api.isOwner(),false);await assert.rejects(api.resources(),/private/);
  await api.logout();assert.equal(api.currentUser(),null);assert.equal(sessions.at(-1).uid,null);
  await api.signup('alpha-bob@example.com','Bob-password-123');await waitFor(()=>api.connected());const bob=api.currentUser().uid;assert.notEqual(alice,bob);assert.equal(sessions.at(-1).remote,null);
  await assert.rejects(api.save(payload,alice),/Account changed/);
  await api.save({...payload,reviews:[],progress:{},modified:20},bob);await api.logout();
  await api.loginEmail('alpha-alice@example.com','Alice-password-123');await waitFor(()=>api.connected());assert.equal(api.currentUser().uid,alice);assert.equal(sessions.at(-1).remote.reviews.length,1);assert.equal(sessions.at(-1).remote.modified,10);
  // Optimistic revisions must reject a newer remote write by a second device.
  await dbSdk.setDoc(dbSdk.doc(db,'users',alice,'state','main'),{version:2,payload:{...payload,modified:30},savedAt:dbSdk.serverTimestamp()});
  await assert.rejects(api.save(payload,alice),/Another device/);
  await api.resetPassword('alpha-alice@example.com');
  const codes=await (await fetch('http://127.0.0.1:9199/emulator/v1/projects/demo-alpha/oobCodes')).json();
  assert.ok(codes.oobCodes.some(c=>c.email==='alpha-alice@example.com'&&c.requestType==='VERIFY_EMAIL'));
  const reset=codes.oobCodes.find(c=>c.email==='alpha-alice@example.com'&&c.requestType==='PASSWORD_RESET');assert.ok(reset);
  await authSdk.confirmPasswordReset(auth,reset.oobCode,'New-Alice-password-123');await api.logout();
  await api.loginEmail('alpha-alice@example.com','New-Alice-password-123');await waitFor(()=>api.connected());assert.equal(api.currentUser().uid,alice);
 }finally{if(api)await api.logout();if(db)await dbSdk.terminate(db);if(app)await appSdk.deleteApp(app);await env.cleanup()}
});
