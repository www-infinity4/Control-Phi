// Red inventories; pink verifies; black seals actual browser evidence.
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const registry=await context.request.get('https://quantaphi.org/Control-Phi/channels.json');
 if(!registry.ok())throw Error('Registry HTTP '+registry.status());
 const {channels}=await registry.json(),report=[];
 fs.mkdirSync('channel-evidence',{recursive:true});
 for(const channel of channels){
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const item={channel:channel.name,path:channel.path,at:new Date().toISOString(),errors,checks:[]};
  try{
   const r=await page.goto('https://quantaphi.org/'+channel.path+'/',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForTimeout(2000);
   item.status=r?.status();item.title=await page.title();
   item.layout=await page.evaluate(()=>({text:document.body.innerText.trim().length,overflow:document.documentElement.scrollWidth>innerWidth+4,players:document.querySelectorAll('video,audio,iframe').length,controls:[...document.querySelectorAll('button,a[href],[role=button]')].map(e=>({label:(e.getAttribute('aria-label')||e.textContent||e.title||'').trim().slice(0,160),href:e.href||null,visible:!!e.getClientRects().length,disabled:!!e.disabled})),catalog: [...document.querySelectorAll('[data-program-id],[data-episode-id],.program,.episode')].map(e=>({id:e.dataset.programId||e.dataset.episodeId||null,title:e.textContent.trim().slice(0,160)})),oracle:!!document.querySelector('[class*=oracle],[data-oracle]'),walletEngine:window.ControlPhi?.version||null,media:[...document.querySelectorAll('video,audio')].map(e=>({readyState:e.readyState,error:e.error?.code||null,currentTime:e.currentTime,paused:e.paused}))}));
   const links=[...new Set(item.layout.controls.map(x=>x.href).filter(Boolean))];
   for(const href of links){const url=new URL(href);if(url.origin!=='https://quantaphi.org'){item.checks.push({url:href.split('?')[0],result:'external destination requires separate verification'});continue}url.search='';url.hash='';try{const dest=await context.request.get(url.href,{timeout:12000});item.checks.push({url:url.href,status:dest.status()})}catch(e){item.checks.push({url:url.href,error:e.message})}}
   // Only UI toggles are clicked. Reward, spend, share and mint controls are inventoried.
   for(const selector of ['#controlPhiButton','#controlPhiWalletButton']){const el=page.locator(selector);if(await el.count()&&await el.isVisible()){await el.click({timeout:5000});item.checks.push({control:selector,expanded:await el.getAttribute('aria-expanded')})}}
   await page.screenshot({path:'channel-evidence/'+channel.path.replace(/[^a-z0-9_-]/gi,'_')+'.png',fullPage:true});
   item.verdict=item.status===200&&item.layout.text>80&&!item.layout.overflow&&!errors.length?'layout checks passed':'needs review';
   item.playback='Embedded playback requires provider/player evidence; presence alone is not a pass';
  }catch(e){item.verdict='failed';item.error=e.message}
  const jobs=[];
  const job=(kind,reason)=>jobs.push({id:channel.path+':'+kind,channel:channel.name,path:channel.path,role:'Oracle Channel Curator',kind,reason,status:'queued',requiresVerification:true});
  if(item.verdict!=='layout checks passed')job('repair-page',item.error||'Layout or script checks failed');
  if(item.layout&&!item.layout.walletEngine)job('connect-shared-wallet','Control Phi wallet engine missing');
  if(item.layout&&!item.layout.oracle)job('oracle-design','Review against existing Infinity/Phi Oracle design before editing');
  if(item.layout&&channel.type==='tv'&&!item.layout.players)job('repair-player','No media player found');
  if(item.layout&&channel.type==='tv'&&!item.layout.catalog.length)job('catalog-review','Catalog requires source-level inspection; no indexed entries exposed on page');
  if(item.checks.some(x=>x.status>=400||x.error))job('repair-destination','One or more linked pages failed');
  if(item.layout?.controls.some(x=>!x.label))job('label-controls','Unlabeled controls found');
  item.grade={layout:item.verdict==='layout checks passed'?'pass':'fail',wallet:item.layout?.walletEngine?'engine present; account balance unverified':'missing',catalog:item.layout?.catalog.length?'entries inventoried':'needs inspection',playback:'unverified',oracle:item.layout?.oracle?'marker present; visual review needed':'design review needed'};
  item.jobs=jobs;
  report.push(item);await page.close();
 }
 fs.writeFileSync('channel-evidence/report.json',JSON.stringify({at:new Date().toISOString(),report},null,2));
 fs.writeFileSync('channel-evidence/curator-jobs.json',JSON.stringify({bot:'Oracle Channel Curator',at:new Date().toISOString(),cycle:'observe-grade-catalog-design-repair-verify',jobs:report.flatMap(x=>x.jobs),execution:'Inspection and job generation completed; page edits and catalog replacements require an execution adapter and verification.'},null,2));
 await browser.close();console.log(JSON.stringify(report.map(x=>({channel:x.channel,verdict:x.verdict,error:x.error}))));
 if(report.some(x=>x.verdict!=='layout checks passed'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
