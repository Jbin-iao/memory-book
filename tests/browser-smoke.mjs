// Isolated local Chrome session: never touches an existing browser profile.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
const profile=await mkdtemp(join(tmpdir(),'memory-book-qa-'));
const browser=spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let ws;
try {
  let port;
  for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await pause(100);}}
  assert.ok(port,'Chrome debugging endpoint');
  const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map(),errors=[];
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:process.env.PREVIEW_URL||'http://127.0.0.1:4173/'});
  for(let i=0;i<100;i++){if(await evaluate(`document.getElementById('sync-status')?.textContent.includes('尚未配置')`))break;await pause(100);}
  assert.equal(await evaluate(`document.getElementById('sync-status').textContent.includes('尚未配置')`),true);
  await evaluate(`window.qaInput=(id,value)=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));};document.querySelector('[data-new]').click();qaInput('words','湖边散步 <script>');qaInput('tags','旅行，朋友');qaInput('place','浙江');document.getElementById('favorite').checked=true;document.getElementById('favorite').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('cancel').click();`);
  assert.equal(await evaluate(`!document.getElementById('draft-banner').hidden`),true);
  await send('Page.reload');
  for(let i=0;i<100;i++){if(await evaluate(`document.getElementById('sync-status')?.textContent.includes('尚未配置')`))break;await pause(50);}
  await evaluate(`document.getElementById('draft-resume').click()`);
  assert.equal(await evaluate(`document.getElementById('words').value`),'湖边散步 <script>');
  await evaluate(`document.getElementById('entry-form').requestSubmit()`);
  assert.equal(await evaluate(`RecordStore.read()[0].tags.join(',')`),'旅行,朋友');
  assert.equal(await evaluate(`RecordStore.read()[0].favorite`),true);
  assert.equal(await evaluate(`document.getElementById('draft-banner').hidden`),true);
  await evaluate(`window.qaInput=(id,value)=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));};qaInput('search','不存在')`);
  assert.equal(await evaluate(`document.querySelectorAll('.timeline-row').length`),0);
  await evaluate(`qaInput('search','朋友')`);assert.equal(await evaluate(`document.querySelectorAll('.timeline-row').length`),1);
  await evaluate(`qaInput('search','');document.getElementById('tag-filter').value='旅行';document.getElementById('tag-filter').dispatchEvent(new Event('input'));`);
  assert.equal(await evaluate(`document.querySelectorAll('.timeline-row').length`),1);
  await evaluate(`document.querySelector('.calendar-day.has-records').click()`);
  assert.equal(await evaluate(`document.querySelectorAll('#day-list button').length`),1);
  await evaluate(`document.getElementById('calendar-month').value='2024-02';document.getElementById('calendar-month').dispatchEvent(new Event('change'))`);
  assert.equal(await evaluate(`document.querySelectorAll('.calendar-day').length`),29);
  await evaluate(`document.getElementById('calendar-today').click();const d=new Date();d.setFullYear(d.getFullYear()-1);const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');RecordStore.save({id:'past',text:'去年的秋日旅行',date,place:'云南',photos:[],tags:['旅行']});window.dispatchEvent(new StorageEvent('storage',{key:RecordStore.key}));`);
  assert.equal(await evaluate(`document.getElementById('throwback-title').textContent`),'往年今日');
  assert.equal(await evaluate(`document.getElementById('throwback-list').textContent.includes('去年的秋日旅行')`),true);
  await mkdir('artifacts',{recursive:true});
  await evaluate(`document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0)`);
  await writeFile('artifacts/memory-book-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`),true,'no horizontal overflow on mobile');
  await evaluate(`document.getElementById('calendar').scrollIntoView()`);
  await writeFile('artifacts/memory-book-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  assert.equal(errors.length,0,'no uncaught browser errors');
  console.log('PASS: draft reload/restore, save tags/favorite, search, tag filter, calendar selection/leap year, throwback, mobile overflow, runtime errors');
  console.log('Screenshots: '+resolve('artifacts'));
} finally {
  ws?.close();browser.kill();await pause(500);
  // Verify the absolute deletion target belongs to this test's temporary directory.
  assert.ok(resolve(profile).startsWith(resolve(tmpdir())+sep) && profile.includes('memory-book-qa-'));
  await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:300}).catch(()=>{});
}
