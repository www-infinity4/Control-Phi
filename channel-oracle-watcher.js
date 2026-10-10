(async function(){
 'use strict';
 if(window.ChannelOracle)return;
 // Owner-only, device-local observations. Credentials never enter reports.
 let token='';
 try{token=await new Promise((resolve,reject)=>{const r=indexedDB.open('quantaphi-robot-inbox',1);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('settings').objectStore('settings').get('infinity-work-ticket-owner-v1');q.onsuccess=()=>{resolve(q.result||'');db.close()};q.onerror=()=>reject(q.error)}});token=token||sessionStorage.getItem('infinity-work-ticket-owner-v1')||localStorage.getItem('infinity-work-ticket-owner-v1')||'';if(!token)return;const r=await fetch('https://infinity-brain-clock.marvaseater.workers.dev/health',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});if(!r.ok)return}catch{return}
 const key='infinity:channel-oracle-observations:v1';
 let busy=false,history=[];try{history=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
 const label=el=>String(el.getAttribute('aria-label')||el.textContent||el.title||'').replace(/\s+/g,' ').trim().slice(0,160);
 function scan(trigger='interval'){
  const controls=[...document.querySelectorAll('a[href],button,[role=button],input[type=button],input[type=submit]')].map(el=>({label:label(el),tag:el.tagName,disabled:!!el.disabled,visible:!!el.getClientRects().length,path:el.href?new URL(el.href,location.href).pathname:null}));
  const media=[...document.querySelectorAll('video,audio')].map(el=>({readyState:el.readyState,paused:el.paused,error:el.error?.code||null,time:Math.floor(el.currentTime)}));
  const report={at:new Date().toISOString(),path:location.pathname,title:document.title,trigger,controls,media,embeddedPlayers:document.querySelectorAll('iframe').length,readableCharacters:(document.body?.innerText||'').trim().length,overflow:document.documentElement.scrollWidth>innerWidth+4,unlabeledControls:controls.filter(x=>x.visible&&!x.label).length,verification:'DOM inspection; playback and destination checks require browser runner'};
  history=[report,...history].slice(0,40);try{localStorage.setItem(key,JSON.stringify(history))}catch{}
  window.dispatchEvent(new CustomEvent('oracle:channel-observation',{detail:report}));return report;
 }
 async function checkDestinations(){
  if(busy)return;busy=true;const results=[];
  try{const r=await fetch('/Control-Phi/channels.json',{cache:'no-store'});if(!r.ok)throw Error('registry_http_'+r.status);const data=await r.json();
   for(const channel of data.channels||[]){const path='/'+channel.path.replace(/^\/+|\/+$/g,'')+'/';try{const r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(12000)});const html=await r.text();const doc=new DOMParser().parseFromString(html,'text/html');doc.querySelectorAll('script,style').forEach(x=>x.remove());results.push({path,status:r.status,title:doc.title,readable:doc.body.textContent.trim().length>80,controls:doc.querySelectorAll('a[href],button,[role=button]').length,player:!!doc.querySelector('video,audio,iframe'),verification:'HTTP and parsed document; visual/browser check pending'})}catch(e){results.push({path,error:String(e.message)})}}
   window.dispatchEvent(new CustomEvent('oracle:channel-destinations',{detail:results}));try{localStorage.setItem('infinity:channel-oracle-destinations:v1',JSON.stringify({at:new Date().toISOString(),results}))}catch{}return results;
  }finally{busy=false}
 }
 window.ChannelOracle={scan,checkDestinations,history:()=>history.slice(),clear:()=>{history=[];localStorage.removeItem(key);localStorage.removeItem('infinity:channel-oracle-destinations:v1')}};
 document.addEventListener('click',event=>{if(event.target.closest('a,button,[role=button]'))setTimeout(()=>scan('control-activated'),250)},true);
 window.addEventListener('pageshow',()=>scan('channel-open'));document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan('channel-return')});
 scan('owner-monitor-start');setInterval(()=>{if(!document.hidden)scan()},45000);void checkDestinations();
})();
