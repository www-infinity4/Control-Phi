(function(root){
  'use strict';

  const VERSION='20260914-network1';
  const DAY_SECONDS=86400;

  function hash(text){
    let value=2166136261;
    const input=String(text||'');
    for(let i=0;i<input.length;i+=1)value=Math.imul(value^input.charCodeAt(i),16777619);
    return value>>>0;
  }

  function seededShuffle(items,seedText){
    const copy=Array.isArray(items)?items.slice():[];
    let seed=hash(seedText);
    const random=()=>{
      seed+=0x6D2B79F5;
      let value=seed;
      value=Math.imul(value^(value>>>15),value|1);
      value^=value+Math.imul(value^(value>>>7),value|61);
      return((value^(value>>>14))>>>0)/4294967296;
    };
    for(let i=copy.length-1;i>0;i-=1){
      const j=Math.floor(random()*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  }

  function identity(item){
    if(!item)return'';
    return String(item.id||item.videoId||item.sourceUrl||item.url||item.title||'').trim();
  }

  function runtimeSeconds(item,fallbackSeconds){
    const direct=Number(item&&item.runtimeSeconds);
    if(Number.isFinite(direct)&&direct>0)return Math.floor(direct);
    const minutes=Number(item&&item.runtimeMinutes);
    if(Number.isFinite(minutes)&&minutes>0)return Math.floor(minutes*60);
    return Math.max(0,Math.floor(Number(fallbackSeconds)||0));
  }

  function weeklyRequirement(slotSeconds,days){
    const seconds=Math.max(300,Math.floor(Number(slotSeconds)||3600));
    return Math.ceil(DAY_SECONDS/seconds)*Math.max(1,Math.floor(Number(days)||7));
  }

  function eligiblePrograms(catalog,options){
    const opts=options||{};
    const slotSeconds=Math.max(300,Number(opts.slotSeconds)||3600);
    const minRuntimeSeconds=Math.max(1,Number(opts.minRuntimeSeconds)||Math.min(slotSeconds*0.55,900));
    const failed=opts.failed instanceof Set?opts.failed:new Set(Array.isArray(opts.failed)?opts.failed:[]);
    const seen=new Set();
    return(Array.isArray(catalog)?catalog:[]).filter(item=>{
      if(!item||item.disabled||item.cleared===false||!item.videoId||failed.has(item.videoId))return false;
      const key=identity(item);
      if(!key||seen.has(key)||seen.has(item.videoId))return false;
      if(runtimeSeconds(item,slotSeconds)<minRuntimeSeconds)return false;
      seen.add(key);seen.add(item.videoId);
      return true;
    });
  }

  function validateCatalog(catalog,options){
    const opts=options||{};
    const slotSeconds=Math.max(300,Number(opts.slotSeconds)||3600);
    const days=Math.max(1,Math.floor(Number(opts.days)||7));
    const programs=eligiblePrograms(catalog,opts);
    const required=weeklyRequirement(slotSeconds,days);
    return{ok:programs.length>=required,required,available:programs.length,missing:Math.max(0,required-programs.length),days,slotSeconds,programs};
  }

  function staggeredBreaks(options){
    const opts=options||{};
    const runtime=Math.max(0,Math.floor(Number(opts.runtimeSeconds)||0));
    const block=Math.max(runtime,Math.floor(Number(opts.blockSeconds)||runtime));
    const requested=Math.max(0,Math.floor(Number(opts.count)||0));
    if(requested<1||runtime<900)return[];
    const edge=Math.max(180,Math.floor(Number(opts.edgeSeconds)||240));
    const usableStart=Math.min(runtime-1,edge);
    const usableEnd=Math.max(usableStart,runtime-edge);
    const span=Math.max(0,usableEnd-usableStart);
    if(span<300)return[];
    const seed=hash(`${opts.channelId||'channel'}:${opts.blockId||''}:${opts.dateKey||''}`);
    const points=[];
    for(let i=0;i<requested;i+=1){
      const base=(i+1)/(requested+1);
      const jitter=((hash(`${seed}:${i}`)%181)-90);
      const value=Math.max(usableStart,Math.min(usableEnd,Math.round(usableStart+span*base+jitter)));
      if(!points.some(existing=>Math.abs(existing-value)<180))points.push(value);
    }
    return points.sort((a,b)=>a-b).filter(value=>value<block-120);
  }

  function makeFreshDeck(catalog,options){
    const opts=options||{};
    const programs=eligiblePrograms(catalog,opts);
    const channelId=String(opts.channelId||'channel');
    const epochWeek=Math.floor((Number(opts.midnightMs)||Date.now())/604800000);
    return seededShuffle(programs,`${channelId}:seven-day-deck:${epochWeek}:${programs.map(identity).sort().join('|')}`);
  }

  root.InfinityChannelPolicy={VERSION,DAY_SECONDS,hash,seededShuffle,identity,runtimeSeconds,weeklyRequirement,eligiblePrograms,validateCatalog,staggeredBreaks,makeFreshDeck};
})(window);
