(function(root){
  'use strict';

  const VERSION='20260914-unique2';
  const PROFILE_COUNT=8;
  const CACHE_PREFIX='infinity:movie-source-farm:v4:';
  const RELOAD_PREFIX='infinity:movie-source-farm:reload:';
  const IFRAME_API='https://www.youtube.com/iframe_api';
  const DEFAULT_TARGET=96;
  const DEFAULT_MAX_CANDIDATES=320;
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
      .replace(/\s*[|•·]\s*(?:full\s+movie|free\s+movie|family\s+central|movie\s+central|sci-?fi\s+central|filmrise\s+movies|encouragetv|free\s+movies\s+by\s+cineverse|pizzaflix).*$/i,'')
      .replace(/\s+/g,' ').trim();
  }

  function normalizedTitle(value){
    return cleanTitle(value).toLowerCase().replace(/\b(full|free|hd|movie|film|watch|english|official)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
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

  function profileBucket(profile,title){
    const normalized=normalizedTitle(title);
    if(!normalized)return-1;
    return hash(normalized)%Math.max(1,Number(profile.partitionCount)||PROFILE_COUNT);
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
    const bucket=profileBucket(profile,raw);
    if(bucket<0)return false;
    if(Number.isInteger(Number(profile.partitionIndex))&&bucket!==Number(profile.partitionIndex))return false;
    return true;
  }

  function acceptedItemMatches(item,profile){
    if(!item||!item.videoId||item.cleared===false)return false;
    const title=item.title||'';
    if(!title||JUNK_CUE.test(title))return false;
    if(!yearAllowed(Number(item.year)||extractYear(title),profile))return false;
    const bucket=profileBucket(profile,title);
    if(bucket<0)return false;
    if(Number.isInteger(Number(profile.partitionIndex))&&bucket!==Number(profile.partitionIndex))return false;
    if(Number.isInteger(Number(item.networkBucket))&&item.networkBucket!==bucket)return false;
    return true;
  }

  function prepareSeed(profile,catalog){
    if(!Array.isArray(catalog))return catalog;
    const seenIds=new Set(),seenTitles=new Set();
    const filtered=[];
    for(const item of catalog){
      if(!acceptedItemMatches(item,profile))continue;
      const titleKey=normalizedTitle(item.title);
      if(seenIds.has(item.videoId)||seenTitles.has(titleKey))continue;
      seenIds.add(item.videoId);seenTitles.add(titleKey);
      filtered.push({...item,seed:item.discovered!==true,networkBucket:profileBucket(profile,item.title)});
    }
    catalog.splice(0,catalog.length,...filtered);
    root.dispatchEvent(new CustomEvent('infinity:movie-catalog-seeded',{detail:{channelId:profile.channelId,count:filtered.length,version:VERSION}}));
    return catalog;
  }

  function cacheKey(profile){return `${CACHE_PREFIX}${profile.channelId||'movie'}:${weekKey()}`;}
  function readCache(profile){
    try{
      const data=JSON.parse(localStorage.getItem(cacheKey(profile))||'null');
      if(!data||data.version!==VERSION||!Array.isArray(data.items))return[];
      return data.items;
    }catch(_){return[];}
  }
  function writeCache(profile,items){
    try{localStorage.setItem(cacheKey(profile),JSON.stringify({version:VERSION,updatedAt:Date.now(),items:items.slice(0,180)}));}catch(_){ }
  }

  function uniqueMerge(seed,items,target){
    const out=[],ids=new Set(),titles=new Set();
    for(const item of [...seed,...items]){
      if(!item||!item.videoId)continue;
      const titleKey=normalizedTitle(item.title||item.videoId);
      if(!titleKey||ids.has(item.videoId)||titles.has(titleKey))continue;
      ids.add(item.videoId);titles.add(titleKey);out.push(item);
      if(target&&out.length>=target)break;
    }
    return out;
  }

  function applyCached(profile,catalog){
    const target=Math.max(84,Number(profile.targetCount)||DEFAULT_TARGET);
    const cached=readCache(profile).filter(item=>acceptedItemMatches(item,profile));
    if(!cached.length)return catalog;
    const merged=uniqueMerge(catalog,cached,target);
    catalog.splice(0,catalog.length,...merged);
    root.dispatchEvent(new CustomEvent('infinity:movie-catalog-cache',{detail:{channelId:profile.channelId,count:merged.length,version:VERSION}}));
    return catalog;
  }

  let ytPromise=null;
  function ensureYT(){
    if(root.YT&&root.YT.Player)return Promise.resolve(root.YT);
    if(ytPromise)return ytPromise;
    ytPromise=new Promise((resolve,reject)=>{
      const previous=root.onYouTubeIframeAPIReady;
      let settled=false;
      root.onYouTubeIframeAPIReady=function(){
        try{if(typeof previous==='function')previous();}catch(error){console.error(error);}
        if(!settled&&root.YT&&root.YT.Player){settled=true;resolve(root.YT);}
      };
      let script=document.querySelector(`script[src="${IFRAME_API}"]`);
      if(!script){script=document.createElement('script');script.src=IFRAME_API;script.referrerPolicy='strict-origin-when-cross-origin';(document.head||document.documentElement).appendChild(script);}
      script.addEventListener('error',()=>{if(!settled){settled=true;reject(new Error('YouTube iframe API failed to load'));}},{once:true});
      const started=Date.now();
      const poll=setInterval(()=>{
        if(root.YT&&root.YT.Player){clearInterval(poll);if(!settled){settled=true;resolve(root.YT);}}
        else if(Date.now()-started>15000){clearInterval(poll);if(!settled){settled=true;reject(new Error('YouTube iframe API timeout'));}}
      },100);
    });
    return ytPromise;
  }

  function hiddenMount(id){
    let host=document.getElementById(id);
    if(host)return host;
    host=document.createElement('div');host.id=id;host.setAttribute('aria-hidden','true');
    host.style.cssText='position:fixed;left:-10000px;top:-10000px;width:2px;height:2px;overflow:hidden;pointer-events:none;opacity:.001';
    document.body.appendChild(host);return host;
  }

  async function playlistIds(playlistId){
    if(!playlistId)return[];
    const YT=await ensureYT();
    const mountId=`infinitySourceProbe-${Math.random().toString(36).slice(2)}`;
    hiddenMount(mountId);
    return new Promise(resolve=>{
      let done=false,player=null;
      const finish=ids=>{
        if(done)return;done=true;
        try{player&&player.destroy&&player.destroy();}catch(_){ }
        document.getElementById(mountId)?.remove();
        resolve(Array.isArray(ids)?ids.filter(Boolean):[]);
      };
      const timer=setTimeout(()=>finish(player&&player.getPlaylist?player.getPlaylist():[]),12000);
      player=new YT.Player(mountId,{
        width:'2',height:'2',playerVars:{playsinline:1,controls:0,autoplay:0,enablejsapi:1,origin:location.origin,widget_referrer:location.href},
        events:{
          onReady:()=>{try{player.cuePlaylist({list:String(playlistId),listType:'playlist',index:0,startSeconds:0});}catch(_){finish([]);}},
          onStateChange:event=>{if(event.data===YT.PlayerState.CUED){clearTimeout(timer);setTimeout(()=>finish(player.getPlaylist()),350);}},
          onError:()=>{clearTimeout(timer);finish(player&&player.getPlaylist?player.getPlaylist():[]);}
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
      return{videoId,title:String(data.title||'').trim(),author:String(data.author_name||'').trim(),thumbnailUrl:String(data.thumbnail_url||'')};
    }catch(_){return null;}finally{clearTimeout(timer);}
  }

  function deterministicOrder(ids,profile){
    return ids.slice().sort((a,b)=>hash(`${weekKey()}:${profile.channelId}:${a}`)-hash(`${weekKey()}:${profile.channelId}:${b}`));
  }

  async function harvest(profile,catalog){
    const target=Math.max(84,Number(profile.targetCount)||DEFAULT_TARGET);
    const cached=readCache(profile).filter(item=>acceptedItemMatches(item,profile));
    let merged=uniqueMerge(catalog,cached,target);
    if(merged.length>=target){catalog.splice(0,catalog.length,...merged);return merged;}

    const playlistIdsList=(Array.isArray(profile.playlists)?profile.playlists:[]).map(entry=>typeof entry==='string'?entry:entry&&entry.id).filter(Boolean);
    let candidateIds=[];
    for(const listId of playlistIdsList){
      try{candidateIds.push(...await playlistIds(listId));}catch(_){ }
      if(candidateIds.length>=Number(profile.maxCandidates||DEFAULT_MAX_CANDIDATES)*2)break;
    }
    candidateIds=[...new Set(candidateIds)].filter(id=>!merged.some(item=>item.videoId===id));
    candidateIds=deterministicOrder(candidateIds,profile).slice(0,Math.max(target*4,Number(profile.maxCandidates)||DEFAULT_MAX_CANDIDATES));

    const accepted=[];
    const concurrency=Math.max(2,Math.min(12,Number(profile.concurrency)||8));
    let cursor=0;
    async function worker(){
      while(cursor<candidateIds.length&&merged.length+accepted.length<target){
        const id=candidateIds[cursor++];
        const meta=await oembed(id);
        if(!meta||!titleMatchesProfile(meta.title,profile))continue;
        const rawTitle=meta.title;
        const title=cleanTitle(rawTitle)||rawTitle;
        const year=extractYear(rawTitle);
        const networkBucket=profileBucket(profile,rawTitle);
        accepted.push({
          id:`${profile.channelId||'MOVIE'}-WEB-${id}`,
          title,
          year,
          collection:profile.collection||profile.sourceName||'Full Movie',
          runtimeSeconds:Math.max(3600,Math.min(7200,Number(profile.defaultRuntimeSeconds)||6900)),
          videoId:id,
          source:meta.author||profile.sourceName||'YouTube',
          sourceUrl:`https://www.youtube.com/watch?v=${id}`,
          networkChannel:profile.channelId||'',
          contentClass:profile.contentClass||'Feature Film',
          rating:profile.rating||'Unrated',
          cleared:true,
          discovered:true,
          networkBucket,
          sourceFarmVersion:VERSION,
          posterUrl:meta.thumbnailUrl||''
        });
      }
    }
    await Promise.all(Array.from({length:concurrency},()=>worker()));
    merged=uniqueMerge(catalog,accepted,target);
    catalog.splice(0,catalog.length,...merged);
    writeCache(profile,merged);
    return merged;
  }

  function maybeReloadForFreshCatalog(profile,beforeCount,afterCount){
    if(afterCount<=beforeCount)return;
    const target=Math.max(84,Number(profile.targetCount)||DEFAULT_TARGET);
    const key=`${RELOAD_PREFIX}${VERSION}:${profile.channelId||'movie'}:${weekKey()}`;
    try{
      const count=Math.max(0,Number(sessionStorage.getItem(key))||0);
      if(count>=2)return;
      if(afterCount<Math.min(target,beforeCount+8))return;
      sessionStorage.setItem(key,String(count+1));
      setTimeout(()=>location.reload(),120);
    }catch(_){ }
  }

  async function expand(profile,catalog){
    if(!profile||!Array.isArray(catalog))return[];
    const beforeCount=catalog.length;
    try{
      const items=await harvest(profile,catalog);
      root.dispatchEvent(new CustomEvent('infinity:movie-catalog-ready',{detail:{channelId:profile.channelId,count:items.length,target:Math.max(84,Number(profile.targetCount)||DEFAULT_TARGET),version:VERSION}}));
      maybeReloadForFreshCatalog(profile,beforeCount,items.length);
      return items;
    }catch(error){
      console.error('Infinity movie source farm',error);
      root.dispatchEvent(new CustomEvent('infinity:movie-catalog-error',{detail:{channelId:profile.channelId,message:String(error&&error.message||error),version:VERSION}}));
      return catalog;
    }
  }

  function auto(){
    const profile=root.INFINITY_MOVIE_SOURCE,catalog=root.HERMIT_CATALOG;
    if(!profile||!Array.isArray(catalog))return;
    prepareSeed(profile,catalog);
    applyCached(profile,catalog);
    const start=()=>expand(profile,catalog);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0),{once:true});
    else setTimeout(start,0);
  }

  root.InfinityMovieSourceFarm={VERSION,hash,weekKey,normalizedTitle,extractYear,titleMatchesProfile,acceptedItemMatches,prepareSeed,applyCached,playlistIds,oembed,expand};
  auto();
})(window);
