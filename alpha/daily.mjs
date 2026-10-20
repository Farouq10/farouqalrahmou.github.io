// A fixed bank rotates automatically on calendar dates in the UK, including DST.
export const CYCLE_START='2026-10-20';
export const CYCLE_LENGTH=30;
const dayFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'});
export function ukDate(now=new Date()){
  const p=Object.fromEntries(dayFormatter.formatToParts(now).map(part=>[part.type,part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function dayNumber(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))throw Error('Invalid calendar date');
  const [y,m,d]=iso.split('-').map(Number),ms=Date.UTC(y,m-1,d);
  if(new Date(ms).toISOString().slice(0,10)!==iso)throw Error('Invalid calendar date');
  return ms/86400000;
}
export function dateAt(number){return new Date(number*86400000).toISOString().slice(0,10)}
export function dailyPosition(now=new Date()){
  const date=ukDate(now),offset=dayNumber(date)-dayNumber(CYCLE_START);
  const index=((offset%CYCLE_LENGTH)+CYCLE_LENGTH)%CYCLE_LENGTH;
  return {date,index,day:index+1,cycleStart:dateAt(dayNumber(date)-index)};
}
export function problemsFor(bank,index){
  if(!Number.isInteger(index)||index<0||index>=CYCLE_LENGTH)throw Error('Invalid day');
  return ['easy','medium','hard'].map(level=>{
    const problem=bank.filter(p=>p.level===level)[index];
    if(!problem)throw Error('Problem bank is incomplete');
    return problem;
  });
}
export function problemKey(date,id){return `${date}|${id}`}
export function cleanProblemLog(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value).filter(([key,status])=>/^\d{4}-\d{2}-\d{2}\|[a-z0-9-]{1,100}$/.test(key)&&['attempted','solved'].includes(status)).slice(-540));
}
export function setProblemStatus(log,date,id,status){
  const next=cleanProblemLog(log),key=problemKey(date,id);
  if(status==='untried')delete next[key];
  else if(['attempted','solved'].includes(status))next[key]=status;
  else throw Error('Invalid problem status');
  return cleanProblemLog(next);
}
