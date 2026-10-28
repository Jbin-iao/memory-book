(function () {
  'use strict';
  const $=id=>document.getElementById(id), store=window.RecordStore;
  const regions=['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','上海','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆','台湾','香港','澳门'];
  let records=[], photos=[], editing=null, chart=null, mapNames=[], editorBase=null;
  let ready=false, syncing=false, syncAgain=false, initialized=false;
  const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let calendarMonth=localDate().slice(0,7), selectedDay=localDate();
  const node=(tag,text,cls)=>{const el=document.createElement(tag); if(text) el.textContent=text;if(cls)el.className=cls;return el;};
  const notify=text=>{$('notice').textContent=text;};
  function option(select,value){select.add(new Option(value,value));}
  regions.forEach(r=>option($('place'),r));
  function edit(record, restoring=false) {
    if(!ready)return;
    if(!restoring && readDraft() && !confirm('已有未完成的草稿。打开这段回忆会替换草稿，是否继续？'))return;
    $('entry-form').reset(); editing=record?.id || null; photos=[...(record?.photos || [])];
    editorBase=restoring ? record?.base : (record || null);
    $('editor-title').textContent=editing?'编辑回忆':'记一笔';$('words').value=record?.text || '';
    const now=new Date(); now.setMinutes(now.getMinutes()-now.getTimezoneOffset());
    $('date').value=record?.date || now.toISOString().slice(0,10);
    if(record && ![...$('place').options].some(o=>o.value===record.place))option($('place'),record.place);
    $('place').value=record?.place || '';$('spot').value=record?.spot || '';
    $('tags').value=(record?.tags||[]).join('，');$('favorite').checked=record?.favorite===true;
    $('draft-status').textContent=restoring?'已恢复草稿':'输入内容后自动保存草稿';
    $('delete').hidden=!editing;$('form-error').textContent='';preview();$('editor').showModal();
  }
  function preview(){ $('preview').replaceChildren();photos.forEach((src,i)=>{const box=node('div');const img=node('img');img.src=src;img.alt='所选照片 '+(i+1);const remove=node('button','移除');remove.type='button';remove.onclick=()=>{photos.splice(i,1);preview();saveDraft();};box.append(img,remove);$('preview').append(box);}); }
  function render(){
    records=store.read().sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
    $('count').textContent=records.length+' 段回忆';$('recent-list').replaceChildren();$('timeline-list').replaceChildren();
    records.slice(0,3).forEach(r=>{const card=node('article',null,'entry');if(r.photos.length){const img=node('img');img.src=r.photos[0];img.alt=r.text;img.loading='lazy';card.append(img);}else card.append(node('div','这一刻','no-photo'));card.append(node('p',r.date+' · '+r.place,'meta'),node('p',r.text));const button=node('button','查看 / 编辑');button.onclick=()=>edit(r);card.append(button);$('recent-list').append(card);});
    const selectedTag=$('tag-filter').value;
    $('tag-filter').replaceChildren(new Option('全部标签',''));
    [...new Set(records.flatMap(r=>r.tags||[]))].sort().forEach(t=>option($('tag-filter'),t));
    if([...$('tag-filter').options].some(o=>o.value===selectedTag))$('tag-filter').value=selectedTag;
    renderTimeline();renderCalendar();renderThrowback();refreshDraft();
    if(!records.length){
      $('recent-list').append($('empty-records').content.cloneNode(true));
      $('recent-list').querySelector('[data-empty-new]').onclick=()=>edit();
    }
    window.lucide?.createIcons({attrs:{'aria-hidden':'true'}});
    const places=[...new Set(records.map(r=>r.place))];const selected=$('place-filter').value;$('place-filter').replaceChildren(new Option('全部地点',''));places.forEach(p=>option($('place-filter'),p));$('place-filter').value=places.includes(selected)?selected:'';
    $('place-count').textContent=places.length+' 个地点';renderPlaces();renderMap();
  }
  function renderTimeline(){
    const query=$('search').value.trim().toLocaleLowerCase();
    const filtered=records.filter(r=>(!query||[r.text,r.place,r.spot,...r.tags].join(' ').toLocaleLowerCase().includes(query))&&(!$('month-filter').value||r.date.startsWith($('month-filter').value))&&(!$('tag-filter').value||r.tags.includes($('tag-filter').value))&&(!$('favorite-filter').checked||r.favorite));
    $('timeline-list').replaceChildren();$('filter-count').textContent=`${filtered.length} / ${records.length} 段回忆`;
    filtered.forEach(r=>{
      const row=node('article',null,'timeline-row'), time=node('time',r.date), copy=node('div');time.dateTime=r.date;
      copy.append(node('p',r.text),node('small',[r.place,r.spot].filter(Boolean).join(' · ')));
      const tags=node('div',null,'tag-line');r.tags.forEach(t=>tags.append(node('span',t,'tag')));copy.append(tags);
      if(r.conflict)copy.append(node('span','不同设备的修改已保留，请核对后保存或删除副本。','conflict-label'));
      const actions=node('div',null,'row-actions'), button=node('button','查看 / 编辑'), favorite=node('button',r.favorite?'★ 已收藏':'☆ 收藏');
      favorite.setAttribute('aria-pressed',String(r.favorite));favorite.setAttribute('aria-label',(r.favorite?'取消收藏：':'收藏：')+r.text.slice(0,30));
      favorite.onclick=()=>{if(!ready)return;try{store.save({...r,favorite:!r.favorite},r);render();requestSync();}catch(e){notify(e.message);}};
      button.onclick=()=>edit(r);actions.append(favorite,button);row.append(time,copy,actions);$('timeline-list').append(row);
    });
    if(!filtered.length)$('timeline-list').append(node('p',records.length?'没有找到匹配的回忆，试试其他关键词或重置筛选。':'第一段回忆，会成为时间线的起点。','muted'));
  }
  function renderThrowback(){
    const today=localDate();let matches=records.filter(r=>r.date.slice(5)===today.slice(5)&&r.date.slice(0,4)<today.slice(0,4));
    $('throwback-title').textContent=matches.length?'往年今日':'本月回顾';
    if(!matches.length)matches=records.filter(r=>r.date.startsWith(today.slice(0,7))&&r.date<=today);
    $('throwback-caption').textContent=matches.length?'再读一次，那时的故事':'从今天开始，慢慢积攒回忆';
    $('throwback-list').replaceChildren();
    matches.slice(0,3).forEach(r=>{const b=node('button',null,'throwback-item');if(r.photos[0]){const img=node('img');img.src=r.photos[0];img.alt='回忆照片';b.append(img);}const copy=node('div');copy.append(node('small',r.date+' · '+r.place),node('span',r.text));b.append(copy);b.onclick=()=>edit(r);$('throwback-list').append(b);});
    if(!matches.length)$('throwback-list').append(node('p','这里会收藏往年今日的故事；没有同日记录时，展示本月回忆。','muted'));
  }
  function renderCalendar(){
    $('calendar-month').value=calendarMonth;$('calendar-grid').replaceChildren();
    const [year,month]=calendarMonth.split('-').map(Number), first=new Date(year,month-1,1), total=new Date(year,month,0).getDate();
    for(let i=0;i<(first.getDay()+6)%7;i++)$('calendar-grid').append(node('span'));
    for(let day=1;day<=total;day++){
      const date=calendarMonth+'-'+String(day).padStart(2,'0'), entries=records.filter(r=>r.date===date), b=node('button',String(day),'calendar-day');
      b.classList.toggle('has-records',entries.length>0);b.classList.toggle('is-today',date===localDate());b.setAttribute('aria-pressed',String(date===selectedDay));b.setAttribute('aria-label',date+'，'+entries.length+' 段回忆');
      if(entries.length)b.append(node('small',entries.length+' 段'));b.onclick=()=>{selectedDay=date;renderCalendar();};$('calendar-grid').append(b);
    }
    $('day-title').textContent=selectedDay;$('day-list').replaceChildren();const entries=records.filter(r=>r.date===selectedDay);
    entries.forEach(r=>{const b=node('button',r.text);b.append(node('small',r.place));b.onclick=()=>edit(r);$('day-list').append(b);});
    if(!entries.length)$('day-list').append(node('p','这一天还没有留下回忆。','muted'));
  }
  function readDraft(){try{return JSON.parse(localStorage.getItem(store.key+':draft')||'null');}catch{return null;}}
  function refreshDraft(){$('draft-banner').hidden=!readDraft();}
  function formRecord(){return {id:editing,text:$('words').value,date:$('date').value,place:$('place').value,spot:$('spot').value,photos:[...photos],tags:$('tags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean),favorite:$('favorite').checked};}
  function saveDraft(){
    if(!$('editor').open)return;
    try{localStorage.setItem(store.key+':draft',JSON.stringify({...formRecord(),base:editorBase,savedAt:new Date().toISOString()}));$('draft-status').textContent='草稿已保存到此浏览器';refreshDraft();}
    catch{$('draft-status').textContent='草稿保存失败，浏览器空间可能不足。请勿关闭页面。';}
  }
  function clearDraft(){localStorage.removeItem(store.key+':draft');refreshDraft();}
  $('entry-form').addEventListener('input',saveDraft);
  $('draft-resume').onclick=()=>{const d=readDraft();if(d)edit(d,true);};
  $('draft-discard').onclick=()=>{if(confirm('丢弃这份草稿？已保存的回忆不会受影响。'))clearDraft();};
  ['search','month-filter','tag-filter','favorite-filter'].forEach(id=>$(id).addEventListener('input',renderTimeline));
  $('clear-filters').onclick=()=>{$('search').value='';$('month-filter').value='';$('tag-filter').value='';$('favorite-filter').checked=false;renderTimeline();};
  function moveMonth(delta){const [y,m]=calendarMonth.split('-').map(Number);calendarMonth=localDate(new Date(y,m-1+delta,1)).slice(0,7);selectedDay=calendarMonth+'-01';renderCalendar();}
  $('calendar-prev').onclick=()=>moveMonth(-1);$('calendar-next').onclick=()=>moveMonth(1);
  $('calendar-month').onchange=()=>{if(/^\d{4}-\d{2}$/.test($('calendar-month').value)){calendarMonth=$('calendar-month').value;selectedDay=calendarMonth+'-01';renderCalendar();}};
  $('calendar-today').onclick=()=>{calendarMonth=localDate().slice(0,7);selectedDay=localDate();renderCalendar();};
  function renderPlaces(){const filtered=records.filter(r=>!$('place-filter').value||r.place===$('place-filter').value);$('place-list').replaceChildren();filtered.forEach(r=>{const button=node('button',r.text,'place-row');button.append(node('small',r.date+' · '+r.place+(r.spot?' · '+r.spot:'')));button.onclick=()=>edit(r);$('place-list').append(button);});if(!filtered.length)$('place-list').append(node('p','下一次出发，从这里留下足迹。','muted'));}
  function normalize(name){return name.replace(/特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市/g,'');}
  function renderMap(){if(!chart)return;chart.setOption({backgroundColor:'#eef3f0',tooltip:{show:false},visualMap:{show:false,min:0,max:Math.max(1,records.length),inRange:{color:['#d9e5dd','#47745c']}},series:[{type:'map',map:'memory-china',roam:true,label:{show:false},itemStyle:{areaColor:'#d9e5dd',borderColor:'#fff'},emphasis:{label:{color:'#273d35'},itemStyle:{areaColor:'#dca6b3'}},data:mapNames.map(name=>({name,value:records.filter(r=>r.place===normalize(name)).length}))}]});}
  async function loadMap(){
    try{
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        const timer=setTimeout(()=>reject(new Error('timeout')),15000);
        script.src='./assets/js/echarts.min.js';
        script.onload=()=>{clearTimeout(timer);resolve();};
        script.onerror=()=>{clearTimeout(timer);reject(new Error('map script'));};
        document.head.append(script);
      });
      const mapUrl=location.protocol==='file:'?'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json':'./assets/china-regions.json';
      const response=await fetch(mapUrl,{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('map');
      const geo=await response.json();
      mapNames=geo.features.map(f=>f.properties.name);
      window.echarts.registerMap('memory-china',geo);
      $('map').replaceChildren();
      chart=window.echarts.init($('map'));
      chart.on('click',e=>{
        const place=normalize(e.name);
        if([...$('place-filter').options].some(o=>o.value===place)){
          $('place-filter').value=place;renderPlaces();
        }else notify(place+' 还没有记录，点击“记一笔”留下回忆。');
      });
      renderMap();
      $('map-status').textContent='点击已记录的地区查看回忆 · 地图按省级地点展示';
      window.addEventListener('resize',()=>chart.resize());
    }catch{
      const placeholder=$('map').querySelector('.map-placeholder span');
      if(placeholder)placeholder.textContent='地图暂时无法加载';
      $('map-status').textContent='地图暂时无法加载。仍可通过地点列表查看和编辑全部回忆。';
    }
  }
  async function compress(file){if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>15*1024*1024)throw new Error('请选择 15 MB 以内的 JPG、PNG 或 WebP 照片。');const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,1400/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.8);}finally{URL.revokeObjectURL(url);}}
  document.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>edit());$('cancel').onclick=()=>$('editor').close();
  $('photos').onchange=async()=>{const files=[...$('photos').files];$('form-error').textContent='';if(files.length+photos.length>3){$('form-error').textContent='每条记录最多 3 张照片，请先移除已有照片。';$('photos').value='';return;}$('save').disabled=true;$('photos').disabled=true;$('cancel').disabled=true;try{photos.push(...await Promise.all(files.map(compress)));preview();saveDraft();}catch(e){$('form-error').textContent=e.message;}finally{$('save').disabled=false;$('photos').disabled=false;$('cancel').disabled=false;$('photos').value='';}};
  $('editor').addEventListener('cancel',e=>{if($('save').disabled)e.preventDefault();});
  $('entry-form').onsubmit=e=>{e.preventDefault();if($('save').disabled||!ready)return;try{const text=$('words').value.trim();if(!text)throw new Error('写一句话，再保存这段回忆。');const record=formRecord();if(record.tags.length>10||record.tags.some(t=>t.length>24))throw new Error('最多 10 个标签，每个标签不超过 24 字。');store.save({...record,id:editing||crypto.randomUUID(),text,conflict:false},editorBase);clearDraft();render();$('editor').close();notify('回忆已保存。');requestSync();}catch(error){$('form-error').textContent=error.message;}};
  $('delete').onclick=()=>{if(!ready||!confirm('确定删除这条记录？已导出的备份不会受影响。'))return;try{store.remove(editing,editorBase);clearDraft();render();$('editor').close();notify('记录已删除。');requestSync();}catch(e){$('form-error').textContent=e.message;}};
  $('place-filter').onchange=renderPlaces;
  $('export').onclick=()=>{try{const blob=new Blob([store.backup()],{type:'application/json'});const url=URL.createObjectURL(blob);const a=node('a');a.href=url;a.download='memory-book-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('备份已生成，包含文字和照片。可传到另一台设备后导入；文件包含你的私人回忆。');}catch(e){notify(e.message);}};
  $('import').onclick=()=>{if(ready)$('backup').click();};$('backup').onchange=async()=>{try{const file=$('backup').files[0];if(!file||!ready)return;if(file.size>30*1024*1024)throw new Error('备份文件超过 30 MB，无法导入。');const raw=await file.text();if(!ready)throw new Error('账号已变化，请刷新后再导入。');const count=store.import(raw);render();requestSync();notify('已导入 '+count+' 条记录；相同编号的现有记录已保留。');}catch(e){notify('导入失败：'+e.message);}finally{$('backup').value='';}};
  window.addEventListener('storage',e=>{if(e.key===store.key){try{render();}catch(error){notify(error.message);}}});
  try{const migrated=store.migrate();render();if(migrated)notify('已迁移 '+migrated+' 个旧地图地点；日期暂取原记录更新时间，可在编辑中修正。旧数据仍保留。');}catch(e){notify('无法读取记录：'+e.message+' 原始数据未删除。');}
  const navLinks=[...document.querySelectorAll('nav a')];
  function updateNavigation(){
    const offset=window.innerWidth<=760?180:110;
    let active=navLinks[0];
    navLinks.forEach(link=>{if(document.querySelector(link.hash).getBoundingClientRect().top<=offset)active=link;});
    if(window.scrollY>0 && window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-4)active=navLinks[navLinks.length-1];
    navLinks.forEach(link=>{if(link===active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
  }
  window.addEventListener('scroll',updateNavigation,{passive:true});
  window.addEventListener('resize',updateNavigation);
  window.lucide?.createIcons({attrs:{'aria-hidden':'true'}});
  updateNavigation();
  function syncStatus(message,state='local'){
    $('sync-status').textContent=message;$('sync-status').parentElement.dataset.state=state;
    $('sync-retry').hidden=state!=='error';
    document.querySelector('.storage-label').textContent=message;
  }
  async function requestSync(){
    if(!initialized)return;
    if(syncing){syncAgain=true;return;}
    syncing=true;syncStatus('已本地保存 · 正在同步…','syncing');
    try{
      do{
        syncAgain=false;
        const result=await store.syncToCloud();
        if(result.synced){
          render();syncAgain=syncAgain||result.pending;
          syncStatus('已同步 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),'synced');
          if(result.conflicts)notify('发现不同设备的修改，已保留冲突版本。请在时间线中核对。');
        }else syncStatus(window.getSupabase?.()?'仅保存在此浏览器 · 登录后可跨设备同步':'仅保存在此浏览器 · 云同步尚未配置');
      }while(syncAgain);
    }catch(error){syncStatus('已本地保存 · 同步失败，可重试','error');notify(error.message||'网络暂时不可用，记录仍保存在此浏览器。');}
    finally{syncing=false;}
  }
  async function initialize(){
    ready=false;
    if($('editor').open){saveDraft();$('editor').close();}
    try{
      const state=await store.initialize();initialized=true;ready=true;render();
      if(state.account)notify('已打开当前账号的记忆册。访客记录仍保存在原空间，可退出登录后导出，再登录导入。');
      if(!state.configured)syncStatus('仅保存在此浏览器 · 云同步尚未配置');
      else await requestSync();
    }catch(error){ready=true;syncStatus('云端连接失败 · 可继续本地记录','error');notify(error.message||'连接失败，请重试。');}
  }
  $('sync-retry').onclick=()=>initialized?requestSync():initialize();
  window.addEventListener('online',()=>initialized&&requestSync());
  window.addEventListener('focus',()=>{renderThrowback();if(initialized)requestSync();});
  const client=window.getSupabase?.();
  client?.auth.onAuthStateChange((event,session)=>{if(initialized && (event==='SIGNED_OUT'||event==='SIGNED_IN') && store.key!==(session?.user?.id?'memory-book-records-v1:'+session.user.id:'memory-book-records-v1')){ready=false;syncStatus('账号状态已变化，请刷新页面后继续','error');}});
  initialize();
  loadMap();
})();
