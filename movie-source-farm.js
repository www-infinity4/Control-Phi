(function(root){
  'use strict';

  const VERSION='20260914-unique3';
  const CACHE_PREFIX='infinity:movie-source-farm:v5:';
  const OWNER_PREFIX='infinity:movie-title-owners:v1:';
  const RELOAD_PREFIX='infinity:movie-source-farm:reload:';
  const IFRAME_API='https://www.youtube.com/iframe_api';
  const DEFAULT_TARGET=96;
  const DEFAULT_MINIMUM=84;
  const DEFAULT_MAX_CANDIDATES=420;
  const FULL_CUE=/\b(full(?:\s+length)?|movie|film|feature|cinema)\b/i;
  const JUNK_CUE=/\b(trailer|teaser|clip|shorts?|preview|review|reaction|interview|behind\s+the\s+scenes|livestream|live\s+stream|gameplay|walkthrough|announcement|promo)\b/i;

  function hash(text){
    let value=2166136261;
    const input=String(text||'');
    for(let i=0;i<input.length;i+=1)value=Math.imul(value^input.charCodeAt(i),16777619);
    return value>>>0;
  }

  function weekKey(){
    const now=new Date();
    const day=(now.getDay()+6)%7;
    const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-day,0,0,0,0);
    return String(Math.floor(monday.getTime()/604800000));
  }

  function cleanTitle(value){
    return String(value||'')
      .replace(/\s*[|•·]\s*(?:full\s+movie|free\s+movie|family\s+central|movie\s+central|sci-?fi\s+central|filmrise\s+movies|encouragetv|free\s+movies\s+by\s+cineverse|pizzaflix|girls\s+night\s+in).*$/i,'')
      .replace(/\s+/g,' ').trim();
  }

  function normalizedTitle(value){
    return cleanTitle(value).toLowerCase()
      .replace(/\b(full|free|hd|movie|film|watch|english|official|feature)\b/g,' ')
      .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  }

  function extractYear(title){
    const matches=String(title||'').match(/\b(19\d{2}|20\d{2})\b/g);
    if(!matches||!matches.length)return null;
    const year=Number(matches[matches.length-1]);
    return year>=1900&&year<=2099?year:null;
  }

  function compilePatterns(values){
    return (Array.isArray(values)?values:[]).map(value=>{
      try{return value instanceof RegExp?value:new RegExp(String(value),'i')}catch(_){return null}
    }).filter(Boolean);
  }

  function yearAllowed(year,profile){
    if(!Array.isArray(profile.yearRange)||profile.yearRange.length!==2)return true;
    if(!year)return profile.strictYear!==true;
    return year>=Number(profile.yearRange[0])&&year<=Number(profile.yearRange[1]);
  }

  function titleMatchesProfile(title,profile){
    const raw=String(title||'').trim();
    if(!raw||JUNK_CUE.test(raw))return false;
    if(profile.requireFullCue!==false&&!FULL_CUE.test(raw))return false;
    const include=compilePatterns(profile.include);
    const exclude=compilePatterns(profile.exclude);
    if(include.length&&!include.some(re=>re.test(raw)))return false;
    if(exclude.some(re=>re.test(raw)))return false;
    if(!yearAllowed(extractYear(raw),profile))return false;
    return Boolean(normalizedTitle(raw));
  }

  function targetCount(profile){return Math.max(DEFAULT_MINIMUM,Number(profile.targetCount)||DEFAULT_TARGET);}
  function minimumCount(profile){return Math.max(1,Math.min(targetCount(profile),Number(profile.minimumReadyCount)||DEFAULT_MINIMUM));}
  function cacheKey(profile){return `${CACHE_PREFIX}${profile.channelId||'movie'}:${weekKey()}`;}
  function ownerKey(){return `${OWNER_PREFIX}${weekKey()}`;}

  function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch(_){return fallback}}
  function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}}

  function readCache(profile){
    const data=readJson(cacheKey(profile),null);
    if(!data||data.version!==VERSION||!Array.isArray(data.items))return[];
    return data.items;
  }
  function writeCache(profile,items){
    writeJson(cacheKey(profile),{version:VERSION,updatedAt:Date.now(),items:items.slice(0,180)});
  }

  function readOwners(){
    const data=readJson(ownerKey(),{});
    return data&&typeof data==='object'&&!Array.isArray(data)?data:{};
  }
  function titleAvailableFor(profile,title,owners){
    const key=normalizedTitle(title);
    if(!key)return false;
    const owner=owners[key];
    return !owner||owner===profile.channelId;
  }
  function claimTitle(profile,title,owners){
    const key=normalizedTitle(title);
    if(!key)return false;
    if(owners[key]&&owners[key]!==profile.channelId)return false;
    owners[key]=profile.channelId;
    return true;
  }

  function cachedItemValid(item,profile){
    if(!item||item.discovered!==true||!item.videoId||item.cleared!==true)return false;
    if(!titleMatchesProfile(item.originalTitle||item.title,profile))return false;
    const duration=Number(item.runtimeSeconds)||0;
    return duration>=3600&&duration<=7200;
  }

  function uniqueItems(items,target){
    const out=[],ids=new Set(),titles=new Set();
    for(const item of Array.isArray(items)?items:[]){
      if(!item||!item.videoId)continue;
      const titleKey=normalizedTitle(item.title||item.originalTitle||item.videoId);
      if(!titleKey||ids.has(item.videoId)||titles.has(titleKey))continue;
      ids.add(item.videoId);titles.add(titleKey);out.push(item);
      if(target&&out.length>=target)break;
    }
    return out;
  }

  function acceptedCached(profile){
    const owners=readOwners();
    let changed=false;
    const items=[];
    for(const item of readCache(profile)){
      if(!cachedItemValid(item,profile))continue;
      const title=item.originalTitle||item.title;
      if(!titleAvailableFor(profile,title,owners))continue;
      if(claimTitle(profile,title,owners))changed=true;
      items.push(item);
    }
    if(changed)writeJson(ownerKey(),owners);
    return uniqueItems(items,targetCount(profile));
  }

  function statusObject(profile,count){
    return {
      version:VERSION,
      channelId:profile.channelId,
      count,
      minimum:minimumCount(profile),
      target:targetCount(profile),
      ready:count>=minimumCount(profile),
      sourceName:profile.sourceName||'YouTube'
    };
  }

  function renderStatus(status){
    root.INFINITY_MOVIE_SOURCE_STATUS=status;
    const button=document.getElementById('enterButton');
    if(!button)return;
    if(status.ready){
      button.disabled=false;
      button.removeAttribute('aria-busy');
      return;
    }
    button.disabled=true;
    button.setAttribute('aria-busy','true');
    const strong=button.querySelector('span')||button;
    const small=button.querySelector('small');
    if(strong)strong.textContent=`Building ${status.channelId.replace(/-/g,' ')} lineup`;
    if(small)small.textContent=`${status.count}/${status.minimum} unique full movies verified from ${status.sourceName}`;
  }

  function placeholderSchedule(nowMs,engine,status){
    const blockSeconds=Number(engine.BLOCK_SECONDS)||7200;
    let midnightMs;
    try{
      const p=engine.stationParts(new Date(nowMs));
      midnightMs=engine.zonedToUtc(p.year,p.month,p.day);
    }catch(_){
      const d=new Date(nowMs);midnightMs=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
    }
    const todayKey=typeof engine.dateKey==='function'?engine.dateKey(nowMs):new Date(nowMs).toISOString().slice(0,10);
    return Array.from({length:12},(_,index)=>{
      const startsAtMs=midnightMs+index*blockSeconds*1000;
      return {
        id:`${todayKey}-BUILD-${String(index).padStart(2,'0')}`,
        movie:{
          id:`${status.channelId}-BUILD-${index}`,
          title:`Building ${status.channelId.replace(/-/g,' ')} unique lineup`,
          year:'',
          collection:`${status.count}/${status.minimum} verified full movies · repeats blocked`,
          runtimeSeconds:blockSeconds,
          videoId:'',
          source:status.sourceName,
          cleared:false,
          refill:true,
          posterUrl:''
        },
        startsAtMs,
        endsAtMs:startsAtMs+blockSeconds*1000,
        blockSeconds,
        fullStationSeconds:blockSeconds
      };
    });
  }

  function gateEngine(profile,status){
    const engine=root.HermitEngine;
    if(!engine||typeof engine.createDaySchedule!=='function')return;
    if(!engine.__infinitySourceOriginalCreateDaySchedule)engine.__infinitySourceOriginalCreateDaySchedule=engine.createDaySchedule;
    if(status.ready){
      if(engine.__infinitySourceOriginalCreateDaySchedule)engine.createDaySchedule=engine.__infinitySourceOriginalCreateDaySchedule;
      engine.__infinitySourceGate=false;
      return;
    }
    engine.__infinitySourceGate=true;
    engine.createDaySchedule=function(nowMs){return placeholderSchedule(nowMs,engine,root.INFINITY_MOVIE_SOURCE_STATUS||status);};
  }

  function applyCacheBeforeSchedule(profile,catalog){
    const cached=acceptedCached(profile);
    catalog.splice(0,catalog.length,...cached);
    const status=statusObject(profile,cached.length);
    renderStatus(status);
    gateEngine(profile,status);
    root.dispatchEvent(new CustomEvent('infinity:movie-catalog-cache',{detail:status}));
    return status;
  }

  let ytPromise=null;
  function ensureYT(){
    if(root.YT&&root.YT.Player)return Promise.resolve(root.YT);
    if(ytPromise)return ytPromise;
    ytPromise=new Promise((resolve,reject)=>{
      const previous=root.onYouTubeIframeAPIReady;
      let settled=false;
      root.onYouTubeIframeAPIReady=function(){
        try{if(typeof previous==='function')previous();}catch(error){console.error(error)}
        if(!settled&&root.YT&&root.YT.Player){settled=true;resolve(root.YT);}
      };
      let script=document.querySelector(`script[src="${IFRAME_API}"]`);
      if(!script){
        script=document.createElement('script');script.src=IFRAME_API;
        script.referrerPolicy='strict-origin-when-cross-origin';
        (document.head||document.documentElement).appendChild(script);
      }
      script.addEventListener('error',()=>{if(!settled){settled=true;reject(new Error('YouTube iframe API failed to load'));}},{once:true});
      const started=Date.now();
      const poll=setInterval(()=>{
        if(root.YT&&root.YT.Player){clearInterval(poll);if(!settled){settled=true;resolve(root.YT);}}
        else if(Date.now()-started>16000){clearInterval(poll);if(!settled){settled=true;reject(new Error('YouTube iframe API timeout'));}}
      },100);
    });
    return ytPromise;
  }

  function hiddenMount(id){
    const host=document.createElement('div');host.id=id;host.setAttribute('aria-hidden','true');
    host.style.cssText='position:fixed;left:-10000px;top:-10000px;width:2px;height:2px;overflow:hidden;pointer-events:none;opacity:.001';
    document.body.appendChild(host);return host;
  }

  async function playlistIds(playlistId){
    if(!playlistId)return[];
    const YT=await ensureYT();
    const mountId=`infinityPlaylistProbe-${Math.random().toString(36).slice(2)}`;
    hiddenMount(mountId);
    return new Promise(resolve=>{
      let done=false,player=null;
      const finish=ids=>{
        if(done)return;done=true;
        try{player&&player.destroy&&player.destroy()}catch(_){ }
        document.getElementById(mountId)?.remove();
        resolve(Array.isArray(ids)?ids.filter(Boolean):[]);
      };
      const timer=setTimeout(()=>finish(player&&player.getPlaylist?player.getPlaylist():[]),14000);
      player=new YT.Player(mountId,{
        width:'2',height:'2',playerVars:{playsinline:1,controls:0,autoplay:0,enablejsapi:1,origin:location.origin,widget_referrer:location.href},
        events:{
          onReady:()=>{try{player.cuePlaylist({list:String(playlistId),listType:'playlist',index:0,startSeconds:0})}catch(_){clearTimeout(timer);finish([])}},
          onStateChange:event=>{if(event.data===YT.PlayerState.CUED){clearTimeout(timer);setTimeout(()=>finish(player.getPlaylist()),350)}},
          onError:()=>{clearTimeout(timer);finish(player&&player.getPlaylist?player.getPlaylist():[])}
        }
      });
    });
  }

  async function oembed(videoId){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),6500);
    try{
      const url=`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
      const response=await fetch(url,{mode:'cors',cache:'force-cache',signal:controller.signal});
      if(!response.ok)throw new Error(`oEmbed ${response.status}`);
      const data=await response.json();
      return {videoId,title:String(data.title||'').trim(),author:String(data.author_name||'').trim(),thumbnailUrl:String(data.thumbnail_url||'')};
    }catch(_){return null}finally{clearTimeout(timer)}
  }

  async function probeDuration(videoId){
    const YT=await ensureYT();
    const mountId=`infinityDurationProbe-${Math.random().toString(36).slice(2)}`;
    hiddenMount(mountId);
    return new Promise(resolve=>{
      let done=false,player=null,poll=null;
      const finish=seconds=>{
        if(done)return;done=true;
        clearInterval(poll);clearTimeout(timer);
        try{player&&player.destroy&&player.destroy()}catch(_){ }
        document.getElementById(mountId)?.remove();
        resolve(Math.max(0,Math.floor(Number(seconds)||0)));
      };
      const timer=setTimeout(()=>finish(0),9000);
      player=new YT.Player(mountId,{
        width:'2',height:'2',playerVars:{playsinline:1,controls:0,autoplay:0,enablejsapi:1,origin:location.origin,widget_referrer:location.href},
        events:{
          onReady:()=>{
            try{player.cueVideoById({videoId,startSeconds:0})}catch(_){finish(0);return}
            poll=setInterval(()=>{const duration=Number(player.getDuration&&player.getDuration())||0;if(duration>0)finish(duration)},180);
          },
          onStateChange:event=>{if(event.data===YT.PlayerState.CUED){const duration=Number(player.getDuration&&player.getDuration())||0;if(duration>0)finish(duration)}},
          onError:()=>finish(0)
        }
      });
    });
  }

  function deterministicOrder(ids,profile){
    return ids.slice().sort((a,b)=>hash(`${weekKey()}:${profile.channelId}:${a}`)-hash(`${weekKey()}:${profile.channelId}:${b}`));
  }

  async function harvest(profile,catalog){
    const target=targetCount(profile);
    const owners=readOwners();
    const accepted=acceptedCached(profile);
    const ids=new Set(accepted.map(item=>item.videoId));
    const titles=new Set(accepted.map(item=>normalizedTitle(item.title)));
    const playlistIdsList=(Array.isArray(profile.playlists)?profile.playlists:[]).map(entry=>typeof entry==='string'?entry:entry&&entry.id).filter(Boolean);
    let candidateIds=[];

    for(const listId of playlistIdsList){
      try{candidateIds.push(...await playlistIds(listId))}catch(_){ }
      if(candidateIds.length>=DEFAULT_MAX_CANDIDATES*2)break;
    }

    candidateIds=[...new Set(candidateIds)].filter(id=>!ids.has(id));
    candidateIds=deterministicOrder(candidateIds,profile).slice(0,Math.max(target*4,Number(profile.maxCandidates)||DEFAULT_MAX_CANDIDATES));

    const concurrency=Math.max(2,Math.min(8,Number(profile.concurrency)||6));
    let cursor=0;
    async function worker(){
      while(cursor<candidateIds.length&&accepted.length<target){
        const videoId=candidateIds[cursor++];
        const meta=await oembed(videoId);
        if(!meta||!titleMatchesProfile(meta.title,profile))continue;
        const titleKey=normalizedTitle(meta.title);
        if(!titleKey||titles.has(titleKey)||!titleAvailableFor(profile,meta.title,owners))continue;
        const duration=await probeDuration(videoId);
        if(duration<3600||duration>7200)continue;
        if(!claimTitle(profile,meta.title,owners))continue;
        const title=cleanTitle(meta.title)||meta.title;
        const item={
          id:`${profile.channelId||'MOVIE'}-WEB-${videoId}`,
          title,
          originalTitle:meta.title,
          year:extractYear(meta.title),
          collection:profile.collection||profile.sourceName||'Full Movie',
          runtimeSeconds:duration,
          videoId,
          source:meta.author||profile.sourceName||'YouTube',
          sourceUrl:`https://www.youtube.com/watch?v=${videoId}`,
          networkChannel:profile.channelId||'',
          contentClass:profile.contentClass||'Feature Film',
          rating:profile.rating||'Unrated',
          cleared:true,
          discovered:true,
          sourceFarmVersion:VERSION,
          posterUrl:meta.thumbnailUrl||''
        };
        ids.add(videoId);titles.add(titleKey);accepted.push(item);
        writeJson(ownerKey(),owners);
        writeCache(profile,accepted);
        const status=statusObject(profile,accepted.length);
        renderStatus(status);
        root.dispatchEvent(new CustomEvent('infinity:movie-catalog-progress',{detail:status}));
      }
    }

    await Promise.all(Array.from({length:concurrency},()=>worker()));
    const finalItems=uniqueItems(accepted,target);
    catalog.splice(0,catalog.length,...finalItems);
    writeCache(profile,finalItems);
    writeJson(ownerKey(),owners);
    return finalItems;
  }

  function maybeReload(profile,beforeStatus,afterStatus){
    if(beforeStatus.ready||!afterStatus.ready)return;
    const key=`${RELOAD_PREFIX}${VERSION}:${profile.channelId||'movie'}:${weekKey()}`;
    try{
      if(sessionStorage.getItem(key)==='1')return;
      sessionStorage.setItem(key,'1');
      setTimeout(()=>location.reload(),180);
    }catch(_){location.reload()}
  }

  async function expand(profile,catalog,beforeStatus){
    try{
      const items=await harvest(profile,catalog);
      const afterStatus=statusObject(profile,items.length);
      renderStatus(afterStatus);
      root.dispatchEvent(new CustomEvent('infinity:movie-catalog-ready',{detail:afterStatus}));
      maybeReload(profile,beforeStatus,afterStatus);
      return items;
    }catch(error){
      console.error('Infinity movie source farm',error);
      const status=root.INFINITY_MOVIE_SOURCE_STATUS||beforeStatus;
      root.dispatchEvent(new CustomEvent('infinity:movie-catalog-error',{detail:{...status,message:String(error&&error.message||error)}}));
      return catalog;
    }
  }

  function auto(){
    const profile=root.INFINITY_MOVIE_SOURCE,catalog=root.HERMIT_CATALOG;
    if(!profile||!Array.isArray(catalog))return;
    const beforeStatus=applyCacheBeforeSchedule(profile,catalog);
    const start=()=>expand(profile,catalog,beforeStatus);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0),{once:true});
    else setTimeout(start,0);
  }

  root.InfinityMovieSourceFarm={
    VERSION,hash,weekKey,normalizedTitle,extractYear,titleMatchesProfile,
    readCache,acceptedCached,applyCacheBeforeSchedule,playlistIds,oembed,probeDuration,expand
  };
  auto();
})(window);
