const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('assets/js/record-store.js', 'utf8');
const make = (id, text = id) => ({ id, text, place: '浙江', date: '2026-10-28', photos: [], tags: ['旅行'] });
let cloud = null, beforeWrite = null, writes = 0, failures = false;
function device(user = 'alice') {
  const data = new Map();
  const client = {
    auth: { getUser: async () => ({data: {user: user ? {id:user} : null}}) },
    from() {
      let mode = 'read', payload, filters = {};
      const query = {
        select() { return query; },
        eq(k,v) { filters[k]=v; return query; },
        update(p) {mode='update';payload=p;return query;},
        insert(p) {mode='insert';payload=p;return query;},
        async maybeSingle(){return {data:structuredClone(cloud)};},
        async then(resolve,reject) {
          try {
            if(failures)throw Error('offline');
            if(beforeWrite){const hook=beforeWrite;beforeWrite=null;await hook();}
            if(mode==='insert'&&cloud)return resolve({error:{code:'23505'}});
            if(mode==='update'&&cloud.updated_at!==filters.updated_at)return resolve({data:[]});
            cloud=structuredClone(payload);writes++;resolve({data:[{updated_at:cloud.updated_at}]});
          }catch(e){reject(e);}
        }
      };return query;
    }
  };
  const context={window:{getSupabase:()=>client},localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}};
  vm.runInNewContext(source,context);
  return {store:context.window.RecordStore,data};
}
(async()=>{
  const a=device(),b=device();await a.store.initialize();await b.store.initialize();
  a.store.save(make('one'));await a.store.syncToCloud();await b.store.syncToCloud();
  a.store.save(make('a'));b.store.save(make('b'));await a.store.syncToCloud();await b.store.syncToCloud();await a.store.syncToCloud();
  assert.equal(a.store.read().length,3,'independent additions merge');
  a.store.save(make('one','A edit'));b.store.save(make('one','B edit'));
  await a.store.syncToCloud();await b.store.syncToCloud();
  assert.ok(b.store.read().some(r=>r.text==='A edit'));
  assert.ok(b.store.read().some(r=>r.text==='B edit'&&r.conflict),'competing edits retain both');
  await a.store.syncToCloud();a.store.remove('a');await a.store.syncToCloud();await b.store.syncToCloud();
  assert.ok(!b.store.read().some(r=>r.id==='a'),'deletion propagates');
  a.store.remove('b');b.store.save(make('b','keep edited version'));await a.store.syncToCloud();await b.store.syncToCloud();
  assert.ok(b.store.read().some(r=>r.id==='b'&&r.conflict),'edit/delete preserves edited version');
  beforeWrite=()=>{cloud.data.records.push(make('race'));cloud.updated_at=new Date(Date.parse(cloud.updated_at)+10).toISOString();};
  await b.store.syncToCloud();assert.ok(b.store.read().some(r=>r.id==='race'),'CAS retries on concurrent writer');
  beforeWrite=()=>b.store.save(make('inflight'));
  const result=await b.store.syncToCloud();assert.equal(result.pending,true);assert.ok(b.store.read().some(r=>r.id==='inflight'));
  await b.store.syncToCloud();assert.ok(cloud.data.records.some(r=>r.id==='inflight'));
  failures=true;b.store.save(make('offline'));await assert.rejects(b.store.syncToCloud());assert.ok(b.store.read().some(r=>r.id==='offline'));failures=false;
  const stale=b.store.read().find(r=>r.id==='one');b.store.save({...stale,text:'new version'});b.store.save({...stale,text:'editor version'},stale);
  assert.ok(b.store.read().some(r=>r.text==='new version'&&r.conflict),'stale editor keeps latest version');
  assert.throws(()=>b.store.remove('one',stale),'stale editor cannot delete a newer version');
  const guest=device(null);guest.store.save(make('guest'));await guest.store.initialize();assert.equal(guest.store.read().length,1);
  const account=device();account.store.save(make('private guest'));await account.store.initialize();assert.equal(account.store.read().length,0,'account namespace separates guest data');
  const legacy=JSON.stringify({format:'memory-book',version:1,records:[make('old')]});account.store.import(legacy);assert.equal(account.store.read()[0].tags[0],'旅行');
  console.log('PASS: independent edits, conflicts, deletes, delete/edit, CAS race, in-flight edits, offline preservation, stale editor, account isolation, tags backup');
})().catch(e=>{console.error(e);process.exitCode=1;});
