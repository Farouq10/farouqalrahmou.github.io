import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HISTORY} from '../history.js';
import {ENGLISH} from '../english.js';
import {ENRICHMENT} from '../enrichment.js';
import {ARTICLES} from '../articles.js';
import {PROBLEM_BANK} from '../problem-bank.js';
import {articlePage,problemPage} from '../content-views.mjs';
const decks=[...HISTORY,...ENGLISH,...ENRICHMENT],cards=decks.flatMap(d=>d.cards);
test('all original flashcard IDs remain and added cards are unique with useful content',()=>{
 assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
 const originals=JSON.parse(readFileSync(new URL('./fixtures/original-card-ids.json',import.meta.url),'utf8'));
 assert.equal(originals.length,408);for(const id of originals)assert.ok(cards.some(c=>c.id===id),id);
 for(const card of cards){assert.ok(card.front.trim().length>=10,card.id);assert.ok(card.back.trim().length>=12,card.id)}
 assert.ok(ENRICHMENT.flatMap(d=>d.cards).length>=50);
});
test('the daily bank includes exactly 30 unique official selections in every requested band',()=>{
 assert.equal(PROBLEM_BANK.length,90);assert.equal(new Set(PROBLEM_BANK.map(p=>p.id)).size,90);
 const sourceIds=PROBLEM_BANK.map(p=>[p.competition,p.archiveYear||p.year,p.question].join(':'));assert.equal(new Set(sourceIds).size,90);
 for(const level of ['easy','medium','hard'])assert.equal(PROBLEM_BANK.filter(p=>p.level===level).length,30);
 for(const p of PROBLEM_BANK){const url=new URL(p.paperUrl);assert.equal(url.protocol,'https:');assert.ok(['ukmt.org.uk','bmos.ukmt.org.uk','www.egmo.org','egmo.org'].includes(url.hostname),p.id);assert.ok(p.pageNumber>=1);if(p.level==='easy')assert.ok(p.question>=18&&p.question<=25);if(p.level==='medium'){assert.equal(p.competition,'BMO1');assert.ok(p.question<=3)}if(p.solutionUrl)assert.equal(new URL(p.solutionUrl).protocol,'https:')}
});
test('articles contain substantial analysis, retrieval questions and existing companion decks',()=>{
 assert.equal(ARTICLES.length,4);assert.ok(ARTICLES.some(a=>a.id==='kamikaze'));
 for(const article of ARTICLES){assert.ok(article.sections.length>=8,article.id);assert.ok(article.sections.flatMap(s=>s.paragraphs).join(' ').split(/\s+/).length>=1000,article.id);assert.ok(article.retrieval.length>=4);assert.ok(decks.some(d=>d.id===article.deckId),article.id);for(const card of decks.find(d=>d.id===article.deckId).cards)for(const poem of article.poems)assert.ok(card.front.toLowerCase().includes(poem.toLowerCase()),card.id);for(const source of article.sources)assert.equal(new URL(source.url).protocol,'https:')}
});
test('article rendering escapes markup and never executes text as HTML',()=>{
 const fake=[{id:'probe',title:'<script>alert(1)</script>',subtitle:'<img src=x>',poems:['<b>poem</b>'],readMinutes:1,sections:[{title:'<script>',paragraphs:['<script>alert(2)</script>']}],retrieval:[{question:'<img>',answer:'<iframe>'}],sources:[{url:'javascript:alert(1)',label:'bad'}]}];
 const html=articlePage(fake,'probe',{});assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.match(html,/&lt;script&gt;/);
});
test('all bank days render three selections and solution provenance is explicit',()=>{
 for(let day=1;day<=30;day++){const html=problemPage(PROBLEM_BANK,{},day,new Date('2026-10-20T12:00:00Z'));assert.equal((html.match(/class="daily-problem"/g)||[]).length,3);assert.match(html,/repeats every 30 days/)}
 const noSolution=PROBLEM_BANK.find(p=>!p.solutionUrl);if(noSolution){const index=PROBLEM_BANK.filter(p=>p.level===noSolution.level).findIndex(p=>p.id===noSolution.id);const html=problemPage(PROBLEM_BANK,{},index+1);assert.match(html,/No verified free solution link/)}
});
