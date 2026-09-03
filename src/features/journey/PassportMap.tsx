import { useMemo } from 'react';
import type { CountryStat,RegionStat } from './api';
import { buildMapMarkers,landDotPaths,mapCaption,MAP_HEIGHT,MAP_WIDTH } from './worldMap';

/**
 * The Passport world map. Land is a dot matrix rasterised from Natural Earth at
 * four degrees per cell; the dots near a place the journal knows about are lit,
 * and each carries a marker sized by how much of the journal comes from it.
 *
 * Most countries are one marker. The ones whose regions are too far apart for a
 * single dot to stand for them get one per region - so a Willamette Valley
 * stops reporting as California and a Margaret River stops reporting as
 * Barossa. The caption still counts countries, because that is what a passport
 * counts.
 */
export function PassportMap({countries,regions=[]}:{countries:readonly CountryStat[];regions?:readonly RegionStat[]}){
  const markers=useMemo(()=>buildMapMarkers(countries,regions).markers,[countries,regions]);
  const dots=useMemo(()=>landDotPaths(markers),[markers]);
  const caption=useMemo(()=>mapCaption(countries),[countries]);
  const label=markers.length
    ?`World map. ${caption}.`
    :'World map. No countries stamped yet.';

  return <figure className="passport-map">
    <svg className="passport-world-map" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label={label}>
      <path className="passport-map-quiet" d={dots.quiet}/>
      <path className="passport-map-visited" d={dots.visited}/>
      <g className="passport-map-pins">{markers.map(marker=><g key={marker.id} transform={`translate(${marker.x.toFixed(2)} ${marker.y.toFixed(2)})`}>
        <circle className="passport-map-pin-glow" r={(marker.radius*2.1).toFixed(2)}/>
        <circle className="passport-map-pin-ring" r={marker.radius.toFixed(2)}/>
        <circle className="passport-map-pin-core" r={(marker.radius*.44).toFixed(2)}/>
      </g>)}</g>
    </svg>
    <figcaption className="passport-map-caption">{caption}</figcaption>
  </figure>;
}
