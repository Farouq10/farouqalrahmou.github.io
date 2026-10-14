import {fsrs,createEmptyCard,Rating,State} from './fsrs.mjs';
export {Rating};
export const engine=fsrs({request_retention:0.9,enable_fuzz:false});
export const KEY='farouq-history-fsrs-v1';
const text=c=>JSON.stringify([c.front,c.back]);
export function fresh(cards,now=new Date()){return {schema:1,revision:0,updatedAt:+now,cards:Object.fromEntries(cards.map(c=>[c.id,{text:text(c),memory:createEmptyCard(now),log:[]}]))};}
export function restore(value,cards,now=new Date()){
 if(!value||value.schema!==1||!Number.isInteger(value.revision)||value.revision<0||!Number.isFinite(value.updatedAt)||!value.cards)throw Error('Invalid progress');
 const result=fresh(cards,now);result.revision=value.revision;result.updatedAt=value.updatedAt;
 for(const c of cards){const old=value.cards[c.id];if(!old||old.text!==text(c))continue;const m={...old.memory,due:new Date(old.memory.due),...(old.memory.last_review?{last_review:new Date(old.memory.last_review)}:{})};
 if(!Number.isFinite(+m.due)||!Number.isFinite(m.stability)||m.stability<0||!Number.isFinite(m.difficulty)||m.difficulty<0||m.difficulty>10||!Number.isInteger(m.reps)||m.reps<0||!Number.isInteger(m.lapses)||m.lapses<0||![0,1,2,3].includes(m.state)||!Number.isInteger(m.learning_steps)||m.learning_steps<0||!Number.isFinite(m.elapsed_days)||!Number.isFinite(m.scheduled_days)||m.elapsed_days<0||m.scheduled_days<0||(m.reps>0&&!Number.isFinite(+m.last_review))||!Array.isArray(old.log))throw Error('Invalid saved card');result.cards[c.id]={...old,memory:m};}
 return result;
}
export function stack(m){return !m.reps||m.state!==State.Review?1:m.stability<3?2:m.stability<7?3:m.stability<21?4:5;}
export function recall(m,now){return m.reps?engine.get_retrievability(m,now,false):0;}
export function ordered(progress,cards,now=new Date(),early=false,exclude=new Set()){return cards.filter(c=>!exclude.has(c.id)&&(early||+progress.cards[c.id].memory.due<=+now)).sort((a,b)=>{const x=progress.cards[a.id].memory,y=progress.cards[b.id].memory;return recall(x,now)-recall(y,now)||stack(x)-stack(y)||+x.due-+y.due||a.id.localeCompare(b.id);});}
export function grade(progress,id,rating,now=new Date()){if(![1,2,3,4].includes(rating)||!progress.cards[id])throw Error('Invalid rating');const next=structuredClone(progress),e=next.cards[id];e.memory.due=new Date(e.memory.due);if(e.memory.last_review)e.memory.last_review=new Date(e.memory.last_review);const result=engine.next(e.memory,now,rating);e.memory=result.card;e.log.push(result.log);next.revision++;next.updatedAt=Math.max(+now,progress.updatedAt+1);return next;}
