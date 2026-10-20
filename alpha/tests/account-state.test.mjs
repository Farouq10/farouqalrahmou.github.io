import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storageKey,readState,cleanState,maySave,safeResourceUrl} from '../account-state.mjs';
const defaults={version:1,progress:{},reviews:[],prefs:{retention:.9,newLimit:18,selected:['history'],examDate:''},modified:0};
const ids=new Set(['a']),decks=new Set(['history']);
const old={...defaults,progress:{a:{dueAt:10,stability:1,lastAt:5}},reviews:[{id:'a',at:5,grade:2}],modified:10};
function storage(){const records=new Map();return {getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v)}}
test('new accounts never inherit guest or another user’s progress',()=>{
 const s=storage();s.setItem(storageKey(null),JSON.stringify(old));s.setItem(storageKey('alice'),JSON.stringify(old));
 assert.equal(readState(s,'bob',defaults,ids,decks).reviews.length,0);
 assert.equal(readState(s,'alice',defaults,ids,decks).reviews.length,1);
 assert.equal(readState(s,null,defaults,ids,decks).reviews.length,1);
 assert.notEqual(storageKey(null),storageKey('alice'));
});
test('signing out restores the guest namespace without changing account progress',()=>{
 const s=storage();s.setItem(storageKey('alice'),JSON.stringify(old));
 assert.equal(readState(s,null,defaults,ids,decks).reviews.length,0);
 assert.equal(readState(s,'alice',defaults,ids,decks).modified,10);
});
test('queued saves are rejected on account changes and while loading',()=>{
 assert.equal(maySave('alice','bob',true),false);assert.equal(maySave('alice',null,true),false);
 assert.equal(maySave('alice','alice',false),false);assert.equal(maySave('alice','alice',true),true);
});
test('unknown cards, bad ratings and invalid preferences are removed from imports',()=>{
 const cleaned=cleanState({...old,progress:{...old.progress,unknown:{dueAt:1,stability:2,lastAt:1}},reviews:[...old.reviews,{id:'a',grade:99,at:1}],prefs:{retention:2,newLimit:-5,selected:['other','history'],examDate:'<script>'}},defaults,ids,decks);
 assert.deepEqual(Object.keys(cleaned.progress),['a']);assert.equal(cleaned.reviews.length,1);
 assert.equal(cleaned.prefs.retention,.95);assert.equal(cleaned.prefs.newLimit,0);assert.deepEqual(cleaned.prefs.selected,['history']);assert.equal(cleaned.prefs.examDate,'');
});
test('corrupt storage yields a fresh state without mutating defaults',()=>{
 const s=storage();s.setItem(storageKey('alice'),'{broken');const loaded=readState(s,'alice',defaults,ids,decks);loaded.prefs.selected.push('new');assert.deepEqual(defaults.prefs.selected,['history']);
});
test('resource links allow HTTPS only, including when loading stored records',()=>{
 assert.equal(safeResourceUrl('javascript:alert(1)'),null);assert.equal(safeResourceUrl('data:text/html,hello'),null);assert.equal(safeResourceUrl('http://example.com'),null);assert.equal(safeResourceUrl('https://example.com'),'https://example.com/');assert.equal(safeResourceUrl(''),'');
});
