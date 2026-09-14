(function infinityChannelRemoteCore(){
  'use strict';
  if(window.__INFINITY_CHANNEL_REMOTE_CORE__)return;
  window.__INFINITY_CHANNEL_REMOTE_CORE__=true;

  const ROOT='https://www-infinity4.github.io/';
  const ASSET_ROOT=ROOT+'Control-Phi/';
  const REGISTRY=ASSET_ROOT+'channels.json';
  const VERSION='1.0.0';

  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const canonicalPath=path=>encodeURIComponent(clean(path)).replace(/%2F/gi,'/');
  const hrefFor=item=>ROOT+canonicalPath(item.path)+'/';

  function ensureCss(){
    if(document.querySelector('link[data-control-phi-css],link[href*="Control-Phi/control-phi.css"]'))return;
    const css=document.createElement('link');
    css.rel='stylesheet';
    css.href=ASSET_ROOT+'control-phi.css?v=20260914-remote-core1';
    css.dataset.controlPhiCss='1';
    document.head.appendChild(css);
  }

  function shell(){
    let button=document.getElementById('controlPhiButton');
    let panel=document.getElementById('controlPhiPanel');
    if(button&&panel)return{button,panel,owned:false};

    ensureCss();
    if(!button){
      button=document.createElement('button');
      button.id='controlPhiButton';
      button.type='button';
      button.setAttribute('aria-label','Open Channels');
      button.setAttribute('aria-expanded','false');
      button.textContent='☰';
      document.body.appendChild(button);
    }
    if(!panel){
      panel=document.createElement('aside');
      panel.id='controlPhiPanel';
      panel.setAttribute('aria-hidden','true');
      panel.dataset.remoteCore=VERSION;
      panel.innerHTML='<div class="control-phi-head"><strong>Channels</strong><button type="button" data-remote-close aria-label="Close channels">×</button></div><p class="control-phi-news">One shared remote for Infinity TV, News Phi, search and connected sites. The list comes from Control Phi so channel additions update here instead of being copied page by page.</p><input class="control-phi-search" type="search" placeholder="Search channels, sites, movies, news…" aria-label="Search channels"><nav class="control-phi-links" aria-label="Infinity channels" data-remote-links><a href="'+ROOT+'Omni-TV/" data-fallback="1">Omni TV</a><a href="'+ROOT+'News-Phi/" data-fallback="1">News Phi</a><a href="'+ROOT+'Omni-Phi/" data-fallback="1">Omni Phi</a><a href="'+ROOT+'C13b0/phi/" data-fallback="1">Infinity Phi</a></nav><p data-remote-status style="margin:13px 2px 0;color:#a9b8b0;font:600 12px/1.4 system-ui">Loading shared channel registry…</p>';
      document.body.appendChild(panel);
    }
    return{button,panel,owned:true};
  }

  function wire(button,panel){
    if(button.dataset.remoteCoreWired==='1')return;
    button.dataset.remoteCoreWired='1';
    const closeButton=panel.querySelector('[data-remote-close]');
    const input=panel.querySelector('.control-phi-search');
    const nav=panel.querySelector('[data-remote-links]');
    const open=()=>{panel.classList.add('open');panel.setAttribute('aria-hidden','false');button.setAttribute('aria-expanded','true');setTimeout(()=>input?.focus({preventScroll:true}),0)};
    const close=()=>{panel.classList.remove('open');panel.setAttribute('aria-hidden','true');button.setAttribute('aria-expanded','false')};
    button.addEventListener('click',()=>panel.classList.contains('open')?close():open());
    closeButton?.addEventListener('click',close);
    panel.addEventListener('click',event=>{if(event.target.closest('a[href]'))close()});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
    document.addEventListener('pointerdown',event=>{if(!panel.classList.contains('open'))return;if(panel.contains(event.target)||button.contains(event.target))return;close()});
    input?.addEventListener('input',()=>{
      const query=clean(input.value).toLowerCase();
      nav?.querySelectorAll('a').forEach(anchor=>{
        const haystack=(anchor.dataset.search||anchor.textContent||'').toLowerCase();
        anchor.hidden=!!query&&!haystack.includes(query);
      });
    });
  }

  function render(panel,data){
    const nav=panel.querySelector('[data-remote-links]');
    const status=panel.querySelector('[data-remote-status]');
    const channels=Array.isArray(data?.channels)?data.channels:[];
    const seen=new Set();
    const unique=channels.filter(item=>{
      const id=clean(item?.path).toLowerCase();
      if(!id||!clean(item?.name)||seen.has(id))return false;
      seen.add(id);return true;
    });
    if(!unique.length)throw new Error('empty channel registry');
    nav.innerHTML=unique.map(item=>{
      const genres=Array.isArray(item.genres)?item.genres.join(' '):'';
      const type=clean(item.type||'tv');
      const search=clean([item.name,item.path,type,genres].join(' ')).replace(/"/g,'&quot;');
      return '<a href="'+hrefFor(item)+'" data-name="'+clean(item.name).toLowerCase().replace(/"/g,'&quot;')+'" data-search="'+search+'"><span>'+clean(item.name).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</span></a>';
    }).join('');
    if(status)status.textContent=unique.length+' shared destinations · Control Phi registry v'+(data.version??'?');
    window.dispatchEvent(new CustomEvent('controlphi:remote-ready',{detail:{count:unique.length,version:data.version??null,source:'channel-remote'}}));
  }

  async function load(panel){
    try{
      const response=await fetch(REGISTRY+'?remote='+Date.now(),{cache:'no-store'});
      if(!response.ok)throw new Error('registry '+response.status);
      render(panel,await response.json());
    }catch(error){
      const status=panel.querySelector('[data-remote-status]');
      if(status)status.textContent='Shared registry could not load. Core links remain available; tap Channels again to retry.';
    }
  }

  function mount(){
    if(!document.body)return;
    const {button,panel}=shell();
    wire(button,panel);
    load(panel);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
