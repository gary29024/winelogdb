import type { CountryStat } from './api';
import { COUNTRY_ALIASES,COUNTRY_ANCHORS,LAND_MASK,MAP_CELL,MAP_COLUMNS,MAP_LAT_BOTTOM,MAP_LAT_TOP } from './worldMapData';

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

export type MapMarker={country:string;wines:number;x:number;y:number;radius:number;anchorX:number;anchorY:number};

export function normalizeCountryName(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

export function countryAnchor(country:string):readonly [number,number]|null{
  const key=normalizeCountryName(country);
  if(!key)return null;
  return COUNTRY_ANCHORS[key]??COUNTRY_ANCHORS[COUNTRY_ALIASES[key]??'']??null;
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
 * Place one marker per country the journal knows about, largest last so the
 * busiest countries paint over their neighbours rather than under them.
 * Countries whose name does not resolve to an anchor are reported separately so
 * the caller can still count them honestly.
 */
export function buildMapMarkers(countries:readonly CountryStat[]){
  const placed=new Map<string,MapMarker>();
  let unplaced=0;
  for(const entry of countries){
    const anchor=countryAnchor(entry.country);
    if(!anchor){unplaced+=1;continue}
    const key=`${anchor[0]},${anchor[1]}`,existing=placed.get(key);
    if(existing){existing.wines+=entry.wines;continue}
    const {x,y}=projectPoint(anchor[0],anchor[1]);
    placed.set(key,{country:entry.country,wines:entry.wines,x,y,radius:MIN_MARKER,anchorX:x,anchorY:y});
  }
  const markers=[...placed.values()];
  const busiest=markers.reduce((most,marker)=>Math.max(most,marker.wines),0);
  for(const marker of markers)marker.radius=busiest>0
    ?MIN_MARKER+(MAX_MARKER-MIN_MARKER)*Math.sqrt(Math.min(1,marker.wines/busiest))
    :MIN_MARKER;
  markers.sort((a,b)=>a.wines-b.wines||a.country.localeCompare(b.country));
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
