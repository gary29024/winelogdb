import { useEffect,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { loadRegionWines,loadVillageData,loadVintageIndex,type VintageWine } from './data';
import type { Baseline } from './model';
import type { VillageData,VintageIndex,VintageRegionConfig } from './types';

export type VintageState={index:VintageIndex|null;village:VillageData|null;error:string};

/** The region index and one village's file. The village file reloads when the village changes. */
export function useVintageData(region:VintageRegionConfig,villageId:string):VintageState{
  const [loadedIndex,setIndex]=useState<{region:string;index:VintageIndex}|null>(null);
  const [loaded,setLoaded]=useState<{id:string;data:VillageData}|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{let active=true;loadVintageIndex(region).then(result=>{if(active)setIndex({region:region.id,index:result})}).catch(e=>{if(active)setError((e as Error).message)});return()=>{active=false}},[region]);
  useEffect(()=>{
    let active=true;
    loadVillageData(region,villageId).then(data=>{if(active){setLoaded({id:villageId,data});setError('')}}).catch(e=>{if(active)setError((e as Error).message)});
    return()=>{active=false};
  },[region,villageId]);
  // Switching region must never pair the old region's index with the new region's village.
  const index=loadedIndex?.region===region.id?loadedIndex.index:null;
  return {index,village:loaded?.id===villageId?loaded.data:null,error};
}

/** The reader's wines in this region; an empty list (never an error banner) if the Journal cannot be read. */
export function useRegionWines(region:VintageRegionConfig){
  const [wines,setWines]=useState<VintageWine[]|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    loadRegionWines(region,controller.signal).then(setWines).catch(()=>{if(!controller.signal.aborted)setWines([])});
    return()=>controller.abort();
  },[region]);
  return wines;
}

// Burgundy keeps the original key, so a returning reader still opens on their village.
const villageKey=(region:string)=>region==='burgundy'?'winelog.vintages.village':`winelog.vintages.village.${region}`;
const REGION_KEY='winelog.vintages.region';
export function rememberedVillage(region='burgundy'){try{return window.localStorage.getItem(villageKey(region))}catch{return null}}
export function rememberRegion(region:string){try{window.localStorage.setItem(REGION_KEY,region)}catch{/* the URL still carries it */}}
export function rememberedRegion(){try{return window.localStorage.getItem(REGION_KEY)}catch{return null}}
export function rememberVillage(id:string,region='burgundy'){
  try{window.localStorage.setItem(villageKey(region),id);window.localStorage.setItem(REGION_KEY,region)}catch{/* private mode: the URL still carries it */}
}

/** Which normal the page compares with. 1991–2020 unless this visit chose otherwise: the
 * choice lives in the URL, so a shared link keeps it, but a new visit starts on the standard. */
export function useBaseline():[Baseline,(next:Baseline)=>void]{
  const [params,setParams]=useSearchParams();
  const value:Baseline=params.get('baseline')==='era'?'era':'standard';
  const set=(next:Baseline)=>{
    setParams(current=>{const copy=new URLSearchParams(current);if(next==='era')copy.set('baseline','era');else copy.delete('baseline');return copy},{replace:true});
  };
  return [value,set];
}
