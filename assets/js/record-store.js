(function () {
  'use strict';
  const KEY = 'memory-book-records-v1';
  function validate(r) {
    if (!r || typeof r.id !== 'string' || !r.id || typeof r.text !== 'string' || r.text.length > 2000 || typeof r.place !== 'string' || r.place.length > 100 || typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0, 10) !== r.date || !Array.isArray(r.photos) || r.photos.length > 3 || r.photos.some(p => typeof p !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p))) throw new Error('备份中的记录格式不正确，未作任何修改。');
    return {id:r.id, text:r.text, place:r.place, date:r.date, photos:r.photos, spot:typeof r.spot === 'string' ? r.spot.slice(0,100) : ''};
  }
  function read() { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw).map(validate) : []; }
  function write(records) { const clean = records.map(validate); try {localStorage.setItem(KEY, JSON.stringify(clean));} catch {throw new Error('保存失败，浏览器空间不足或不允许保存。请先导出备份；当前内容仍保留在表单中。');} return clean; }
  window.RecordStore = {
    read, validate,
    save(record) { const records = read(); const i = records.findIndex(r => r.id === record.id); if(i < 0) records.push(record); else records[i] = record; return write(records); },
    remove(id) { return write(read().filter(r => r.id !== id)); },
    backup() { return JSON.stringify({format:'memory-book', version:1, exportedAt:new Date().toISOString(), records:read()}, null, 2); },
    import(raw) { const data = JSON.parse(raw); if(data.format !== 'memory-book' || data.version !== 1 || !Array.isArray(data.records)) throw new Error('请选择 Memory Book 导出的备份文件。'); const incoming = data.records.map(validate); const records=read(); const ids=new Set(records.map(r=>r.id)); let added=0; incoming.forEach(r=>{if(!ids.has(r.id)){records.push(r);ids.add(r.id);added++;}}); write(records); return added; },
    migrate() { if(localStorage.getItem(KEY) !== null) return 0; const legacy=JSON.parse(localStorage.getItem('map_memory_data') || '{}'); const records=Object.entries(legacy).map(([place,r])=>({id:'legacy-'+place,place,text:r.description || '从旧足迹导入的回忆',date:(r.updatedAt || new Date().toISOString()).slice(0,10),spot:'',photos:r.photos || []})); if(records.length) write(records); return records.length; }
  };
})();
