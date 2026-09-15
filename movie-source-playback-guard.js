(function(root){
  'use strict';

  const VERSION='20260914-playback2';
  const seed=Array.isArray(root.__INFINITY_MOVIE_SEED_CATALOG)?root.__INFINITY_MOVIE_SEED_CATALOG.map(item=>({...item})):[];
  const catalog=root.HERMIT_CATALOG;
  const profile=root.INFINITY_MOVIE_SOURCE||{};
  const engine=root.HermitEngine;
  if(!Array.isArray(catalog)||!engine)return;

  function clean(value){return String(value||'').toLowerCase().replace(/\b(full|free|hd|movie|film|watch|english|official|feature)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
  function playable(item){const runtime=Number(item&&item.runtimeSeconds)||0;return !!(item&&item.videoId&&item.cleared!==false&&runtime>=3600&&runtime<=7200)}
  function channelId(){return String(profile.channelId||'MOVIE').toUpperCase()}
  function seedBelongsHere(item){
    if(!item)return false;
    if(item.networkChannel&&String(item.networkChannel).toUpperCase()===channelId())return true;
    const label=`${item.source||''} ${item.collection||''}`.toLowerCase();
    const names=String(profile.sourceName||'').toLowerCase().split('+').map(value=>value.trim()).filter(value=>value.length>3);
    return names.some(name=>label.includes(name));
  }
  function mergePlayable(){
    const out=[],ids=new Set(),titles=new Set();
    const candidates=[...catalog,...seed.filter(seedBelongsHere)];
    for(const item of candidates){
      if(!playable(item))continue;
      const id=String(item.videoId),title=clean(item.originalTitle||item.title||id);
      if(ids.has(id)||titles.has(title))continue;
      ids.add(id);titles.add(title);out.push(item);
    }
    catalog.splice(0,catalog.length,...out);
    return out;
  }
  function effectiveStatus(pool){
    const base=root.INFINITY_MOVIE_SOURCE_STATUS||{};
    const minimum=Math.max(1,Number(base.minimum||profile.minimumReadyCount||84));
    const target=Math.max(minimum,Number(base.target||profile.targetCount||96));
    return {...base,version:VERSION,channelId:base.channelId||profile.channelId||'MOVIE',count:pool.length,minimum,target,ready:pool.length>=minimum,sourceName:base.sourceName||profile.sourceName||'YouTube',playableNow:pool.length>0};
  }
  function prettyChannel(status){return String(status.channelId||'Movie').replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase())}
  function render(status){
    root.INFINITY_MOVIE_SOURCE_STATUS=status;
    const button=document.getElementById('enterButton');if(!button)return;
    if(status.playableNow){button.disabled=false;button.removeAttribute('aria-busy')}
    else{button.disabled=true;button.setAttribute('aria-busy','true')}
    const strong=button.querySelector('span')||button,small=button.querySelector('small');
    if(strong)strong.textContent=status.playableNow?`Enter ${prettyChannel(status)}`:`Building ${prettyChannel(status)} lineup`;
    if(small){
      small.textContent=status.ready?'84+ unique full movies ready for the seven-day deck':`${status.count}/${status.minimum} verified movies · empty future slots stay empty instead of repeating or borrowing the wrong channel`;
    }
  }
  function originalSchedule(){return engine.__infinitySourceOriginalCreateDaySchedule||engine.__infinityPlaybackOriginalCreateDaySchedule||engine.createDaySchedule}
  function installScheduleGuard(status,pool){
    if(typeof engine.createDaySchedule!=='function')return;
    if(!engine.__infinityPlaybackOriginalCreateDaySchedule)engine.__infinityPlaybackOriginalCreateDaySchedule=originalSchedule();
    const original=engine.__infinityPlaybackOriginalCreateDaySchedule;
    if(status.ready){engine.createDaySchedule=original;engine.__infinitySourceGate=false;engine.__infinityPlaybackGuard=false;return}
    if(!pool.length)return;
    engine.__infinitySourceGate=false;engine.__infinityPlaybackGuard=true;
    engine.createDaySchedule=function(nowMs,sourceCatalog){
      const livePool=(Array.isArray(sourceCatalog)?sourceCatalog:catalog).filter(playable);
      const source=livePool.length?livePool:pool;
      try{return original.call(engine,nowMs,source)}catch(_){return []}
    };
  }
  function refreshWeeklyGuide(){
    const guide=root.InfinityWeeklyGuide;
    if(!guide||!Array.isArray(guide.days)||typeof engine.createDaySchedule!=='function')return;
    for(const day of guide.days){
      try{
        const dayMs=Number(day.startsAtMs)||Date.now();
        day.blocks=engine.createDaySchedule(dayMs,catalog);
        if(day.blocks&&day.blocks[0]){
          day.startsAtMs=day.blocks[0].startsAtMs;
          day.key=String(day.blocks[0].id||'').slice(0,10);
        }
      }catch(_){ }
    }
    try{if(typeof guide.refresh==='function')guide.refresh()}catch(_){ }
  }
  function reloadWhenTodayIsReal(status){
    if(status.count<12)return;
    const key=`infinity:movie-source-farm:first-day:${VERSION}:${status.channelId}`;
    try{
      if(sessionStorage.getItem(key)==='1')return;
      sessionStorage.setItem(key,'1');
      setTimeout(()=>location.reload(),180);
    }catch(_){ }
  }
  function refresh(){
    const pool=mergePlayable();
    const status=effectiveStatus(pool);
    render(status);installScheduleGuard(status,pool);
    setTimeout(refreshWeeklyGuide,0);
    setTimeout(refreshWeeklyGuide,500);
    reloadWhenTodayIsReal(status);
    root.dispatchEvent(new CustomEvent('infinity:movie-playback-guard',{detail:status}));
    return status;
  }

  refresh();
  ['infinity:movie-catalog-cache','infinity:movie-catalog-progress','infinity:movie-catalog-ready','infinity:movie-catalog-error'].forEach(name=>root.addEventListener(name,()=>setTimeout(refresh,0)));
  root.InfinityMoviePlaybackGuard={VERSION,refresh};
})(window);
