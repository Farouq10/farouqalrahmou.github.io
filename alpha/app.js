import {HISTORY} from './history.js';
import {ENGLISH} from './english.js';
import {ENRICHMENT} from './enrichment.js';
import {ARTICLES} from './articles.js';
import {PROBLEM_BANK} from './problem-bank.js';
import {ukDate,setProblemStatus} from './daily.mjs';
import {todayPreview,problemPage,readingIndex,articlePage} from './content-views.mjs';
import {bootSync,isConfigured} from './sync.js';
import {storageKey,readState,cleanState,maySave,safeResourceUrl} from './account-state.mjs';
const DECKS=[...HISTORY,...ENGLISH,...ENRICHMENT], BYID=new Map(DECKS.flatMap(d=>d.cards.map(c=>[c.id,{...c,deckId:d.id,deckTitle:d.title,subject:d.subject}]))), ALL=[...BYID.values()];
const IDS=new Set(BYID.keys()), DECK_IDS=new Set(DECKS.map(d=>d.id));
const DEFAULT={version:1,progress:{},reviews:[],prefs:{retention:.9,newLimit:18,selected:DECKS.map(d=>d.id),examDate:'',problemLog:{},readArticles:[]},modified:0};
let activeUid=null, accountUser=null, syncing=null, cloudState='guest', syncTimer=null, saveChain=Promise.resolve(), toastTimer=null;
let state=load(),session=null,current=null,flipped=false,certainty=null,shownAt=0,atlasQuery='',resourceItems=[],resourceState='idle',authMode='login';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const localDate=(ms=Date.now())=>{const d=new Date(ms);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
function load(){try{return readState(localStorage,activeUid,DEFAULT,IDS,DECK_IDS)}catch{return structuredClone(DEFAULT)}}
function persist(){try{localStorage.setItem(storageKey(activeUid),JSON.stringify(state));return true}catch{toast('Browser storage is unavailable. Export a backup before leaving.');return false}}
function save(){state.modified=Date.now();persist();if(syncing?.connected())scheduleCloud();else updateSaveStatus()}
function payload(){return {progress:state.progress,reviews:state.reviews.slice(-2000),prefs:state.prefs,modified:state.modified}}
function scheduleCloud(){
  clearTimeout(syncTimer);
  const uid=activeUid;
  $('#saveStatus').textContent='Saving…';
  syncTimer=setTimeout(()=>{
    const snapshot=structuredClone(payload());
    saveChain=saveChain.catch(()=>{}).then(async()=>{
      if(!maySave(uid,activeUid,syncing?.connected()))return;
      try{await syncing.save(snapshot,uid);if(uid===activeUid){cloudState='loaded';updateSaveStatus()}}
      catch(error){if(uid===activeUid){cloudState='error';updateSaveStatus();toast(error.message)}}
    });
  },1500);
}
function updateSaveStatus(){
  $('#saveStatus').textContent=activeUid?(cloudState==='error'?'Saved here · cloud paused':cloudState==='loading'?'Loading account…':syncing?.connected()?'Saved to your account':'Saved in this browser'):'Saved in this browser';
}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),5000)}
function route(){return (location.hash.replace(/^#\/?/,'').split('?')[0]||'dashboard').split('/')[0]}
function go(where){location.hash='#/'+where;if(route()===where)render()}
function selectedCards(){return ALL.filter(c=>state.prefs.selected.includes(c.deckId))}
function last7(){let counts=[];for(let i=6;i>=0;i--){let t=new Date();t.setDate(t.getDate()-i);let day=localDate(t.getTime());counts.push({day,num:state.reviews.filter(r=>localDate(r.at)===day).length})}return counts}
function pof(c){return state.progress[c.id]}
function due(c){const p=pof(c);return p && p.dueAt<=Date.now()}
function dueCount(cards=selectedCards()){return cards.reduce((n,c)=>n+(due(c)?1:0),0)}
function learnedCount(cards=selectedCards()){return cards.reduce((n,c)=>n+(pof(c)?1:0),0)}
function reviewsToday(){return state.reviews.filter(r=>localDate(r.at)===localDate())}
function newToday(){return new Set(reviewsToday().filter(r=>r.wasNew).map(r=>r.id)).size}
function dateUrgency(){if(!state.prefs.examDate)return 0;let days=(new Date(state.prefs.examDate+"T23:59").getTime()-Date.now())/86400000;return days>0&&days<30?(30-days)/30:0}
function priority(c){let p=pof(c);if(!p)return (c.weight||1)*.15;let late=Math.max(0,(Date.now()-p.dueAt)/86400000);return 4+Math.min(8,late/(p.stability||1))*1.8+(p.lapses||0)*.2+(c.weight||1)*.16+dateUrgency()}
function arrange(cards){let remain=[...cards].sort((a,b)=>priority(b)-priority(a));const sorted=[];let prev="";while(remain.length){let idx=remain.findIndex(c=>(c.deckId+':'+c.topic)!==prev&&priority(c)>=priority(remain[0])-.9);if(idx<0)idx=0;let c=remain.splice(idx,1)[0];sorted.push(c);prev=c.deckId+':'+c.topic}return sorted}
function createSession(deckId){let cards=selectedCards().filter(c=>!deckId||c.deckId===deckId);let dueItems=arrange(cards.filter(due));let fresh=cards.filter(c=>!pof(c)).sort((a,b)=>(b.weight||1)-(a.weight||1));let newBudget=Math.max(0,Number(state.prefs.newLimit)-newToday());let items=[...dueItems,...arrange(fresh).slice(0,newBudget)];session={queue:items.slice(0,80).map(c=>c.id),total:Math.min(80,items.length),done:0,focus:deckId,retries:{},correct:0,start:Date.now()};current=null;flipped=false;certainty=null;go("review")}
function drawCard(){current=null;flipped=false;certainty=null;if(!session)return;let id=session.queue[0];if(id){current=BYID.get(id);shownAt=performance.now()}}
function gradeCard(rating){const grade=[0,0,1,2,3][rating];if(!current||!flipped||!session)return;let card=current,p=state.progress[card.id],now=Date.now(),wasNew=!p;
let old=p?.stability||.7,days=p?.lastAt?Math.max(0,(now-p.lastAt)/86400000):0;
let predicted=Math.exp(Math.log(.9)*days/Math.max(.12,old));
let factor=grade===0?.35:grade===1?1.07:grade===2?1.75+.35*(1-predicted):2.4+.45*(1-predicted);
if(certainty===2&&grade===0)factor*=.85;
let stability=wasNew?([.08,.35,1.4,3.2][grade]):Math.max(.09,Math.min(600,old*factor));
let interval=stability*(Math.log(state.prefs.retention)/Math.log(.9));
if(grade===0)interval=Math.min(interval,.08);
if(grade===1)interval=Math.min(interval,.7);
let dueAt=now+Math.max(5/1440,interval)*86400000;
const past=state.progress[card.id]||{};
state.progress[card.id]={...past,stability,dueAt,lastAt:now,reps:(past.reps||0)+1,lapses:(past.lapses||0)+(grade===0?1:0),lastGrade:grade};
state.reviews.push({id:card.id,at:now,grade,rating,confidence:certainty,wasNew,seconds:Math.min(600,Math.round((performance.now()-shownAt)/1000))});
if(state.reviews.length>12000)state.reviews=state.reviews.slice(-12000);
session.queue.shift();session.done++;if(grade>0)session.correct++;
if(grade<2)session.retries[card.id]=2;else if(session.retries[card.id])session.retries[card.id]--;
if(session.retries[card.id]>0){let idx=Math.min([1,2,4,7,12][rating],session.queue.length);session.queue.splice(idx,0,card.id)}
save();drawCard();render();
}
function heading(title,sub=''){return '<div class="page-heading"><h1>'+esc(title)+'</h1>'+(sub?'<p class="subtitle">'+esc(sub)+'</p>':'')+'</div>'}
function deckRow(d){const due=dueCount(d.cards),started=learnedCount(d.cards);return '<button class="deck" data-open="'+esc(d.id)+'" aria-label="Study '+esc(d.title)+'"><span class="deck-subject">'+esc(d.subject)+'</span><span class="deck-name"><span class="deck-title">'+esc(d.title)+'</span><span class="deck-description">'+started+' of '+d.cards.length+' cards started</span></span><span class="deck-count">'+d.cards.length+' cards</span><span class="deck-due '+(due?'is-due':'')+'">'+(due?due+' due':started===d.cards.length?'Up to date':'Study')+'</span></button>'}
function dashboard(){const cards=selectedCards(),due=dueCount(cards),fresh=cards.filter(c=>!pof(c)).length;return '<section class="study-summary"><div><h1>Study</h1><p>'+(due?due+' card'+(due===1?' is':'s are')+' due.':fresh?'Start with a few new cards.':'You’re up to date.')+'</p></div><button class="primary" data-start="">'+(due?'Review cards':'Start studying')+'</button></section><div class="counts"><span><strong>'+reviewsToday().length+'</strong> answered today</span><span><strong>'+learnedCount(cards)+' / '+cards.length+'</strong> cards started</span></div>'+todayPreview(PROBLEM_BANK)+'<div class="section-head"><h2>Your decks</h2><a href="#/library">Browse decks</a></div><div class="deck-list">'+DECKS.map(deckRow).join('')+'</div><section class="home-section"><div class="section-head"><h2>Reading</h2><a href="#/reading">All articles & resources</a></div><a class="featured-reading" href="#/reading/kamikaze"><strong>Kamikaze</strong><span>Duty, memory and the cost of coming home.</span></a></section>'}
function problems(){const params=new URLSearchParams(location.hash.split('?')[1]||'');const n=Number(params.get('day'));return problemPage(PROBLEM_BANK,state.prefs,n||null)}
function reading(){const part=location.hash.replace(/^#\/?/,'').split('?')[0].split('/')[1];let id='';try{id=decodeURIComponent(part||'')}catch{}return id?articlePage(ARTICLES,id,state.prefs):readingIndex(ARTICLES,state.prefs)}

function library(){return heading('Decks',ALL.length+' cards across History and English.')+'<div class="toolbar"><input class="search" id="librarySearch" aria-label="Search decks" placeholder="Search decks"><select class="select" id="subjectFilter" aria-label="Subject"><option value="all">All subjects</option><option>History</option><option>English</option></select></div><div class="deck-list" id="libraryResults">'+DECKS.map(deckRow).join('')+'</div>'}
function updateLibrary(){const q=$('#librarySearch').value.toLowerCase(),subject=$('#subjectFilter').value;$('#libraryResults').innerHTML=DECKS.filter(d=>(subject==='all'||d.subject===subject)&&(d.title+' '+d.description).toLowerCase().includes(q)).map(deckRow).join('')||'<p class="empty">No matching decks.</p>'}
const ratings=['Impossible','No idea','Not quite','Easy','Very easy'];
function review(){
  if(!session)return heading('Review','Try to recall the answer before revealing it.')+'<div class="empty"><p>Use your selected decks, or choose one from the deck list.</p><button class="primary" data-start="">Start review</button></div>';
  if(!current&&session.queue.length)drawCard();
  if(!current)return '<div class="study-wrap">'+heading('Session complete',session.done+' answers recorded. Your next reviews are scheduled.')+'<div class="actions"><a class="primary" href="#/dashboard">Back to study</a><button class="outline" data-start="'+esc(session.focus||'')+'">Study more</button></div></div>';
  const percent=Math.min(100,Math.round(100*session.done/Math.max(1,session.total)));
  return '<div class="study-wrap"><div class="page-heading heading-row"><h1>Review</h1><button class="text-button" data-action="endReview">End session</button></div><div class="study-meta"><span>'+esc(current.deckTitle)+'</span><span>'+session.queue.length+' left</span></div><div class="bar" aria-hidden="true"><div style="width:'+percent+'%"></div></div><section class="study-card" aria-label="Flashcard"><span class="card-label">Question</span><div class="question">'+esc(current.front)+'</div>'+(flipped?'<span class="card-label">Answer</span><div class="answer">'+esc(current.back)+'</div>':'<details class="confidence" '+(certainty!==null?'open':'')+'><summary>Record confidence (optional)</summary><div class="confidence-buttons">'+['Unsure','Somewhat sure','Certain'].map((name,i)=>'<button data-confidence="'+i+'" aria-pressed="'+(certainty===i)+'">'+name+'</button>').join('')+'</div></details><button class="primary" data-action="flip">Show answer</button>')+'</section>'+(flipped?'<div class="review-buttons">'+ratings.map((name,i)=>'<button data-grade="'+i+'">'+name+'<small>'+String(i+1)+'</small></button>').join('')+'</div><p class="study-hint">Rate what you recalled before seeing the answer.</p>':'<p class="study-hint">Space to reveal · 1–5 to rate</p>')+'</div>';
}
function timeline(){const id=state.prefs.timelineDeck||HISTORY[0].id;return heading('Dates')+'<div class="toolbar"><select id="timelineDeck" class="select" aria-label="History deck">'+HISTORY.map(d=>'<option value="'+esc(d.id)+'" '+(d.id===id?'selected':'')+'>'+esc(d.title)+'</option>').join('')+'</select><input class="search" id="timelineSearch" aria-label="Search dates" placeholder="Search dates or events" value="'+esc(atlasQuery)+'"></div><div id="timelineList">'+timelineRows(id,atlasQuery)+'</div>'}
function timelineRows(id,q=''){const cards=(HISTORY.find(d=>d.id===id)||HISTORY[0]).cards.filter(c=>(c.date+' '+c.front+' '+c.back).toLowerCase().includes(q.toLowerCase()));return '<div class="list">'+cards.map(c=>'<div class="list-item"><span class="date">'+esc(c.date)+'</span><div><strong>'+esc(c.front.replace(/^When\? /,''))+'</strong><p>'+esc(c.back.split(' — ').slice(1).join(' — '))+'</p></div></div>').join('')+'</div>'+(cards.length?'':'<p class="empty">No matching dates.</p>')}
function metric(label,value,foot){return '<div class="metric"><span class="label">'+label+'</span><strong>'+esc(value)+'</strong><small>'+foot+'</small></div>'}
function insights(){const days=last7(),max=Math.max(1,...days.map(d=>d.num)),r=state.reviews;return heading('Activity')+'<div class="metrics">'+metric('Answers',r.length,'All time')+metric('Recalled',r.length?Math.round(100*r.filter(x=>x.grade>=2).length/r.length)+'%':'—','Easy or very easy')+metric('Started',learnedCount(),selectedCards().length+' selected cards')+'</div><section class="panel"><h2>Last seven days</h2><div class="activity-bars" role="img" aria-label="'+esc(days.map(d=>d.day+': '+d.num+' answers').join('; '))+'">'+days.map(d=>'<div class="activity-col"><i style="height:'+Math.max(1,Math.round(110*d.num/max))+'px"></i>'+d.day.slice(5)+'</div>').join('')+'</div></section><p class="notice">Intervals adapt to your ratings. This scheduler is experimental; it has not been shown to outperform Anki’s FSRS.</p>'}
function settings(){const p=state.prefs;return heading('Settings')+'<div class="settings-grid"><section class="panel"><h2>Review</h2><label class="field">New cards per day<input type="number" id="newLimit" min="0" max="80" value="'+p.newLimit+'"></label><label class="field">Target retention: <span id="retentionValue">'+Math.round(p.retention*100)+'%</span><input type="range" id="retention" min="0.85" max="0.95" step="0.01" value="'+p.retention+'"></label><p>Higher targets mean more frequent reviews. The target is an estimate.</p><label class="field">Exam date (optional)<input id="examDate" type="date" value="'+esc(p.examDate)+'"></label></section><section class="panel"><h2>Include in mixed review</h2><div class="toggle-list">'+DECKS.map(d=>'<label><input type="checkbox" data-selectdeck="'+d.id+'" '+(p.selected.includes(d.id)?'checked':'')+'>'+esc(d.title)+'</label>').join('')+'</div></section><section class="panel"><h2>Account</h2><p>'+(accountUser?'Signed in as '+esc(accountUser.email)+'.':isConfigured?'Sign in to keep your progress across devices.':'Account sign-in is awaiting activation. You can study and save in this browser now.')+'</p><button class="outline" data-action="auth">'+(accountUser?'Manage account':'Sign in')+'</button>'+(accountUser?'<p class="notice">On a shared computer, sign out when you finish. Your account progress is stored separately from guest progress.</p>':'')+'</section><section class="panel"><h2>Backup</h2><p>Export your current progress before changing browser or moving to another address.</p><div class="actions"><button class="outline" data-action="export">Export progress</button><button class="outline" data-action="import">Import backup</button></div><p class="notice">Importing replaces progress for the current account or guest session. It never merges different accounts.</p><button class="text-button danger" data-action="reset">Reset current progress</button></section></div>'}
function resources(){
  if(!syncing?.isOwner())return heading('Resources')+'<p class="muted">This area is available only to the owner’s verified account.</p>';
  return heading('Resources','Your private links and notes.')+'<details id="resourceEditor"><summary class="text-button">Add a resource</summary><form id="resourceForm" class="resource-form"><label class="field">Title<input name="title" required maxlength="160"></label><label class="field">Link (optional)<input name="url" type="url" placeholder="https://" maxlength="2048"></label><label class="field">Notes (optional)<textarea name="note" maxlength="20000"></textarea></label><button class="primary" type="submit">Save resource</button><p class="form-message" id="resourceError" role="alert"></p></form></details><div id="resourceList">'+resourceRows()+'</div>';
}
function resourceRows(){if(resourceState==='loading')return '<p class="empty muted">Loading resources…</p>';if(resourceState==='error')return '<div class="empty"><p>Resources could not load.</p><button class="outline" data-action="reloadResources">Try again</button></div>';if(!resourceItems.length)return '<p class="empty muted">No resources yet. Add a link or note to open it at school.</p>';return resourceItems.map(r=>{const url=safeResourceUrl(r.url);return '<article class="resource"><h2>'+esc(r.title)+'</h2>'+(url?'<a class="resource-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(url)+'</a>':'')+(r.note?'<div class="resource-note">'+esc(r.note)+'</div>':'')+'<div class="actions"><button class="text-button danger" data-delete-resource="'+esc(r.id)+'">Delete</button></div></article>'}).join('')}
async function loadResources(){if(!syncing?.isOwner())return;const uid=activeUid;resourceState='loading';if($('#resourceList'))$('#resourceList').innerHTML=resourceRows();try{const items=await syncing.resources();if(uid!==activeUid)return;resourceItems=items;resourceState='loaded'}catch{if(uid!==activeUid)return;resourceState='error'}if($('#resourceList'))$('#resourceList').innerHTML=resourceRows()}
function render(){let r=route();const views={dashboard,library,review,timeline,insights,settings,resources,problems,reading};if(!views[r])r='dashboard';document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===r)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});document.title='Alpha — '+({dashboard:'Study',library:'Decks',timeline:'Dates',review:'Review',insights:'Activity',settings:'Settings',resources:'Private resources',problems:'Daily problems',reading:'Reading'}[r]);$('#page').innerHTML=views[r]();updateAccount();if(r==='resources'&&resourceState==='idle')loadResources()}
function updateAccount(){const b=$('#authButton');b.textContent=accountUser?(accountUser.email?.split('@')[0]||'Account'):'Sign in';b.setAttribute('aria-label',accountUser?'Manage account for '+accountUser.email:'Sign in');$('#resourcesNav').hidden=!syncing?.isOwner();updateSaveStatus()}
function connectState(api){syncing=api;updateAccount();if(accountUser && api.connected() && cloudState==='loaded'){if(state.modified>0)scheduleCloud()} }
async function receiveSession(user,remote,status){
  const uid=user?.uid||null;
  if(uid!==activeUid || status==='loading'){
    clearTimeout(syncTimer);persist();activeUid=uid;accountUser=user;state=load();session=null;current=null;resourceItems=[];resourceState='idle';
  }
  accountUser=user;cloudState=status;
  if(status==='loaded'&&remote){
    const cloud=cleanState(remote,DEFAULT,IDS,DECK_IDS);
    // Cached progress belongs to this exact uid. Prefer newer local edits only for this account.
    if(cloud.modified>=state.modified){state=cloud;persist()}
    else toast('Restored this account’s newer local progress.');
  }
  if(route()==='resources' && !syncing?.isOwner())go('dashboard');
  render();
}
function authError(error){return ({'auth/invalid-credential':'Email or password was not recognised.','auth/invalid-email':'Enter a valid email address.','auth/email-already-in-use':'This email already has an account. Try signing in or resetting the password.','auth/weak-password':'Use at least 8 characters for your password.','auth/too-many-requests':'Too many attempts. Wait a little before trying again.','auth/popup-blocked':'Your browser blocked Google sign-in. Allow the popup or use email and password.','auth/popup-closed-by-user':'Google sign-in was closed.','auth/network-request-failed':'Could not connect. Check your internet connection.','auth/unauthorized-domain':'Sign-in has not yet been enabled for this website address.','auth/operation-not-allowed':'This sign-in method has not been activated yet.'})[error.code]||'Could not complete that request. Please try again.'}
function accountMarkup(){
  const title=accountUser?'Account':authMode==='signup'?'Create an account':authMode==='reset'?'Reset password':'Sign in';
  let html='<div class="dialog-heading"><h2 id="accountTitle">'+title+'</h2><button class="dialog-close" data-action="closeAccount" aria-label="Close account dialog">×</button></div>';
  if(accountUser){return html+'<p class="account-email">'+esc(accountUser.email)+'</p><p class="muted">'+(syncing?.connected()?'Your progress saves to this account.':'Cloud progress is not connected. Your local copy is kept for this account.')+'</p>'+(!accountUser.emailVerified?'<p class="notice">Verify your email using the link in your inbox.</p><div class="actions"><button class="outline small" data-action="verifyEmail">Resend email</button><button class="outline small" data-action="refreshAccount">I’ve verified</button></div>':'')+'<div class="actions" style="margin-top:24px"><button class="outline" data-action="logout">Sign out</button></div><p class="form-message" id="authError" role="alert"></p>'}
  if(!isConfigured)return html+'<p class="muted">Account sign-in is not activated yet. Your study progress will save in this browser.</p><button class="outline" data-action="closeAccount">Continue studying</button>';
  if(!syncing)return html+'<p class="muted">Sign-in could not connect. Check your connection and reload to try again.</p>';
  html+='<p class="muted">'+(authMode==='signup'?'Save your progress and pick up on another device.':authMode==='reset'?'We’ll email you a password reset link.':'Continue with your saved progress.')+'</p>';
  if(authMode!=='reset')html+='<button class="outline full-width" data-action="googleLogin">Continue with Google</button><div class="auth-separator">or use email</div>';
  html+='<form id="authForm"><label class="field">Email<input type="email" name="email" autocomplete="email" required maxlength="254"></label>';
  if(authMode!=='reset')html+='<label class="field">Password<input type="password" name="password" autocomplete="'+(authMode==='signup'?'new-password':'current-password')+'" '+(authMode==='signup'?'minlength="8"':'')+' maxlength="128" required></label>';
  html+='<button class="primary full-width" type="submit">'+(authMode==='signup'?'Create account':authMode==='reset'?'Send reset link':'Sign in')+'</button><p class="form-message" id="authError" role="alert"></p></form>';
  if(authMode==='login')html+='<p class="auth-switch">New here? <button class="text-button" data-auth-mode="signup">Create an account</button></p><button class="text-button small" data-auth-mode="reset">Forgot password?</button>';
  else html+='<p class="auth-switch"><button class="text-button" data-auth-mode="login">Back to sign in</button></p>';
  return html;
}
function openAccount(){authMode='login';$('#accountDialog').innerHTML=accountMarkup();if(!$('#accountDialog').open)$('#accountDialog').showModal()}
function authMessage(message){const el=$('#authError');if(el)el.textContent=message;else toast(message)}
async function runAuth(task){const dialog=$('#accountDialog');dialog.querySelectorAll('button,input').forEach(b=>b.disabled=true);authMessage('');try{await task()}catch(e){authMessage(authError(e))}finally{dialog.querySelectorAll('button,input').forEach(b=>b.disabled=false)}}
async function signOut(){
  const uid=activeUid;
  // Preserve this account locally, flush queued writes, then clear identity and private UI.
  if(syncing?.connected()){
    clearTimeout(syncTimer);
    await saveChain.catch(()=>{});
    try{await syncing.save(structuredClone(payload()),uid)}catch{toast('Signed out. Unsynced progress is saved in this browser for your account.')}
  }
  $('#accountDialog').close();await syncing.logout();
}
function exportData(){const data={format:'alpha-v1',exportedAt:new Date().toISOString(),progress:state.progress,reviews:state.reviews,prefs:state.prefs};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='alpha-backup-'+localDate()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
async function receiveFile(file){if(!file)return;try{const data=JSON.parse(await file.text());if(!['alpha-v1','tessera-v1'].includes(data.format)||!data.progress||!Array.isArray(data.reviews))throw Error('Choose an Alpha progress backup.');if(!confirm('Replace progress for '+(accountUser?accountUser.email:'this guest session')+'? Export a backup first if needed.'))return;state=cleanState(data,DEFAULT,IDS,DECK_IDS);session=null;save();go('dashboard');toast('Progress imported.')}catch(e){toast(e.message)}}
document.addEventListener('click',async e=>{
  const anchor=e.target.closest('[data-article-anchor]');if(anchor){e.preventDefault();document.getElementById(anchor.dataset.articleAnchor)?.scrollIntoView?.({block:'start',behavior:'smooth'});return}
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.id==='authButton'){openAccount();return}
  if(b.dataset.problemId){
    if(!PROBLEM_BANK.some(p=>p.id===b.dataset.problemId))return;
    state.prefs.problemLog=setProblemStatus(state.prefs.problemLog,b.dataset.problemDate,b.dataset.problemId,b.dataset.problemStatus);
    b.parentElement.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===b)));save();return;
  }
  if(b.dataset.articleRead){
    const id=b.dataset.articleRead;if(!ARTICLES.some(a=>a.id===id))return;
    const set=new Set(state.prefs.readArticles||[]);if(set.has(id))set.delete(id);else set.add(id);state.prefs.readArticles=[...set];
    b.setAttribute('aria-pressed',String(set.has(id)));b.textContent=set.has(id)?'Marked as read':'Mark as read';save();return;
  }
  if(b.hasAttribute('data-open')){const id=b.dataset.open;state.prefs.selected=[...new Set([...state.prefs.selected,id])];save();createSession(id);return}
  if(b.hasAttribute('data-start')){const id=b.dataset.start;if(id&&!state.prefs.selected.includes(id)){state.prefs.selected.push(id);save()}createSession(id);return}
  if(b.hasAttribute('data-confidence')){certainty=Number(b.dataset.confidence);render();return}
  if(b.hasAttribute('data-grade')){gradeCard(Number(b.dataset.grade));return}
  if(b.dataset.authMode){authMode=b.dataset.authMode;$('#accountDialog').innerHTML=accountMarkup();return}
  if(b.dataset.deleteResource){if(confirm('Delete this resource?')){b.disabled=true;const uid=activeUid;try{await syncing.deleteResource(b.dataset.deleteResource);if(uid===activeUid)await loadResources()}catch{toast('Could not delete the resource.');b.disabled=false}}return}
  const action=b.dataset.action;
  if(action==='flip'&&current){flipped=true;render()}
  else if(action==='endReview'){session=null;go('dashboard')}
  else if(action==='auth')openAccount();
  else if(action==='closeAccount')$('#accountDialog').close();
  else if(action==='googleLogin')await runAuth(async()=>{await syncing.loginGoogle();$('#accountDialog').close()});
  else if(action==='logout')await runAuth(signOut);
  else if(action==='verifyEmail')await runAuth(async()=>{await syncing.verifyEmail();authMessage('Verification email sent.')});
  else if(action==='refreshAccount')await runAuth(async()=>{await syncing.refresh();$('#accountDialog').innerHTML=accountMarkup()});
  else if(action==='reloadResources')await loadResources();
  else if(action==='export')exportData();
  else if(action==='import')$('#importFile').click();
  else if(action==='reset'&&confirm('Erase study progress for '+(accountUser?accountUser.email:'this guest session')+'? This also replaces its cloud progress when connected.')){state=structuredClone(DEFAULT);session=null;save();go('dashboard')}
});
document.addEventListener('submit',async e=>{
  if(e.target.id==='authForm'){
    e.preventDefault();const form=new FormData(e.target),email=String(form.get('email')).trim(),password=String(form.get('password')||'');
    await runAuth(async()=>{
      if(authMode==='reset'){await syncing.resetPassword(email);authMessage('If an account exists, a reset link will be sent. Check your inbox.');return}
      if(authMode==='signup')await syncing.signup(email,password);else await syncing.loginEmail(email,password);
      $('#accountDialog').close();
    });
  }
  if(e.target.id==='resourceForm'){
    e.preventDefault();const form=e.target,button=form.querySelector('button'),data=new FormData(form),uid=activeUid;button.disabled=true;
    try{await syncing.addResource({title:String(data.get('title')),url:String(data.get('url')).trim(),note:String(data.get('note'))});if(uid===activeUid){form.reset();$('#resourceEditor').open=false;await loadResources();toast('Resource saved.')}}catch(error){if(uid===activeUid)$('#resourceError').textContent=error.message}finally{button.disabled=false}
  }
});
document.addEventListener('input',e=>{const id=e.target.id,v=e.target.value;if(id==='retention'){state.prefs.retention=Number(v);$('#retentionValue').textContent=Math.round(Number(v)*100)+'%';save()}if(id==='newLimit'){state.prefs.newLimit=Math.max(0,Math.min(80,Math.floor(Number(v)||0)));save()}if(id==='examDate'){state.prefs.examDate=v;save()}if(id==='librarySearch')updateLibrary();if(id==='timelineSearch'){atlasQuery=v;$('#timelineList').innerHTML=timelineRows(state.prefs.timelineDeck||HISTORY[0].id,v)}});
document.addEventListener('change',e=>{if(e.target.id==='problemDay'){location.hash=e.target.value==='today'?'#/problems':'#/problems?day='+e.target.value;return}if(e.target.id==='subjectFilter')updateLibrary();if(e.target.id==='timelineDeck'){state.prefs.timelineDeck=e.target.value;save();$('#timelineList').innerHTML=timelineRows(e.target.value,atlasQuery)}if(e.target.hasAttribute('data-selectdeck')){const id=e.target.dataset.selectdeck;state.prefs.selected=e.target.checked?[...new Set([...state.prefs.selected,id])]:state.prefs.selected.filter(x=>x!==id);save()}});
$('#importFile').addEventListener('change',e=>{receiveFile(e.target.files[0]);e.target.value=''});
window.addEventListener('hashchange',()=>{render();$('#page').focus();if(route()==='reading')window.scrollTo?.(0,0)});
// Keep an already-open tab current at UK midnight. Archive selections stay put.
let visibleUkDate=ukDate();
function refreshDailyDate(){const next=ukDate();if(next!==visibleUkDate){visibleUkDate=next;if(route()==='dashboard'||(route()==='problems'&&!location.hash.includes('day=')))render()}}
setInterval(refreshDailyDate,30000).unref?.();
window.addEventListener('focus',refreshDailyDate);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDailyDate()});
window.addEventListener('keydown',e=>{if($('#accountDialog').open||['INPUT','TEXTAREA','SELECT','BUTTON','SUMMARY'].includes(document.activeElement.tagName)||route()!=='review'||!current)return;if(e.code==='Space'&&!flipped){e.preventDefault();flipped=true;render()}else if(flipped&&['1','2','3','4','5'].includes(e.key)){e.preventDefault();gradeCard(Number(e.key)-1)}});
render();
bootSync({onReady:connectState,onSession:receiveSession,onNotice:toast}).catch(error=>{console.warn('Sign-in unavailable:',error.code||error.message);toast('Sign-in could not connect. You can still study in this browser.')});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
// Export the account boundary for non-browser isolation tests.
export {receiveSession};
