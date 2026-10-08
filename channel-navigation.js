(function(){
  'use strict';
  if(window.__INFINITY_CANONICAL_CHANNEL_NAV__)return;
  window.__INFINITY_CANONICAL_CHANNEL_NAV__=true;

  const ROOT='https://www-infinity4.github.io/';
  const REGISTRY=ROOT+'Control-Phi/channels.json';
  let channels=[];
  let loadPromise=null;

  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const key=value=>clean(value).toLowerCase();
  const canonicalPath=path=>encodeURIComponent(clean(path)).replace(/%2F/gi,'/');

  async function load(){
    if(channels.length)return channels;
    if(loadPromise)return loadPromise;
    loadPromise=fetch(REGISTRY+'?nav='+Date.now(),{cache:'no-store'})
      .then(response=>response.ok?response.json():Promise.reject(new Error('registry')))
      .then(data=>{
        const seen=new Set();
        channels=(Array.isArray(data?.channels)?data.channels:[]).filter(item=>{
          const id=key(item?.path);
          if(!id||seen.has(id))return false;
          seen.add(id);return true;
        });
        return channels;
      }).catch(()=>channels).finally(()=>{loadPromise=null});
    return loadPromise;
  }

  function resolveFromAnchor(anchor){
    const label=key(anchor?.dataset?.name||anchor?.textContent);
    const href=anchor?.getAttribute?.('href')||'';
    let hrefPath='';
    try{hrefPath=decodeURIComponent(new URL(href,location.href).pathname.split('/').filter(Boolean).join('/'))}catch(_){ }
    return channels.find(item=>key(item.path)===key(hrefPath))||channels.find(item=>key(item.name)===label)||null;
  }

  function isChannelAnchor(anchor){
    if(!anchor)return false;
    return !!anchor.closest('details.channel-menu,details[data-channel-menu],#controlPhiPanel,#infinityChannelGuide,.channel-directory');
  }

  document.addEventListener('click',async event=>{
    const anchor=event.target?.closest?.('a[href]');
    if(!isChannelAnchor(anchor))return;
    await load();
    const channel=resolveFromAnchor(anchor);
    if(!channel)return;
    const destination=ROOT+canonicalPath(channel.path)+'/';
    if(anchor.href===destination)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(destination);
  },true);

  load();
})();
