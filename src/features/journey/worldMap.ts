import type { CountryStat,RegionStat } from './api';
import { COUNTRY_ALIASES,COUNTRY_ANCHORS,LAND_MASK,MAP_CELL,MAP_COLUMNS,MAP_LAT_BOTTOM,MAP_LAT_TOP,REGION_ANCHORS } from './worldMapData';

// The map is drawn in an equirectangular projection at one SVG unit per degree,
// so the viewBox is simply the window the generator rasterised.
export const MAP_WIDTH=MAP_COLUMNS*MAP_CELL;
export const MAP_HEIGHT=MAP_LAT_TOP-MAP_LAT_BOTTOM;

const DOT_RADIUS=1.32;
// A country lights up the land dots around its anchor rather than the dots that
// strictly belong to it: the grid is far too coarse to hold borders, and a soft
// halo reads better than a single lit cell anyway.
const HALO_RADIUS=8.5;
const MIN_MARKER=2.2;
const MAX_MARKER=4;
// Western Europe holds a dozen wine countries inside fifteen degrees, so their
// markers would fuse into one blob. Nudge overlapping markers apart, but never
// further than MARKER_MAX_DRIFT from the country they stand for.
const SEPARATION_PASSES=48;
const SEPARATION_GAP=.7;
/** How far a marker may be pushed from its country, in degrees. */
export const MARKER_MAX_DRIFT=7;

export type MapMarker={
  /** Unique per marker, because a country can now carry several. */
  id:string;
  country:string;
  /** The region this stands for, where it stands for one rather than a country. */
  region:string|null;
  wines:number;x:number;y:number;radius:number;anchorX:number;anchorY:number;
};

export function normalizeCountryName(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

const countryKey=(country:string)=>{
  const key=normalizeCountryName(country);
  if(!key)return '';
  return COUNTRY_ANCHORS[key]?key:COUNTRY_ALIASES[key]??'';
};

export function countryAnchor(country:string):readonly [number,number]|null{
  return COUNTRY_ANCHORS[countryKey(country)]??null;
}

/**
 * How far apart a country's wine regions are, as the diagonal of the box that
 * holds them, in degrees.
 *
 * This is the whole rule for whether a country is drawn as one dot or several,
 * and it is computed rather than listed so nobody has to remember to keep a
 * list right. Eight degrees is about nine hundred kilometres, and it is the
 * halo radius: past it the lit patch around one region no longer covers the
 * next, which is exactly the point at which a single dot starts telling lies.
 */
const SPREAD_DEGREES=HALO_RADIUS;

const regionAnchorsByCountry=new Map<string,Map<string,readonly [number,number]>>(
  Object.entries(REGION_ANCHORS).map(([country,regions])=>[country,
    new Map(Object.entries(regions).map(([region,anchor])=>[normalizeCountryName(region),anchor]))]));

export function regionSpread(country:string){
  const regions=regionAnchorsByCountry.get(countryKey(country));
  if(!regions||regions.size<2)return 0;
  const points=[...regions.values()];
  const lats=points.map(point=>point[0]),longitudes=points.map(point=>point[1]);
  return Math.hypot(Math.max(...lats)-Math.min(...lats),Math.max(...longitudes)-Math.min(...longitudes));
}

/** Whether this country's regions are far enough apart to be worth their own dots. */
export const countryIsSpread=(country:string)=>regionSpread(country)>SPREAD_DEGREES;

export function regionAnchor(country:string,region:string):readonly [number,number]|null{
  return regionAnchorsByCountry.get(countryKey(country))?.get(normalizeCountryName(region))??null;
}

export function projectPoint(latitude:number,longitude:number){
  return {x:longitude+180,y:MAP_LAT_TOP-latitude};
}

function landDots(){
  const dots:{x:number;y:number}[]=[];
  for(let row=0;row<LAND_MASK.length;row+=1){
    const cells=LAND_MASK[row];
    for(let column=0;column<cells.length;column+=1){
      if(cells[column]==='#')dots.push({x:column*MAP_CELL+MAP_CELL/2,y:row*MAP_CELL+MAP_CELL/2});
    }
  }
  return dots;
}

const allLandDots=landDots();

function dotPath(dots:{x:number;y:number}[],radius:number){
  const size=radius.toFixed(2),span=(radius*2).toFixed(2);
  return dots.map(dot=>`M${(dot.x-radius).toFixed(2)} ${dot.y.toFixed(2)}a${size} ${size} 0 1 0 ${span} 0a${size} ${size} 0 1 0 -${span} 0Z`).join('');
}

/**
 * Place the markers the journal has earned, largest last so the busiest paint
 * over their neighbours rather than under them.
 *
 * One per country, except where a country's regions are too far apart for one
 * dot to stand for them - the United States, Australia, Argentina, Chile,
 * New Zealand, Canada - which get a dot per region the journal actually holds.
 * Which countries those are is worked out from the anchors themselves rather
 * than listed, so South Africa, whose regions all sit within an hour of Cape
 * Town, stays the single dot it should be.
 *
 * Regions are optional: called without them this behaves exactly as it did, and
 * the caption still counts countries that way.
 *
 * Countries whose name does not resolve to an anchor are reported separately so
 * the caller can still count them honestly.
 */
export function buildMapMarkers(countries:readonly CountryStat[],regions:readonly RegionStat[]=[]){
  const placed=new Map<string,MapMarker>();
  let unplaced=0;
  const byCountry=new Map<string,RegionStat[]>();
  for(const region of regions){
    if(!region.country)continue;
    const key=countryKey(region.country);
    if(!key||!countryIsSpread(region.country))continue;
    (byCountry.get(key)??byCountry.set(key,[]).get(key)!).push(region);
  }
  const put=(id:string,country:string,region:string|null,wines:number,anchor:readonly [number,number])=>{
    const existing=placed.get(id);
    if(existing){existing.wines+=wines;return}
    const {x,y}=projectPoint(anchor[0],anchor[1]);
    placed.set(id,{id,country,region,wines,x,y,radius:MIN_MARKER,anchorX:x,anchorY:y});
  };
  for(const entry of countries){
    const anchor=countryAnchor(entry.country);
    if(!anchor){unplaced+=1;continue}
    // A spread country is drawn by its regions. Where none of them resolved -
    // wines filed under the country alone - it falls back to the one dot, so a
    // journal never loses a stamp it has earned.
    const own=byCountry.get(countryKey(entry.country))??[];
    const drawn=own.filter(region=>regionAnchor(entry.country,region.region));
    if(drawn.length){
      for(const region of drawn)put(`${countryKey(entry.country)}/${normalizeCountryName(region.region)}`,
        entry.country,region.region,region.wines,regionAnchor(entry.country,region.region)!);
      continue;
    }
    put(`${anchor[0]},${anchor[1]}`,entry.country,null,entry.wines,anchor);
  }
  const markers=[...placed.values()];
  const busiest=markers.reduce((most,marker)=>Math.max(most,marker.wines),0);
  for(const marker of markers)marker.radius=busiest>0
    ?MIN_MARKER+(MAX_MARKER-MIN_MARKER)*Math.sqrt(Math.min(1,marker.wines/busiest))
    :MIN_MARKER;
  markers.sort((a,b)=>a.wines-b.wines||a.id.localeCompare(b.id));
  separate(markers);
  return {markers,unplaced};
}

function separate(markers:MapMarker[]){
  for(let pass=0;pass<SEPARATION_PASSES;pass+=1){
    let moved=false;
    for(let i=0;i<markers.length;i+=1)for(let j=i+1;j<markers.length;j+=1){
      const a=markers[i],b=markers[j];
      const needed=a.radius+b.radius+SEPARATION_GAP;
      let dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy);
      if(distance>=needed)continue;
      // Two anchors can coincide once markers have drifted; break the tie the
      // same way every render so the map does not shuffle between loads.
      if(distance<1e-6){dx=(j%2?1:-1)*.5;dy=(j%3?1:-1)*.5;distance=Math.hypot(dx,dy)}
      const push=(needed-distance)/2/distance;
      a.x-=dx*push;a.y-=dy*push;b.x+=dx*push;b.y+=dy*push;
      moved=true;
    }
    for(const marker of markers){
      const dx=marker.x-marker.anchorX,dy=marker.y-marker.anchorY,drift=Math.hypot(dx,dy);
      if(drift<=MARKER_MAX_DRIFT)continue;
      marker.x=marker.anchorX+dx/drift*MARKER_MAX_DRIFT;
      marker.y=marker.anchorY+dy/drift*MARKER_MAX_DRIFT;
    }
    if(!moved)break;
  }
}

/**
 * Split the land grid into the dots near a visited country and the rest, so the
 * two can be painted in different colours from a single path element each.
 */
export function landDotPaths(markers:readonly MapMarker[]){
  const lit:{x:number;y:number}[]=[],rest:{x:number;y:number}[]=[];
  const halo=HALO_RADIUS*HALO_RADIUS;
  for(const dot of allLandDots){
    // Light the country itself, not wherever separation pushed its marker.
    const near=markers.some(marker=>(marker.anchorX-dot.x)**2+(marker.anchorY-dot.y)**2<=halo);
    (near?lit:rest).push(dot);
  }
  return {visited:dotPath(lit,DOT_RADIUS),quiet:dotPath(rest,DOT_RADIUS)};
}

export function mapCaption(countries:readonly CountryStat[]){
  const {markers,unplaced}=buildMapMarkers(countries);
  const total=markers.length+unplaced;
  if(!total)return 'Your first stamp lands here.';
  const leader=markers.reduce<MapMarker|null>((best,marker)=>!best||marker.wines>best.wines?marker:best,null);
  const stamped=`${total} ${total===1?'country':'countries'} stamped`;
  return leader?`${stamped} · ${leader.country} leads with ${leader.wines}`:stamped;
}
