import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ukDate,dailyPosition,problemsFor,dayNumber,setProblemStatus,cleanProblemLog} from '../daily.mjs';
const bank=['easy','medium','hard'].flatMap(level=>Array.from({length:30},(_,i)=>({id:level+'-'+i,level})));
test('UK midnight changes the selection even before midnight UTC',()=>{
 assert.equal(ukDate(new Date('2026-10-20T22:59:59Z')),'2026-10-20');
 assert.equal(dailyPosition(new Date('2026-10-20T22:59:59Z')).index,0);
 assert.equal(dailyPosition(new Date('2026-10-20T23:00:00Z')).index,1);
});
test('the autumn clock change does not repeat or skip a bank day',()=>{
 const a=dailyPosition(new Date('2026-10-25T00:30:00Z')),b=dailyPosition(new Date('2026-10-25T01:30:00Z'));
 assert.equal(a.date,'2026-10-25');assert.equal(b.date,a.date);assert.equal(a.index,b.index);
 assert.equal(dailyPosition(new Date('2026-10-26T00:00:00Z')).index,a.index+1);
});
test('the stored cycle repeats after 30 days across month boundaries',()=>{
 assert.equal(dailyPosition(new Date('2026-11-18T12:00:00Z')).day,30);
 assert.equal(dailyPosition(new Date('2026-11-19T12:00:00Z')).day,1);
 assert.equal(dailyPosition(new Date('2026-10-19T12:00:00Z')).day,30);
});
test('each day returns one problem per level and the full cycle has 90 unique selections',()=>{
 const ids=[];for(let i=0;i<30;i++){const problems=problemsFor(bank,i);assert.deepEqual(problems.map(p=>p.level),['easy','medium','hard']);ids.push(...problems.map(p=>p.id))}
 assert.equal(new Set(ids).size,90);assert.throws(()=>problemsFor(bank,30));assert.throws(()=>dayNumber('2026-02-30'));
});
test('attempt markers remain separate by date and can be undone',()=>{
 let log=setProblemStatus({},'2026-10-20','easy-0','attempted');log=setProblemStatus(log,'2026-10-21','easy-0','solved');
 assert.equal(log['2026-10-20|easy-0'],'attempted');assert.equal(log['2026-10-21|easy-0'],'solved');
 log=setProblemStatus(log,'2026-10-20','easy-0','untried');assert.equal(log['2026-10-20|easy-0'],undefined);assert.equal(log['2026-10-21|easy-0'],'solved');
});
test('malformed markers and excess history are bounded before cloud saving',()=>{
 assert.deepEqual(cleanProblemLog({'bad':'solved','2026-10-20|easy-0':'invalid'}),{});
 const log=Object.fromEntries(Array.from({length:600},(_,i)=>['2026-10-20|problem-'+i,'solved']));assert.equal(Object.keys(cleanProblemLog(log)).length,540);
});
