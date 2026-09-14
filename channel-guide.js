(function(){
  'use strict';
  if(window.__infinityChannelGuide)return;window.__infinityChannelGuide=true;
  const ROOT='https://www-infinity4.github.io/';
  const REGISTRY=ROOT+'Control-Phi/channels.json';
  const SEARCH=ROOT+'C13b0/phi';
  const NEWS=ROOT+'News-Phi/';
  const OMNI=ROOT+'Omni-TV/';
  const CACHE_KEY='controlPhi:liveGuide:v2';
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const valid=value=>value&&!/loading|checking|choose|unavailable|station break|intermission/i.test(value);
  const readCache=()=>{try{return JSON.parse(localStorage.getItem(CACHE_KEY))||{}}catch{return {}}};
  const writeCache=value=>{try{localStorage.setItem(CACHE_KEY,JSON.stringify(value))}catch{}};
  const safeUrl=(value,base=location.href)=>{try{const url=new URL(value,base);return /^https?:$/.test(url.protocol)?url.href:''}catch{return ''}};

  function normalizeChannelMenu(){
    const menu=document.querySelector('details.channel-menu, details[data-channel-menu]');
    if(!menu)return;
    const summary=menu.querySelector(':scope > summary')||menu.querySelector('summary');
    if(summary){summary.setAttribute('aria-label','Open channels');summary.innerHTML='<span aria-hidden="true">☰</span><span class="control-phi-channel-label">Channels</span>'}
    menu.dataset.controlPhi='connected';
    if(!document.getElementById('controlPhiChannelShellStyles')){
      const style=document.createElement('style');style.id='controlPhiChannelShellStyles';style.textContent='details.channel-menu>summary,details[data-channel-menu]>summary{width:auto!important;min-width:104px!important;min-height:40px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;padding:0 12px!important;white-space:nowrap!important}details.channel-menu>summary .control-phi-channel-label,details[data-channel-menu]>summary .control-phi-channel-label{display:inline!important;font:900 12px/1 system-ui,sans-serif!important;letter-spacing:.04em!important;text-transform:uppercase!important}';document.head.appendChild(style)
    }
  }

  function currentProgram(doc=document){
    const selectors=['[data-now-playing]','#nowTitle','#programTitle','#nowPlaying','.now-title','.guide-row.current .program-title','.guide-row.current strong','.row.now strong'];
    for(const selector of selectors){const value=clean(doc.querySelector(selector)?.textContent);if(valid(value))return value}
    return '';
  }

  function currentImage(doc=document,base=location.href){
    const direct=doc.querySelector('[data-program-art] img,[data-now-art] img,.guide-row.current img,.row.now img,.current-program img')?.getAttribute?.('src')||'';
    if(direct)return safeUrl(direct,base);
    try{const raw=doc.body?.style?.getPropertyValue('--program-art')||doc.documentElement?.style?.getPropertyValue('--program-art')||'';const match=String(raw).match(/url\(["']?([^"')]+)["']?\)/i);if(match?.[1])return safeUrl(match[1],base)}catch{}
    return safeUrl(doc.querySelector('meta[property="og:image"],meta[name="twitter:image"]')?.content||'',base);
  }

  function styles(){
    if(document.getElementById('infinityChannelGuideStyles'))return;
    const style=document.createElement('style');style.id='infinityChannelGuideStyles';style.textContent=`
      #infinityChannelGuide{--icg-line:rgba(255,255,255,.15);--icg-muted:#b8c0cc;width:100%;padding:34px max(14px,calc((100vw - 1120px)/2));border-top:1px solid var(--icg-line);background:#05070b;color:#fff;font:15px/1.35 Inter,system-ui,sans-serif}
      #infinityChannelGuide *{box-sizing:border-box}#infinityChannelGuide header{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:0 0 13px}#infinityChannelGuide h2{margin:3px 0 0;font-size:clamp(1.7rem,4vw,2.8rem)}#infinityChannelGuide .icg-kicker{margin:0;color:#7dd3fc;font-size:.72rem;font-weight:950;letter-spacing:.16em}
      .icg-tools{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}.icg-tools a{min-height:42px;display:inline-flex;align-items:center;padding:0 13px;border:1px solid var(--icg-line);border-radius:999px;background:#0d1420;color:#fff;text-decoration:none;font-weight:850}.icg-tools a:first-child{background:linear-gradient(135deg,#0ea5e9,#7c3aed)}
      .icg-phi-search{display:flex;gap:8px;width:min(520px,100%)}.icg-phi-search input{min-width:0;flex:1;min-height:48px;padding:0 14px;border:1px solid var(--icg-line);border-radius:13px;background:#111827;color:#fff;font:inherit}.icg-phi-search button{min-height:48px;padding:0 16px;border:0;border-radius:13px;background:linear-gradient(135deg,#0ea5e9,#7c3aed);color:#fff;font-weight:900;cursor:pointer}
      .icg-filter{width:100%;min-height:46px;margin:0 0 12px;padding:0 14px;border:1px solid var(--icg-line);border-radius:12px;background:#0d121b;color:#fff;font:inherit}.icg-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.icg-channel{min-width:0;min-height:82px;display:grid;grid-template-columns:94px minmax(0,1fr);align-items:center;gap:12px;padding:8px;border:1px solid var(--icg-line);border-radius:14px;background:linear-gradient(90deg,#131923,#090d14);color:#fff;text-decoration:none;overflow:hidden;isolation:isolate}.icg-channel:hover,.icg-channel:focus,.icg-channel[aria-current=page]{border-color:#7dd3fc;background:linear-gradient(90deg,#18304a,#0b111a)}.icg-art{width:94px;height:66px;object-fit:cover;border-radius:9px;background:#111827}.icg-art[hidden]{display:block;visibility:hidden}.icg-channel span{min-width:0;display:grid;gap:3px}.icg-channel small{color:#fca5a5;font-size:.68rem;font-weight:950;letter-spacing:.12em}.icg-channel strong,.icg-channel em{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.icg-channel strong{font-size:1rem}.icg-channel em{color:var(--icg-muted);font-size:.82rem;font-style:normal}.icg-probe{position:fixed!important;left:-5000px!important;top:-5000px!important;width:900px!important;height:600px!important;opacity:0!important;pointer-events:none!important;border:0!important}
      @media(max-width:720px){#infinityChannelGuide header{align-items:stretch;flex-direction:column}.icg-list{grid-template-columns:1fr}.icg-phi-search{width:100%}.icg-channel{grid-template-columns:82px minmax(0,1fr)}.icg-art{width:82px;height:60px}}
    `;document.head.appendChild(style)
  }

  function mount(channels){
    styles();let section=document.getElementById('infinityChannelGuide');if(!section){section=document.createElement('section');section.id='infinityChannelGuide';(document.querySelector('footer')||document.body.lastElementChild)?.before(section)}
    section.innerHTML='<header><div><p class="icg-kicker">INFINITY LIVE GUIDE</p><h2>Choose another channel</h2></div><form class="icg-phi-search" action="'+SEARCH+'"><input name="q" type="search" placeholder="Search the web with Infinity Phi" aria-label="Search the web with Infinity Phi"><input name="run" value="1" type="hidden"><button>Search</button></form></header><nav class="icg-tools" aria-label="Infinity tools"><a href="'+OMNI+'">Omni TV</a><a href="'+NEWS+'">News Phi</a><a href="'+SEARCH+'">Infinity Phi</a></nav><input class="icg-filter" type="search" placeholder="Filter channels or shows" aria-label="Filter channels or shows"><nav class="icg-list" aria-label="Infinity channel guide"></nav>';
    const nav=section.querySelector('.icg-list'),cache=readCache(),path=location.pathname.split('/').filter(Boolean)[0]||'';
    channels.forEach(channel=>{const link=document.createElement('a');link.className='icg-channel';link.href=ROOT+encodeURIComponent(channel.path).replace(/%2F/g,'/')+'/';link.dataset.path=channel.path;link.dataset.search=channel.name.toLowerCase();if(channel.path===path)link.setAttribute('aria-current','page');const cached=cache[channel.path],program=channel.path===path?currentProgram():(cached&&Date.now()-cached.at<180000?cached.program:''),image=channel.path===path?currentImage(document,location.href):(cached?.image||'');link.innerHTML='<img class="icg-art" alt="" loading="lazy"><span><small>LIVE</small><strong></strong><em></em></span>';link.querySelector('strong').textContent=channel.name;link.querySelector('em').textContent=program||'Checking live schedule…';const img=link.querySelector('img');if(image){img.src=image;img.hidden=false}else img.hidden=true;nav.appendChild(link)});
    section.querySelector('.icg-filter').addEventListener('input',event=>{const term=clean(event.target.value).toLowerCase();nav.querySelectorAll('.icg-channel').forEach(link=>{link.hidden=!!term&&!String(link.dataset.search||link.textContent).toLowerCase().includes(term)})});
    const active=nav.querySelector('[aria-current=page]');if(active){const update=()=>{const title=currentProgram(),image=currentImage();if(title){active.querySelector('em').textContent=title;active.dataset.search=(active.dataset.search.split(' | ')[0]+' | '+title.toLowerCase())}if(image){const img=active.querySelector('img');img.src=image;img.hidden=false}};update();new MutationObserver(update).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','src']})}
    probeOnDemand(nav,cache)
  }

  function probeOnDemand(nav,cache){
    const queue=[],queued=new Set();let active=0;function pump(){while(active<2&&queue.length){const link=queue.shift();if(!link||link.getAttribute('aria-current')==='page')continue;active++;probe(link).finally(()=>{active--;pump()})}}
    function probe(link){return new Promise(resolve=>{const frame=document.createElement('iframe');frame.className='icg-probe';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');let done=false,timer=0;const finish=(program,image)=>{if(done)return;done=true;clearInterval(timer);clearTimeout(limit);frame.remove();const label=link.querySelector('em'),img=link.querySelector('img');if(valid(program)){label.textContent=program;link.dataset.search+=' '+program.toLowerCase()}else label.textContent='Open live schedule';if(image){img.src=image;img.hidden=false}cache[link.dataset.path]={program:valid(program)?program:'',image:image||'',at:Date.now()};writeCache(cache);resolve()};frame.addEventListener('load',()=>{let tries=0;timer=setInterval(()=>{tries++;try{const doc=frame.contentDocument,title=currentProgram(doc),image=currentImage(doc,link.href);if(title)return finish(title,image)}catch{}if(tries>=8){let image='';try{image=currentImage(frame.contentDocument,link.href)}catch{}finish('',image)}},400)});const limit=setTimeout(()=>finish('',''),5000);frame.src=link.href+'?omni=meta';document.body.appendChild(frame)})}
    const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{const link=entry.target;if(entry.isIntersecting&&!queued.has(link)){queued.add(link);queue.push(link);observer.unobserve(link)}});pump()},{rootMargin:'350px'});nav.querySelectorAll('.icg-channel').forEach(link=>observer.observe(link))
  }

  normalizeChannelMenu();
  const pagePath=location.pathname.split('/').filter(Boolean)[0]||'';
  if(pagePath==='Omni-TV'){
    document.getElementById('infinityChannelGuide')?.remove();
    if(!document.getElementById('omniGuideStability')){
      const stable=document.createElement('style');stable.id='omniGuideStability';stable.textContent='.channel-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-auto-flow:row!important;overflow-anchor:none!important}.channel-card{overflow-anchor:none!important}@media(max-width:1050px){.channel-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}@media(max-width:760px){.channel-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:520px){.channel-grid{grid-template-columns:1fr!important}}';document.head.appendChild(stable)
    }
    return;
  }
  fetch(REGISTRY,{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject()).then(data=>mount(Array.isArray(data.channels)?data.channels:[])).catch(()=>{});
})();
