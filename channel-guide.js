(function(){
  'use strict';
  if(window.__infinityChannelGuide)return;window.__infinityChannelGuide=true;
  const ROOT='https://www-infinity4.github.io/';
  const REGISTRY=ROOT+'Control-Phi/channels.json';
  const SEARCH=ROOT+'C13b0/phi';
  const CACHE_KEY='controlPhi:liveGuide:v1';
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const valid=value=>value&&!/loading|checking|choose|unavailable|station break|intermission/i.test(value);
  const readCache=()=>{try{return JSON.parse(localStorage.getItem(CACHE_KEY))||{}}catch{return {}}};
  const writeCache=value=>{try{localStorage.setItem(CACHE_KEY,JSON.stringify(value))}catch{}};

  function normalizeChannelMenu(){
    const menu=document.querySelector('details.channel-menu, details[data-channel-menu]');
    if(!menu)return;
    const summary=menu.querySelector(':scope > summary')||menu.querySelector('summary');
    if(summary){
      summary.setAttribute('aria-label','Open channels');
      summary.innerHTML='<span aria-hidden="true">☰</span><span class="control-phi-channel-label">Channels</span>';
    }
    menu.dataset.controlPhi='connected';
    if(!document.getElementById('controlPhiChannelShellStyles')){
      const style=document.createElement('style');
      style.id='controlPhiChannelShellStyles';
      style.textContent='details.channel-menu>summary,details[data-channel-menu]>summary{width:auto!important;min-width:104px!important;min-height:40px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;padding:0 12px!important;white-space:nowrap!important}details.channel-menu>summary .control-phi-channel-label,details[data-channel-menu]>summary .control-phi-channel-label{display:inline!important;font:900 12px/1 system-ui,sans-serif!important;letter-spacing:.04em!important;text-transform:uppercase!important}';
      document.head.appendChild(style);
    }
  }

  function currentProgram(doc=document){
    const selectors=['[data-now-playing]','#nowTitle','#programTitle','#nowPlaying','.now-title','.guide-row.current .program-title','.row.now strong'];
    for(const selector of selectors){const value=clean(doc.querySelector(selector)?.textContent);if(valid(value))return value}
    return '';
  }

  function styles(){
    if(document.getElementById('infinityChannelGuideStyles'))return;
    const style=document.createElement('style');style.id='infinityChannelGuideStyles';style.textContent=`
      #infinityChannelGuide{--icg-line:rgba(255,255,255,.15);--icg-muted:#b8c0cc;width:100%;padding:34px max(14px,calc((100vw - 1120px)/2));border-top:1px solid var(--icg-line);background:#05070b;color:#fff;font:15px/1.35 Inter,system-ui,sans-serif}
      #infinityChannelGuide *{box-sizing:border-box}#infinityChannelGuide header{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:0 0 16px}#infinityChannelGuide h2{margin:3px 0 0;font-size:clamp(1.7rem,4vw,2.8rem)}#infinityChannelGuide .icg-kicker{margin:0;color:#7dd3fc;font-size:.72rem;font-weight:950;letter-spacing:.16em}
      .icg-phi-search{display:flex;gap:8px;width:min(520px,100%)}.icg-phi-search input{min-width:0;flex:1;min-height:48px;padding:0 14px;border:1px solid var(--icg-line);border-radius:13px;background:#111827;color:#fff;font:inherit}.icg-phi-search button{min-height:48px;padding:0 16px;border:0;border-radius:13px;background:linear-gradient(135deg,#0ea5e9,#7c3aed);color:#fff;font-weight:900;cursor:pointer}
      .icg-filter{width:100%;min-height:46px;margin:0 0 12px;padding:0 14px;border:1px solid var(--icg-line);border-radius:12px;background:#0d121b;color:#fff;font:inherit}.icg-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.icg-channel{min-width:0;min-height:72px;display:grid;grid-template-columns:58px minmax(0,1fr);align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--icg-line);border-radius:12px;background:linear-gradient(90deg,#131923,#090d14);color:#fff;text-decoration:none;overflow:hidden}.icg-channel:hover,.icg-channel:focus,.icg-channel[aria-current=page]{border-color:#7dd3fc;background:linear-gradient(90deg,#18304a,#0b111a)}.icg-channel small{color:#fca5a5;font-size:.68rem;font-weight:950;letter-spacing:.12em}.icg-channel span{min-width:0;display:grid;gap:3px}.icg-channel strong,.icg-channel em{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.icg-channel strong{font-size:1rem}.icg-channel em{color:var(--icg-muted);font-size:.82rem;font-style:normal}.icg-probe{position:fixed;left:-5000px;top:-5000px;width:900px;height:600px;opacity:0;pointer-events:none;border:0}
      @media(max-width:720px){#infinityChannelGuide header{align-items:stretch;flex-direction:column}.icg-list{grid-template-columns:1fr}.icg-phi-search{width:100%}}`;
    document.head.appendChild(style);
  }

  function mount(channels){
    styles();let section=document.getElementById('infinityChannelGuide');
    if(!section){section=document.createElement('section');section.id='infinityChannelGuide';(document.querySelector('footer')||document.body.lastElementChild)?.before(section)}
    section.innerHTML='<header><div><p class="icg-kicker">INFINITY LIVE GUIDE</p><h2>Choose another channel</h2></div><form class="icg-phi-search" action="'+SEARCH+'"><input name="q" type="search" placeholder="Search Infinity Phi" aria-label="Search Infinity Phi"><input name="run" value="1" type="hidden"><button>Search</button></form></header><input class="icg-filter" type="search" placeholder="Filter channels or shows" aria-label="Filter channels or shows"><nav class="icg-list" aria-label="Infinity channel guide"></nav>';
    const nav=section.querySelector('nav'),cache=readCache(),path=location.pathname.split('/').filter(Boolean)[0]||'';
    channels.forEach(channel=>{
      const link=document.createElement('a');link.className='icg-channel';link.href=ROOT+encodeURIComponent(channel.path).replace(/%2F/g,'/')+'/';link.dataset.path=channel.path;link.dataset.search=channel.name.toLowerCase();if(channel.path===path)link.setAttribute('aria-current','page');
      const cached=cache[channel.path],program=channel.path===path?currentProgram():(cached&&Date.now()-cached.at<120000?cached.program:'');
      link.innerHTML='<small>LIVE</small><span><strong></strong><em></em></span>';link.querySelector('strong').textContent=channel.name;link.querySelector('em').textContent=program||'Checking live schedule…';nav.appendChild(link);
    });
    section.querySelector('.icg-filter').addEventListener('input',event=>{const term=clean(event.target.value).toLowerCase();nav.querySelectorAll('.icg-channel').forEach(link=>{link.hidden=!!term&&!link.textContent.toLowerCase().includes(term)})});
    const active=nav.querySelector('[aria-current=page] em');if(active){const update=()=>{const title=currentProgram();if(title)active.textContent=title};update();new MutationObserver(update).observe(document.body,{subtree:true,childList:true,characterData:true})}
    probeOnDemand(nav,cache);
  }

  function probeOnDemand(nav,cache){
    const queue=[],queued=new Set();let active=0;
    function pump(){while(active<2&&queue.length){const link=queue.shift();if(!link||link.getAttribute('aria-current')==='page')continue;active++;probe(link).finally(()=>{active--;pump()})}}
    function probe(link){return new Promise(resolve=>{
      const frame=document.createElement('iframe');frame.className='icg-probe';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');let done=false;
      const finish=program=>{if(done)return;done=true;clearInterval(timer);clearTimeout(limit);frame.remove();const label=link.querySelector('em');if(valid(program)){label.textContent=program;link.dataset.search+=' '+program.toLowerCase();cache[link.dataset.path]={program,at:Date.now()};writeCache(cache)}else label.textContent='Open live schedule';resolve()};
      frame.addEventListener('load',()=>{let tries=0;timer=setInterval(()=>{tries++;try{const title=currentProgram(frame.contentDocument);if(title)return finish(title)}catch{}if(tries>=8)finish('')},400)});let timer=0;const limit=setTimeout(()=>finish(''),5000);frame.src=link.href+'?omni=meta';document.body.appendChild(frame);
    })}
    const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{const link=entry.target;if(entry.isIntersecting&&!queued.has(link)){queued.add(link);queue.push(link);observer.unobserve(link)}});pump()},{rootMargin:'350px'});
    nav.querySelectorAll('.icg-channel').forEach(link=>observer.observe(link));
  }

  normalizeChannelMenu();
  fetch(REGISTRY,{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject()).then(data=>mount(Array.isArray(data.channels)?data.channels:[])).catch(()=>{});
})();
