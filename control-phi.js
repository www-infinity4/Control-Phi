(function controlPhiBootstrap(){
  'use strict';
  if(window.ControlPhi?.version)return;
  const ROOT='https://www-infinity4.github.io/';
  const scriptSource=document.currentScript?.src||`${ROOT}Control-Phi/control-phi.js`;
  const ASSET_ROOT=new URL('.',scriptSource).href;
  const SHARE_KEY='controlPhi:shareFeed:v1';
  const WALLET_GUEST_KEY='starquest_guest_profile_v1';
  const WALLET_SESSION_KEY='starquest_session';
  const WALLET_USERS_KEY='starquest_users';
  const MAX_SHARES=500;
  const DEDUPE_WINDOW_MS=1500;
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
  const clean=(value,max=1200)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
  const pageMeta=(name)=>document.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.content||'';
  const nowPlaying=()=>document.querySelector('[data-now-playing], #nowTitle, #programTitle, .now-title')?.textContent||'';
  const pageChannel=()=>clean(document.body?.dataset?.channel||pageMeta('application-name')||pageMeta('og:site_name')||document.title.split(/[—|]/)[0]||document.querySelector('h1')?.textContent,100);
  const searchTerms=(payload)=>{
    const raw=[payload.title,payload.text,payload.channel,nowPlaying(),pageMeta('description')].filter(Boolean).join(' ');
    const words=clean(raw,500).replace(/https?:\/\/\S+/g,' ').replace(/[^\p{L}\p{N}' -]+/gu,' ').split(/\s+/).filter(word=>word.length>2);
    return [...new Set(words)].slice(0,18).join(' ');
  };
  const describe=(payload,query)=>{
    const title=clean(payload.title||document.title||'Shared from Infinity TV',180);
    const channel=clean(payload.channel||pageChannel(),100);
    const detail=clean(payload.text||nowPlaying()||pageMeta('description'),1000);
    const lead=`${title} was shared${channel?` from ${channel}`:''}.`;
    const context=detail&&detail.toLowerCase()!==title.toLowerCase()?detail:`The share points to ${clean(payload.url||location.href,300)} and preserves the program or subject as a News Phi research starting point.`;
    const next=`News Phi prepared the research query “${query}” from the information available at the moment of sharing. Open this card to review the source and generate a deeper, source-based news search.`;
    return [lead,context,next].join(' ');
  };
  const signatureOf=(payload)=>[payload.url,payload.title,payload.channel].map(value=>clean(value,300).toLowerCase()).join('|');

  function walletStore(){
    const session=read(WALLET_SESSION_KEY,null);
    const users=read(WALLET_USERS_KEY,{});
    if(session&&session.key&&users&&users[session.key]){
      return {profile:users[session.key],save(profile){users[session.key]=profile;write(WALLET_USERS_KEY,users)}};
    }
    const guest=read(WALLET_GUEST_KEY,{key:'__guest__',username:'Guest',tokens:0,shareCount:0,pendingShareCredits:0,shareEvents:[],ledger:[],watchHistory:[],watchPositions:{},unlockedContent:{}});
    return {profile:guest,save(profile){write(WALLET_GUEST_KEY,profile)}};
  }

  function normalizeWallet(profile){
    const wallet=profile&&typeof profile==='object'?profile:{};
    wallet.tokens=Math.max(0,Number(wallet.tokens)||0);
    wallet.shareCount=Math.max(0,Number(wallet.shareCount)||0);
    wallet.pendingShareCredits=Math.max(0,Number(wallet.pendingShareCredits)||0);
    wallet.shareEvents=Array.isArray(wallet.shareEvents)?wallet.shareEvents:[];
    wallet.ledger=Array.isArray(wallet.ledger)?wallet.ledger:[];
    wallet.watchHistory=Array.isArray(wallet.watchHistory)?wallet.watchHistory:[];
    wallet.watchPositions=wallet.watchPositions&&typeof wallet.watchPositions==='object'?wallet.watchPositions:{};
    wallet.unlockedContent=wallet.unlockedContent&&typeof wallet.unlockedContent==='object'?wallet.unlockedContent:{};
    return wallet;
  }

  function walletSnapshot(){
    const store=walletStore();
    const wallet=normalizeWallet(store.profile);
    return {balance:wallet.tokens,progressToNextCoin:wallet.pendingShareCredits,shareCount:wallet.shareCount,username:wallet.username||'Guest'};
  }

  function refreshWalletUI(){
    const snapshot=walletSnapshot();
    document.querySelectorAll('[data-control-phi-wallet-balance]').forEach(el=>el.textContent=String(snapshot.balance));
    document.querySelectorAll('[data-control-phi-wallet-progress]').forEach(el=>el.textContent=`${snapshot.progressToNextCoin}/10`);
    const button=document.getElementById('controlPhiWalletButton');
    if(button)button.innerHTML=`<span aria-hidden="true">⭐</span><strong>${snapshot.balance}</strong><small>${snapshot.progressToNextCoin}/10</small>`;
    const name=document.querySelector('[data-control-phi-wallet-name]');
    if(name)name.textContent=snapshot.username;
    return snapshot;
  }

  function recentConfirmedShare(wallet,now){
    return wallet.shareEvents.some(event=>{
      const when=Number(event?.createdAt||0);
      return when&&Math.abs(now-when)<3500&&event?.confirmed!==false&&event?.verified!==false;
    });
  }

  function ensureShareCredit(reference='',method='web_share_api'){
    const store=walletStore();
    const wallet=normalizeWallet(store.profile);
    const now=Date.now();
    if(recentConfirmedShare(wallet,now)){
      refreshWalletUI();
      return {...walletSnapshot(),awarded:0,alreadyRecorded:true};
    }
    const attemptId=`controlphi-share-${now.toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    wallet.shareCount+=1;
    wallet.pendingShareCredits+=1;
    wallet.shareEvents.push({id:attemptId,attemptId,contentId:clean(reference||location.href,700),method,confirmed:true,verified:true,createdAt:now,source:'control-phi-fallback'});
    let awarded=0;
    while(wallet.pendingShareCredits>=10){wallet.pendingShareCredits-=10;wallet.tokens+=1;awarded+=1}
    wallet.ledger.push({id:`tx-${attemptId}`,type:awarded?'share_reward':'share_credit',amount:awarded,balance:wallet.tokens,pendingShareCredits:wallet.pendingShareCredits,reason:awarded?'Share reward: 10 completed shares':`Confirmed share receipt ${wallet.pendingShareCredits}/10`,referenceId:attemptId,createdAt:now,source:'control-phi-fallback'});
    wallet.shareEvents=wallet.shareEvents.slice(-250);
    wallet.ledger=wallet.ledger.slice(-500);
    store.save(wallet);
    const detail={progressToNextCoin:wallet.pendingShareCredits,awarded,balance:wallet.tokens,shareCount:wallet.shareCount,source:'control-phi-fallback'};
    window.dispatchEvent(new CustomEvent('starquest:share-progress',{detail}));
    window.dispatchEvent(new CustomEvent('controlphi:wallet-change',{detail}));
    refreshWalletUI();
    return detail;
  }

  function injectWallet(){
    if(document.getElementById('controlPhiWalletButton')){refreshWalletUI();return}
    const style=document.createElement('style');
    style.id='controlPhiWalletStyle';
    style.textContent=`#controlPhiWalletButton{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:7px 10px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:#141923;color:#fff;font:800 13px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.22)}#controlPhiWalletButton small{opacity:.72;font-size:10px}#controlPhiWalletButton.control-phi-wallet-floating{position:fixed;right:68px;bottom:16px;z-index:10001;background:#0b1020}#controlPhiWalletPanel{position:fixed;right:16px;bottom:68px;z-index:10002;width:min(300px,calc(100vw - 32px));padding:14px;border:1px solid rgba(255,255,255,.18);border-radius:16px;background:#080b12;color:#fff;box-shadow:0 24px 70px rgba(0,0,0,.58);font:500 14px/1.45 system-ui,sans-serif}#controlPhiWalletPanel[hidden]{display:none}#controlPhiWalletPanel .cp-wallet-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:7px 0}#controlPhiWalletPanel strong{font-size:18px}#controlPhiWalletPanel p{margin:10px 0 0;color:#cbd5e1;font-size:12px}#controlPhiWalletPanel a{color:#93c5fd}`;
    document.head.appendChild(style);
    const button=document.createElement('button');
    button.id='controlPhiWalletButton';button.type='button';button.setAttribute('aria-label','Open StarCoin wallet');button.setAttribute('aria-expanded','false');
    const panel=document.createElement('section');panel.id='controlPhiWalletPanel';panel.hidden=true;panel.setAttribute('aria-label','StarCoin wallet');panel.innerHTML=`<div class="cp-wallet-row"><span data-control-phi-wallet-name>Guest</span><strong>StarCoin Wallet</strong></div><div class="cp-wallet-row"><span>Balance</span><strong><span data-control-phi-wallet-balance>0</span> ⭐</strong></div><div class="cp-wallet-row"><span>Share progress</span><strong data-control-phi-wallet-progress>0/10</strong></div><p>Every 10 confirmed shares earns 1 StarCoin. This wallet reads the same StarQuest profile used across the Infinity channels.</p>`;
    const host=document.querySelector('.head-actions');
    if(host)host.appendChild(button);else{button.classList.add('control-phi-wallet-floating');document.body.appendChild(button)}
    document.body.appendChild(panel);
    const toggle=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)refreshWalletUI()};
    button.addEventListener('click',toggle);
    document.addEventListener('click',event=>{if(panel.hidden||event.target===button||button.contains(event.target)||panel.contains(event.target))return;panel.hidden=true;button.setAttribute('aria-expanded','false')});
    refreshWalletUI();
  }

  function recordShare(input={}){
    const now=new Date();
    const payload={title:clean(input.title||document.title,180),text:clean(input.text||'',1200),url:clean(input.url||location.href,700),image:clean(input.image||pageMeta('og:image')||pageMeta('twitter:image'),700),channel:clean(input.channel||pageChannel(),100)};
    const query=clean(input.searchQuery||searchTerms(payload)||payload.title,500);
    const signature=signatureOf(payload);
    const feed=read(SHARE_KEY,[]);
    const newest=feed[0];
    if(newest&&newest.shareSignature===signature&&Date.now()-Date.parse(newest.collectedAt||0)<DEDUPE_WINDOW_MS)return newest;
    const id=`share-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
    const event={id,storyKey:id,title:payload.title||'Shared story',extract:describe(payload,query),url:payload.url,image:payload.image,domain:payload.channel||location.hostname,channel:payload.channel,searchQuery:query,collectedAt:now.toISOString(),kind:'shared-news',shareConfirmed:input.shareConfirmed!==false,shareMethod:clean(input.shareMethod||'web_share_api',60),shareSignature:signature,source:'control-phi'};
    feed.unshift(event);
    write(SHARE_KEY,feed.slice(0,MAX_SHARES));
    window.dispatchEvent(new CustomEvent('controlphi:shared',{detail:event}));
    return event;
  }

  function installShareBridge(){
    if(typeof navigator.share!=='function'||navigator.share.__controlPhi)return;
    const nativeShare=navigator.share.bind(navigator);
    const wrapped=async(data={})=>{
      const result=await nativeShare(data);
      recordShare({...data,shareConfirmed:true,shareMethod:'web_share_api'});
      const reference=clean(data.url||location.href,700);
      setTimeout(()=>ensureShareCredit(reference,'web_share_api'),900);
      return result;
    };
    wrapped.__controlPhi=true;
    try{Object.defineProperty(navigator,'share',{configurable:true,value:wrapped})}catch{try{navigator.share=wrapped}catch{}}
  }

  function installShareLinkBridge(){
    if(document.documentElement.dataset.controlPhiShareLinks==='1')return;
    document.documentElement.dataset.controlPhiShareLinks='1';
    document.addEventListener('click',event=>{
      const anchor=event.target&&event.target.closest?event.target.closest('a[href]'):null;
      if(!anchor)return;
      let href='';
      try{href=new URL(anchor.href,location.href).href}catch{return}
      if(!/(twitter\.com\/intent\/tweet|x\.com\/intent\/post|facebook\.com\/sharer|linkedin\.com\/sharing|reddit\.com\/submit|mailto:)/i.test(href))return;
      recordShare({title:document.title,text:nowPlaying()||pageMeta('description'),url:location.href,image:pageMeta('og:image')||pageMeta('twitter:image'),channel:pageChannel(),shareConfirmed:false,shareMethod:'share_link'});
    },true);
  }

  function installCrossTabBridge(){
    window.addEventListener('storage',event=>{
      if(event.key===SHARE_KEY)window.dispatchEvent(new CustomEvent('controlphi:shared',{detail:{external:true}}));
      if(event.key===WALLET_GUEST_KEY||event.key===WALLET_USERS_KEY||event.key===WALLET_SESSION_KEY)refreshWalletUI();
    });
    window.addEventListener('starquest:share-progress',refreshWalletUI);
    window.addEventListener('controlphi:wallet-change',refreshWalletUI);
  }

  function injectRemote(){
    injectWallet();
    if(document.getElementById('controlPhiButton'))return;
    const existingMenu=document.querySelector('details.channel-menu, details[data-channel-menu]');
    if(existingMenu){
      const nav=existingMenu.querySelector('nav')||existingMenu.appendChild(document.createElement('nav'));
      const filter=existingMenu.querySelector('input[type="search"]');
      fetch(`${ASSET_ROOT}channels.json`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{
        nav.innerHTML=data.channels.map(item=>`<a href="${ROOT}${encodeURIComponent(item.path).replace(/%2F/g,'/')}/" data-name="${item.name.toLowerCase()}">${item.name}</a>`).join('');
        if(filter)filter.dispatchEvent(new Event('input'));
      }).catch(()=>{});
      existingMenu.dataset.controlPhi='connected';
      return;
    }
    const css=document.createElement('link');css.rel='stylesheet';css.href=`${ASSET_ROOT}control-phi.css`;document.head.appendChild(css);
    const button=document.createElement('button');button.id='controlPhiButton';button.type='button';button.setAttribute('aria-label','Open Control Phi channels');button.setAttribute('aria-expanded','false');button.textContent='☰';
    const panel=document.createElement('aside');panel.id='controlPhiPanel';panel.setAttribute('aria-hidden','true');panel.innerHTML='<div class="control-phi-head"><strong>Control Phi</strong><button type="button" aria-label="Close channels">×</button></div><p class="control-phi-news">Every completed share becomes a research card in <a href="'+ROOT+'News-Phi/">News Phi</a>.</p><input class="control-phi-search" type="search" placeholder="Find a channel" aria-label="Find a channel"><nav class="control-phi-links" aria-label="Infinity channels"><a href="'+ROOT+'News-Phi/">News Phi</a></nav>';
    document.body.append(button,panel);
    const toggle=(open)=>{panel.classList.toggle('open',open);panel.setAttribute('aria-hidden',String(!open));button.setAttribute('aria-expanded',String(open))};
    button.addEventListener('click',()=>toggle(!panel.classList.contains('open')));panel.querySelector('.control-phi-head button').addEventListener('click',()=>toggle(false));
    const nav=panel.querySelector('.control-phi-links');const input=panel.querySelector('input');
    fetch(`${ASSET_ROOT}channels.json`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{nav.innerHTML=data.channels.map(item=>`<a href="${ROOT}${encodeURIComponent(item.path).replace(/%2F/g,'/')}/" data-name="${item.name.toLowerCase()}">${item.name}</a>`).join('');filter()}).catch(()=>{});
    function filter(){const term=input.value.trim().toLowerCase();nav.querySelectorAll('a').forEach(a=>a.hidden=!!term&&!a.textContent.toLowerCase().includes(term))}input.addEventListener('input',filter);
  }

  window.ControlPhi={version:'1.3.0',recordShare,openNews:()=>location.assign(`${ROOT}News-Phi/`),shareFeed:()=>read(SHARE_KEY,[]).slice(),wallet:walletSnapshot,ensureShareCredit,refreshWallet:refreshWalletUI};
  installShareBridge();
  installShareLinkBridge();
  installCrossTabBridge();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectRemote,{once:true});else injectRemote();
})();
