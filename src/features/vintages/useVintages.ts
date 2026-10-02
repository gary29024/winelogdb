import { useEffect,useState } from 'react';
import { loadRegionWines,loadVillageData,loadVintageIndex,type VintageWine } from './data';
import type { VillageData,VintageIndex,VintageRegionConfig } from './types';

export type VintageState={index:VintageIndex|null;village:VillageData|null;error:string};

/** The region index and one village's file. The village file reloads when the village changes. */
export function useVintageData(region:VintageRegionConfig,villageId:string):VintageState{
  const [index,setIndex]=useState<VintageIndex|null>(null);
  const [loaded,setLoaded]=useState<{id:string;data:VillageData}|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{let active=true;loadVintageIndex(region).then(result=>{if(active)setIndex(result)}).catch(e=>{if(active)setError((e as Error).message)});return()=>{active=false}},[region]);
  useEffect(()=>{
    let active=true;
    loadVillageData(region,villageId).then(data=>{if(active){setLoaded({id:villageId,data});setError('')}}).catch(e=>{if(active)setError((e as Error).message)});
    return()=>{active=false};
  },[region,villageId]);
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

const STORAGE_KEY='winelog.vintages.village';
export function rememberedVillage(){try{return window.localStorage.getItem(STORAGE_KEY)}catch{return null}}
export function rememberVillage(id:string){try{window.localStorage.setItem(STORAGE_KEY,id)}catch{/* private mode: the URL still carries it */}}
