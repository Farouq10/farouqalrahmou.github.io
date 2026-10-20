import {before,after,beforeEach,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(process.env.ALPHA_TEST_MODULES || new URL('../package.json',import.meta.url));
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,getDocs,collection,query,limit,serverTimestamp,updateDoc,deleteDoc}=require('firebase/firestore');
let env;
const snapshot=(version=1)=>({version,payload:{progress:{},reviews:[],prefs:{},modified:1},savedAt:serverTimestamp()});
const resource=()=>({title:'My maths notes',url:'https://example.com/',note:'Private notes',updatedAt:serverTimestamp()});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-alpha',firestore:{host:'127.0.0.1',port:8180,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}})});
beforeEach(async()=>{await env.clearFirestore()});
after(async()=>{await env?.cleanup()});
test('a signed-in user can save and read their own progress',async()=>{
 const db=env.authenticatedContext('alice').firestore(),ref=doc(db,'users/alice/state/main');
 await assertSucceeds(setDoc(ref,snapshot()));await assertSucceeds(getDoc(ref));await assertSucceeds(setDoc(ref,snapshot(2)));
});
test('another account and anonymous visitors cannot read or write progress',async()=>{
 const alice=env.authenticatedContext('alice').firestore(),bob=env.authenticatedContext('bob').firestore(),anon=env.unauthenticatedContext().firestore();
 await setDoc(doc(alice,'users/alice/state/main'),snapshot());
 for(const db of [bob,anon]){await assertFails(getDoc(doc(db,'users/alice/state/main')));await assertFails(setDoc(doc(db,'users/alice/state/main'),snapshot(2)))}
 await assertFails(getDocs(collection(alice,'users/alice/state')));
});
test('version conflicts, oversized histories and extra account roles are rejected',async()=>{
 const db=env.authenticatedContext('alice').firestore(),ref=doc(db,'users/alice/state/main');
 await assertFails(setDoc(ref,snapshot(9)));await setDoc(ref,snapshot());
 await assertFails(setDoc(ref,snapshot()));const tooBig=snapshot(2);tooBig.payload.reviews=Array(2001).fill({id:'a'});await assertFails(setDoc(ref,tooBig));
 await assertFails(setDoc(ref,{...snapshot(2),siteAdmin:true}));await assertFails(setDoc(doc(db,'users/alice'),{siteAdmin:true}));
});
test('a verified owner can manage private resources',async()=>{
 const db=env.authenticatedContext('owner',{siteAdmin:true,email_verified:true}).firestore(),ref=doc(db,'users/owner/resources/note1');
 await assertSucceeds(setDoc(ref,resource()));await assertSucceeds(getDoc(ref));
 await assertSucceeds(getDocs(query(collection(db,'users/owner/resources'),limit(100))));
 await assertSucceeds(updateDoc(ref,{note:'Changed',updatedAt:serverTimestamp()}));await assertSucceeds(deleteDoc(ref));
});
test('friends, visitors, an unverified owner and other admins cannot access owner resources',async()=>{
 const owner=env.authenticatedContext('owner',{siteAdmin:true,email_verified:true}).firestore();await setDoc(doc(owner,'users/owner/resources/note1'),resource());
 const contexts=[env.authenticatedContext('friend'),env.unauthenticatedContext(),env.authenticatedContext('owner',{siteAdmin:true,email_verified:false}),env.authenticatedContext('other-admin',{siteAdmin:true,email_verified:true})];
 for(const context of contexts){const db=context.firestore();await assertFails(getDoc(doc(db,'users/owner/resources/note1')));await assertFails(getDocs(query(collection(db,'users/owner/resources'),limit(100))));await assertFails(setDoc(doc(db,'users/owner/resources/note2'),resource()))}
});
test('self-assigned roles and executable resource URLs are rejected',async()=>{
 const db=env.authenticatedContext('friend',{email_verified:true}).firestore();await assertFails(setDoc(doc(db,'users/friend/resources/test'),{...resource(),siteAdmin:true}));
 const owner=env.authenticatedContext('owner',{siteAdmin:true,email_verified:true}).firestore();await assertFails(setDoc(doc(owner,'users/owner/resources/test'),{...resource(),url:'javascript:alert(1)'}));await assertFails(getDocs(collection(owner,'users/owner/resources')));
});
