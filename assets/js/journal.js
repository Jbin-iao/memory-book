(function () {
  'use strict';
  const $=id=>document.getElementById(id), store=window.RecordStore;
  const regions=['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','上海','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆','台湾','香港','澳门'];
  let records=[], photos=[], editing=null, chart=null, mapNames=[];
  const node=(tag,text,cls)=>{const el=document.createElement(tag); if(text) el.textContent=text;if(cls)el.className=cls;return el;};
  const notify=text=>{$('notice').textContent=text;};
  function option(select,value){select.add(new Option(value,value));}
  regions.forEach(r=>option($('place'),r));
  function edit(record) {
    $('entry-form').reset(); editing=record?.id || null; photos=[...(record?.photos || [])];
    $('editor-title').textContent=record?'编辑回忆':'记一笔';$('words').value=record?.text || '';
    const now=new Date(); now.setMinutes(now.getMinutes()-now.getTimezoneOffset());
    $('date').value=record?.date || now.toISOString().slice(0,10);
    if(record && ![...$('place').options].some(o=>o.value===record.place))option($('place'),record.place);
    $('place').value=record?.place || '';$('spot').value=record?.spot || '';
    $('delete').hidden=!record;$('form-error').textContent='';preview();$('editor').showModal();
  }
  function preview(){ $('preview').replaceChildren();photos.forEach((src,i)=>{const box=node('div');const img=node('img');img.src=src;img.alt='所选照片 '+(i+1);const remove=node('button','移除');remove.type='button';remove.onclick=()=>{photos.splice(i,1);preview();};box.append(img,remove);$('preview').append(box);}); }
  function render(){
    records=store.read().sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
    $('count').textContent=records.length+' 段回忆';$('recent-list').replaceChildren();$('timeline-list').replaceChildren();
    records.slice(0,3).forEach(r=>{const card=node('article',null,'entry');if(r.photos.length){const img=node('img');img.src=r.photos[0];img.alt=r.text;img.loading='lazy';card.append(img);}else card.append(node('div','这一刻','no-photo'));card.append(node('p',r.date+' · '+r.place,'meta'),node('p',r.text));const button=node('button','查看 / 编辑');button.onclick=()=>edit(r);card.append(button);$('recent-list').append(card);});
    records.forEach(r=>{const row=node('article',null,'timeline-row');const time=node('time',r.date);time.dateTime=r.date;const copy=node('div');copy.append(node('p',r.text),node('small',[r.place,r.spot].filter(Boolean).join(' · ')));const button=node('button','查看回忆');button.onclick=()=>edit(r);row.append(time,copy,button);$('timeline-list').append(row);});
    if(!records.length){
      $('recent-list').append($('empty-records').content.cloneNode(true));
      $('recent-list').querySelector('[data-empty-new]').onclick=()=>edit();
      $('timeline-list').append(node('p','第一段回忆，会成为时间线的起点。','muted'));
    }
    window.lucide?.createIcons({attrs:{'aria-hidden':'true'}});
    const places=[...new Set(records.map(r=>r.place))];const selected=$('place-filter').value;$('place-filter').replaceChildren(new Option('全部地点',''));places.forEach(p=>option($('place-filter'),p));$('place-filter').value=places.includes(selected)?selected:'';
    $('place-count').textContent=places.length+' 个地点';renderPlaces();renderMap();
  }
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
  $('photos').onchange=async()=>{const files=[...$('photos').files];$('form-error').textContent='';if(files.length+photos.length>3){$('form-error').textContent='每条记录最多 3 张照片，请先移除已有照片。';$('photos').value='';return;}$('save').disabled=true;$('photos').disabled=true;$('cancel').disabled=true;try{photos.push(...await Promise.all(files.map(compress)));preview();}catch(e){$('form-error').textContent=e.message;}finally{$('save').disabled=false;$('photos').disabled=false;$('cancel').disabled=false;$('photos').value='';}};
  $('editor').addEventListener('cancel',e=>{if($('save').disabled)e.preventDefault();});
  $('entry-form').onsubmit=e=>{e.preventDefault();if($('save').disabled)return;try{const text=$('words').value.trim();if(!text)throw new Error('写一句话，再保存这段回忆。');store.save({id:editing||crypto.randomUUID(),text,date:$('date').value,place:$('place').value,spot:$('spot').value.trim(),photos});render();$('editor').close();notify('已保存到此浏览器。记得导出备份，把照片和文字一起带走。');}catch(error){$('form-error').textContent=error.message;}};
  $('delete').onclick=()=>{if(!confirm('确定删除这条记录？已导出的备份不会受影响。'))return;try{store.remove(editing);render();$('editor').close();notify('记录已删除。');}catch(e){$('form-error').textContent=e.message;}};
  $('place-filter').onchange=renderPlaces;
  $('export').onclick=()=>{try{const blob=new Blob([store.backup()],{type:'application/json'});const url=URL.createObjectURL(blob);const a=node('a');a.href=url;a.download='memory-book-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('备份已生成，包含文字和照片。可传到另一台设备后导入；文件包含你的私人回忆。');}catch(e){notify(e.message);}};
  $('import').onclick=()=>$('backup').click();$('backup').onchange=async()=>{try{const file=$('backup').files[0];if(!file)return;if(file.size>30*1024*1024)throw new Error('备份文件超过 30 MB，无法导入。');const count=store.import(await file.text());render();notify('已导入 '+count+' 条记录；相同编号的现有记录已保留。');}catch(e){notify('导入失败：'+e.message);}finally{$('backup').value='';}};
  window.addEventListener('storage',e=>{if(e.key==='memory-book-records-v1'){try{render();}catch(error){notify(error.message);}}});
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
  loadMap();
})();
