const namedGrapeColors:Record<string,string>={
  chardonnay:'#e1bd45',
  'pinot noir':'#a8172d',
  'cabernet sauvignon':'#5b1621',
  merlot:'#563080',
  'cabernet franc':'#724060',
  syrah:'#4b2038',
  shiraz:'#4b2038',
  grenache:'#9f3b49',
  sangiovese:'#9d3437',
  nebbiolo:'#8d3238',
  tempranillo:'#6e2633',
  gamay:'#b03a57',
  zinfandel:'#7b263d',
  malbec:'#54233f',
  'sauvignon blanc':'#91a94f',
  riesling:'#d2b94f',
  'chenin blanc':'#c8b34b',
  semillon:'#c5b55a',
  viognier:'#d7aa51',
  'pinot gris':'#aaa25a',
  'pinot grigio':'#aaa25a',
  albarino:'#9fad5a',
  'gruner veltliner':'#87a04e'
};

const fallbackGrapeColors=['#8f3448','#c5a744','#5b2738','#6c4b87','#827151','#486f62'];

export type WineStyleColorKey='red'|'white'|'sparkling'|'dessert'|'rose'|'orange'|'fortified'|'other';

const namedStyleColors:Record<string,WineStyleColorKey>={
  red:'red',white:'white',sparkling:'sparkling',dessert:'dessert',rose:'rose',
  orange:'orange',fortified:'fortified',other:'other'
};

export function normalizeGrapeName(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

export function grapeColorFor(grape:string){
  const normalized=normalizeGrapeName(grape),named=namedGrapeColors[normalized];
  if(named)return named;
  let hash=0;for(const char of normalized)hash=(hash*31+char.charCodeAt(0))>>>0;
  return fallbackGrapeColors[hash%fallbackGrapeColors.length];
}

export function styleColorKeyFor(style:string):WineStyleColorKey{
  return namedStyleColors[normalizeGrapeName(style)]??'other';
}
