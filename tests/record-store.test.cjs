const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const data = new Map();
let fail = false;
const context = { window: {}, localStorage: {
  getItem: key => data.get(key) ?? null,
  setItem: (key, value) => { if (fail) throw Error('quota'); data.set(key, value); }
}};
vm.runInNewContext(fs.readFileSync('assets/js/record-store.js', 'utf8'), context);
const store = context.window.RecordStore;
const record = {id:'1', text:'日常 <script> & café', place:'浙江', date:'2026-09-18', spot:'湖边', photos:['data:image/jpeg;base64,YQ==']};
store.save(record);
assert.equal(store.read()[0].text, record.text);
const backup = store.backup();
assert.equal(store.import(backup), 0);
store.remove('1');
assert.equal(store.read().length, 0);
assert.equal(store.import(backup), 1);
assert.equal(store.read()[0].photos[0], record.photos[0]);
const before = JSON.stringify(store.read());
assert.throws(() => store.import(JSON.stringify({format:'memory-book', version:1, records:[{...record,id:'2'}, {...record,date:'2026-02-30'}]})));
assert.equal(JSON.stringify(store.read()), before);
fail = true;
assert.throws(() => store.save({...record,id:'2'}));
fail = false;
assert.equal(store.read().length, 1);
data.clear();
data.set('map_memory_data', JSON.stringify({'浙江':{description:'旧回忆',updatedAt:'2025-02-01T00:00:00Z',photos:[]}}));
assert.equal(store.migrate(), 1);
assert.equal(store.migrate(), 0);
assert.equal(store.read()[0].text, '旧回忆');
assert.ok(data.has('map_memory_data'));
console.log('PASS: save, delete, photo backup round trip, duplicate import, invalid import atomicity, quota preservation, legacy migration');
