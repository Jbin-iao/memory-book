(function () {
  'use strict';

  const ROOT_KEY = 'memory-book-records-v1';
  let KEY = ROOT_KEY;
  let account = null;
  const ARCHIVE_TABLE = 'romantic_archives';

  function validate(r) {
    if (!r || typeof r.id !== 'string' || !r.id || typeof r.text !== 'string' || r.text.length > 2000 || typeof r.place !== 'string' || r.place.length > 100 || typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0, 10) !== r.date || !Array.isArray(r.photos) || r.photos.length > 3 || r.photos.some(p => typeof p !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p))) {
      throw new Error('备份中的记录格式不正确，未作任何修改。');
    }
    const tags = Array.isArray(r.tags) ? [...new Set(r.tags.map(t => String(t).trim()).filter(Boolean))].slice(0, 10).map(t => t.slice(0, 24)) : [];
    return { id: r.id, text: r.text, place: r.place, date: r.date, photos: r.photos, spot: typeof r.spot === 'string' ? r.spot.slice(0, 100) : '', tags, favorite: r.favorite === true, conflict: r.conflict === true };
  }

  function readLocal() {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw).map(validate) : [];
  }

  function writeLocal(records) {
    const clean = records.map(validate);
    try { localStorage.setItem(KEY, JSON.stringify(clean)); }
    catch { throw new Error('保存失败，浏览器空间不足或不允许保存。请先导出备份；当前内容仍保留在表单中。'); }
    return clean;
  }

  function client() { return typeof window.getSupabase === 'function' ? window.getSupabase() : null; }

  async function currentUser(supabase) {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error && error.name !== 'AuthSessionMissingError') throw error;
    return data?.user || null;
  }

  function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function conflictCopy(record) {
    const copy = { ...record, conflict: true };
    let hash = 2166136261;
    for (const char of JSON.stringify(record)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    copy.id = record.id + '-conflict-' + (hash >>> 0).toString(16);
    return copy;
  }

  // Three-way merge: independent edits combine; competing edits retain both versions.
  function merge(base, local, remote) {
    const maps = [base, local, remote].map(items => new Map(items.map(r => [r.id, validate(r)])));
    const result = new Map();
    for (const id of new Set([...maps[0].keys(), ...maps[1].keys(), ...maps[2].keys()])) {
      const [b, l, r] = maps.map(m => m.get(id));
      if (equal(l, r)) { if (l) result.set(id, l); }
      else if (equal(l, b)) { if (r) result.set(id, r); }
      else if (equal(r, b)) { if (l) result.set(id, l); }
      else if (l && r) { result.set(id, r); const copy = conflictCopy(l); result.set(copy.id, copy); }
      else { const survivor = l || r; if (survivor) result.set(id, { ...survivor, conflict: true }); }
    }
    return [...result.values()];
  }

  async function initialize() {
    const supabase = client();
    const user = await currentUser(supabase);
    account = user?.id || null;
    KEY = account ? ROOT_KEY + ':' + account : ROOT_KEY;
    return { account, configured: !!supabase };
  }

  async function syncArchive() {
    const supabase = client();
    const user = await currentUser(supabase);
    if (!user && !account) return { synced: false, reason: 'signed-out' };
    if (user?.id !== account) throw new Error('登录账号已变化，请刷新页面后继续。');
    const syncKey = KEY;
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data, error } = await supabase.from(ARCHIVE_TABLE).select('data,updated_at').eq('user_id', account).maybeSingle();
      if (error) throw error;
      if (data && !Array.isArray(data.data?.records)) throw new Error('云端数据格式无法识别，已停止同步并保留本地记录。');
      const remote = (data?.data.records || []).map(validate);
      const base = JSON.parse(localStorage.getItem(KEY + ':base') || '[]').map(validate);
      const local = readLocal();
      const merged = merge(base, local, remote);
      const stamp = new Date(Math.max(Date.now(), Date.parse(data?.updated_at || 0) + 1 || 0)).toISOString();
      const payload = { user_id: account, data: { format: 'memory-book', version: 1, records: merged }, updated_at: stamp };
      let response;
      if (data) response = await supabase.from(ARCHIVE_TABLE).update(payload).eq('user_id', account).eq('updated_at', data.updated_at).select('updated_at');
      else response = await supabase.from(ARCHIVE_TABLE).insert(payload).select('updated_at');
      if (response.error) { if (response.error.code === '23505') continue; throw response.error; }
      if (!response.data?.length) continue;
      if (KEY !== syncKey) throw new Error('账号已变化，请刷新页面。');
      // Preserve edits made while the network request was in flight.
      const current = readLocal();
      const final = merge(local, current, merged);
      writeLocal(final);
      localStorage.setItem(KEY + ':base', JSON.stringify(merged));
      return { synced: true, pending: !equal(final, merged), conflicts: final.filter(r => r.conflict).length };
    }
    throw new Error('其他设备正在更新，请稍后重试。你的修改仍保存在本地。');
  }

  function syncToCloud() {
    return window.navigator?.locks
      ? window.navigator.locks.request('memory-book-sync:' + KEY, syncArchive)
      : syncArchive();
  }

  window.RecordStore = {
    read: readLocal,
    validate,
    merge,
    initialize,
    get key() { return KEY; },
    save(record, expected) {
      const records = readLocal();
      const i = records.findIndex(r => r.id === record.id);
      if (expected && !equal(i < 0 ? undefined : records[i], expected)) {
        if (i >= 0) records.push(conflictCopy(records[i]));
        else record = { ...record, conflict: true };
      }
      if (i < 0) records.push(record); else records[i] = record;
      return writeLocal(records);
    },
    remove(id, expected) {
      const records = readLocal();
      if (expected && !equal(records.find(r => r.id === id), expected)) throw new Error('这段回忆已在其他页面或设备更新，请重新打开后再删除。');
      return writeLocal(records.filter(r => r.id !== id));
    },
    backup() { return JSON.stringify({ format: 'memory-book', version: 1, exportedAt: new Date().toISOString(), records: readLocal() }, null, 2); },
    import(raw) {
      const data = JSON.parse(raw);
      if (data.format !== 'memory-book' || data.version !== 1 || !Array.isArray(data.records)) throw new Error('请选择 Memory Book 导出的备份文件。');
      const incoming = data.records.map(validate);
      const records = readLocal();
      const ids = new Set(records.map(r => r.id));
      let added = 0;
      incoming.forEach(r => { if (!ids.has(r.id)) { records.push(r); ids.add(r.id); added++; } });
      writeLocal(records);
      return added;
    },
    migrate() {
      if (localStorage.getItem(KEY) !== null) return 0;
      const legacy = JSON.parse(localStorage.getItem('map_memory_data') || '{}');
      const records = Object.entries(legacy).map(([place, r]) => ({ id: 'legacy-' + place, place, text: r.description || '从旧足迹导入的回忆', date: (r.updatedAt || new Date().toISOString()).slice(0, 10), spot: '', photos: r.photos || [] }));
      if (records.length) writeLocal(records);
      return records.length;
    },
    loadFromCloud: syncToCloud,
    syncToCloud
  };
})();
