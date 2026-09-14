(function(root){
  'use strict';

  const VERSION='20260914-playback1';
  const seed=Array.isArray(root.__INFINITY_MOVIE_SEED_CATALOG)?root.__INFINITY_MOVIE_SEED_CATALOG.map(item=>({...item})):[];
  const catalog=root.HERMIT_CATALOG;
  const profile=root.INFINITY_MOVIE_SOURCE||{};
  const engine=root.HermitEngine;
  if(!Array.isArray(catalog)||!engine)return;

  function clean(value){return String(value||'').toLowerCase().replace(/\b(full|free|hd|movie|film|watch|english|official|feature)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
  function hash(text){let value=2166136261;for(let i=0;i<String(text||'').length;i++)value=Math.imul(value^String(text).charCodeAt(i),16777619);return value>>>0}
  function playable(item){const runtime=Number(item&&item.runtimeSeconds)||0;return !!(item&&item.videoId&&item.cleared!==false&&runtime>=3600&&runtime<=7200)}
  function mergePlayable(){
    const out=[],ids=new Set(),titles=new Set();
    for(const item of [...seed,...catalog]){
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
    const strong=button.querySelector('span')||button,small=button.querySelector('small');
    if(strong&&status.playableNow)strong.textContent=`Enter ${prettyChannel(status)}`;
    if(small){
      small.textContent=status.ready?'Join the movie at the moment airing now':`${status.count}/${status.minimum} unique movies ready · more are being verified in background`;
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
      let schedule=[];
      try{schedule=original.call(engine,nowMs,source)}catch(_){schedule=[]}
      if(!Array.isArray(schedule)||!schedule.length)return schedule;
      const used=new Set(schedule.map(block=>block&&block.movie&&block.movie.videoId).filter(Boolean));
      let cursor=hash(`${status.channelId}:${schedule[0]?.id||nowMs}`)%source.length;
      return schedule.map((block,index)=>{
        if(block&&block.movie&&block.movie.videoId)return block;
        let choice=null;
        for(let tries=0;tries<source.length;tries++){
          const candidate=source[(cursor+tries)%source.length];
          if(!used.has(candidate.videoId)){choice=candidate;cursor=(cursor+tries+1)%source.length;break}
        }
        if(!choice){choice=source[cursor%source.length];cursor=(cursor+1)%source.length}
        used.add(choice.videoId);
        return {...block,id:block?.id||`TEMP-${index}`,movie:{...choice,sourceFarmPending:true}};
      });
    };
  }
  function refresh(){
    const pool=mergePlayable();
    const status=effectiveStatus(pool);
    render(status);installScheduleGuard(status,pool);
    root.dispatchEvent(new CustomEvent('infinity:movie-playback-guard',{detail:status}));
    return status;
  }

  refresh();
  ['infinity:movie-catalog-progress','infinity:movie-catalog-ready','infinity:movie-catalog-error'].forEach(name=>root.addEventListener(name,()=>setTimeout(refresh,0)));
  root.InfinityMoviePlaybackGuard={VERSION,refresh};
})(window);
