/**
 * Redundant, same-browser persistence: localStorage + IndexedDB.
 * Saving a grade only commits the UI state AFTER at least one store
 * confirms success. This is not an off-device backup: clearing browser
 * site data can delete BOTH copies.
 */
import {
  SESSION_KEY,LEGACY_SESSION_KEY,newSession,restoreSession,isValidSession
} from "./queue.mjs";

const DB="study-progress-v3",STORE="progress",RECORD="current";
let dbPromise;
function openDB(){
  if(!dbPromise){
    dbPromise=new Promise((resolve,reject)=>{
      if(!("indexedDB" in globalThis)){reject(new Error("IndexedDB unavailable"));return;}
      const req=indexedDB.open(DB,1);
      req.onupgradeneeded=()=>{req.result.createObjectStore(STORE);};
      req.onerror=()=>reject(req.error??new Error("Cannot open IndexedDB"));
      req.onsuccess=()=>{
        const db=req.result;
        db.onversionchange=()=>db.close();
        resolve(db);
      };
    }).catch(err=>{dbPromise=null;throw err;});
  }
  return dbPromise;
}
async function readIDB(){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly");
    const get=tx.objectStore(STORE).get(RECORD);
    get.onsuccess=()=>resolve(get.result??null);
    get.onerror=()=>reject(get.error??new Error("Cannot read IndexedDB"));
    tx.onabort=()=>reject(tx.error??new Error("IndexedDB read aborted"));
  });
}
async function writeIDB(snapshot){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).put(snapshot,RECORD);
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error??new Error("IndexedDB write aborted"));
    tx.onerror=()=>reject(tx.error??new Error("IndexedDB write failed"));
  });
}
function readLocal(key){
  const raw=localStorage.getItem(key);
  return raw?JSON.parse(raw):null;
}
function writeLocal(snapshot){
  const json=JSON.stringify(snapshot);
  localStorage.setItem(SESSION_KEY,json);
  // Fail closed on surprising quota/storage round-trip failures.
  if(localStorage.getItem(SESSION_KEY)!==json)
    throw new Error("Local storage verification failed");
}
function getCandidates(deck,items){
  return items.map(item=>restoreSession(item,deck))
    .filter(candidate=>candidate&&isValidSession(candidate,deck))
    .sort((a,b)=>b.revision-a.revision||b.updatedAt-a.updatedAt);
}
export async function loadProgress(deck){
  const items=[],errors=[];
  try{items.push(readLocal(SESSION_KEY));}catch(e){errors.push("localStorage unavailable");}
  try{items.push(await readIDB());}catch(e){errors.push("IndexedDB unavailable");}
  // Preserve the older session on upgrades, and never overwrite this key.
  try{items.push(readLocal(LEGACY_SESSION_KEY));}catch{ /* best effort */ }
  const valid=getCandidates(deck,items);
  return {
    session:valid[0]??newSession(deck),
    previousFound:items.some(Boolean),
    degraded:errors.length===2,
    recovered:items.some(Boolean)&&valid.length===0
  };
}
export async function saveProgress(session){
  const attempts=await Promise.allSettled([
    Promise.resolve().then(()=>writeLocal(session)),
    writeIDB(session)
  ]);
  const success=attempts.filter(result=>result.status==="fulfilled").length;
  if(success===0)throw new Error("Neither browser storage system could save your progress");
  return {replicas:success};
}
