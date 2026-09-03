/**
 * The one name a grape is filed under, and the names it is also sold as.
 *
 * A journal that holds Pinot Noir, Pinot Nero and Spätburgunder holds three
 * grapes as far as every count, filter and insight is concerned, and they are
 * one grape. The canonicaliser had a twenty-entry spelling map with no
 * synonyms in it at all, so the only thing it fixed was capitalisation.
 *
 * The convention this follows is the one already in that map, which kept
 * Syrah apart from Shiraz and Pinot Gris apart from Pinot Grigio: a name that
 * a drinker uses to mean a style, rather than only a translation, keeps its
 * own entry. Grouping them would be varietally right and would erase a
 * distinction the person logging the bottle meant to make. Everything that is
 * only another language's word for the same grape is folded in.
 */
export type GrapeEntry={
  /** What it is stored and grouped as. */
  name:string;
  /** Other names for the same grape, folded into it on save. */
  also?:readonly string[];
  /** Where a reader would expect to find it, for the suggestion list's order. */
  common?:boolean;
};

export const GRAPES:readonly GrapeEntry[]=[
  // Red
  {name:'Pinot Noir',also:['Pinot Nero','Spätburgunder','Blauburgunder','Pinot Negro','Blauer Spatburgunder'],common:true},
  {name:'Cabernet Sauvignon',also:['Cab Sauv','Cabernet-Sauvignon'],common:true},
  {name:'Merlot',common:true},
  {name:'Syrah',also:['Serine'],common:true},
  {name:'Shiraz',common:true},
  {name:'Nebbiolo',also:['Spanna','Chiavennasca','Picotendro','Picoutener'],common:true},
  {name:'Sangiovese',also:['Brunello','Sangioveto','Morellino','Prugnolo Gentile','Nielluccio'],common:true},
  {name:'Tempranillo',also:['Tinto Fino','Tinta del Pais','Tinta de Toro','Cencibel','Ull de Llebre','Aragonez','Tinta Roriz'],common:true},
  {name:'Grenache',also:['Garnacha','Garnacha Tinta','Cannonau','Granaxa','Alicante'],common:true},
  {name:'Mourvèdre',also:['Monastrell','Mataro'],common:true},
  {name:'Carignan',also:['Carinena','Mazuelo','Carignano','Samso']},
  {name:'Cinsault',also:['Ottavianello']},
  {name:'Cabernet Franc',also:['Bouchet','Breton','Bouchy']},
  {name:'Petit Verdot'},
  {name:'Malbec',also:['Cot','Auxerrois','Pressac']},
  {name:'Carmenère',also:['Grande Vidure']},
  {name:'Barbera'},
  {name:'Dolcetto',also:['Ormeasco']},
  {name:'Corvina',also:['Corvina Veronese','Cruina']},
  {name:'Aglianico'},
  {name:'Montepulciano'},
  {name:'Primitivo',also:['Zinfandel','Crljenak Kastelanski','Tribidrag']},
  {name:'Touriga Nacional'},
  {name:'Blaufränkisch',also:['Lemberger','Frankovka']},
  {name:'Zweigelt',also:['Blauer Zweigelt','Rotburger']},
  {name:'St. Laurent',also:['Sankt Laurent','Saint Laurent','Svatovavrinecke']},
  {name:'Gamay',also:['Gamay Noir','Gamay Noir a Jus Blanc']},
  {name:'Pinotage'},
  {name:'Tannat'},
  {name:'Xinomavro',also:['Xynomavro']},
  {name:'Agiorgitiko',also:['St. George']},
  {name:'Saperavi'},
  {name:'Nerello Mascalese'},
  {name:'Nero d’Avola',also:["Nero d'Avola",'Calabrese']},
  {name:'Frappato'},
  {name:'Mencía',also:['Mencia','Jaen']},
  {name:'Bobal'},
  {name:'Trousseau',also:['Bastardo','Merenzao']},
  {name:'Poulsard',also:['Ploussard']},
  {name:'Mondeuse'},
  // White
  {name:'Chardonnay',also:['Morillon','Chardonnay Blanc'],common:true},
  {name:'Riesling',also:['Rheinriesling','Johannisberg Riesling','Weisser Riesling'],common:true},
  {name:'Sauvignon Blanc',also:['Sauvignon','Fume Blanc','Fumé Blanc','Blanc Fume'],common:true},
  {name:'Chenin Blanc',also:['Steen','Pineau de la Loire'],common:true},
  {name:'Pinot Gris',also:['Grauburgunder','Rulander','Ruländer','Malvoisie'],common:true},
  {name:'Pinot Grigio',common:true},
  {name:'Pinot Blanc',also:['Pinot Bianco','Weissburgunder','Klevner']},
  {name:'Gewürztraminer',also:['Traminer Aromatico','Traminer']},
  {name:'Grüner Veltliner',also:['Weissgipfler']},
  {name:'Viognier'},
  {name:'Marsanne'},
  {name:'Roussanne',also:['Bergeron']},
  {name:'Sémillon',also:['Semillon']},
  {name:'Muscadet',also:['Melon de Bourgogne','Melon B']},
  {name:'Albariño',also:['Alvarinho']},
  {name:'Verdejo'},
  {name:'Godello'},
  {name:'Viura',also:['Macabeo','Maccabeu']},
  {name:'Garnacha Blanca',also:['Grenache Blanc']},
  {name:'Vermentino',also:['Rolle','Favorita','Pigato']},
  {name:'Garganega'},
  {name:'Glera',also:['Prosecco']},
  {name:'Cortese'},
  {name:'Arneis'},
  {name:'Fiano'},
  {name:'Greco',also:['Greco di Tufo']},
  {name:'Falanghina'},
  {name:'Verdicchio',also:['Trebbiano di Soave']},
  {name:'Trebbiano',also:['Ugni Blanc','Trebbiano Toscano']},
  {name:'Assyrtiko'},
  {name:'Furmint'},
  {name:'Silvaner',also:['Sylvaner','Gruner Silvaner']},
  {name:'Müller-Thurgau',also:['Rivaner']},
  {name:'Torrontés',also:['Torrontes']},
  {name:'Colombard',also:['French Colombard']},
  {name:'Palomino',also:['Listan Blanco','Palomino Fino']},
  {name:'Pedro Ximénez',also:['PX']},
  {name:'Moscatel',also:['Muscat','Moscato','Muscat Blanc a Petits Grains','Muskateller']},
  {name:'Aligoté',also:['Aligote']},
  {name:'Savagnin',also:['Traminer Blanc','Naturé']}
];

const key=(value:string)=>value.normalize('NFD').replace(/[̀-ͯ]/g,'')
  .toLowerCase().replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

/** Normalised name -> the grape it is counted as. */
const byKey=new Map<string,string>();
/** Normalised name -> how the table spells that same name, accents and all. */
const spellings=new Map<string,string>();
for(const entry of GRAPES){
  byKey.set(key(entry.name),entry.name);
  spellings.set(key(entry.name),entry.name);
  for(const alias of entry.also??[]){
    byKey.set(key(alias),entry.name);
    // An alias that differs from the canonical name only by a hyphen or an
    // accent normalises to the same key, and must not take the spelling over:
    // "Cabernet-Sauvignon" is listed so it matches, not so it replaces.
    if(!spellings.has(key(alias)))spellings.set(key(alias),alias);
  }
}

/**
 * The name this grape is grouped under. **Not** what to show.
 *
 * Only counting uses this. A bottle that says Pinot Nero says Pinot Nero, and
 * the app has no business rewriting the label - but a journal that counts it
 * apart from its Pinot Noir is counting one vine twice, which is what every
 * total, filter and insight was doing. So the stored value stays as the label
 * read it and this is the key the statistics fold on.
 */
export function canonicalGrapeName(value:string|null|undefined){
  const text=(value??'').trim();
  if(!text)return text;
  return byKey.get(key(text))??text;
}

/**
 * The same name, spelled the way the table spells it.
 *
 * This is what gets stored: "pinot nero" becomes "Pinot Nero" and
 * "spatburgunder" becomes "Spätburgunder" - the accent and the capitals the
 * label has, and not one letter more. A grape the table does not know is kept
 * exactly as typed.
 */
export function displayGrapeName(value:string|null|undefined){
  const text=(value??'').trim();
  if(!text)return text;
  return spellings.get(key(text))??text;
}

/**
 * Every name this grape answers to, for a filter that has to match what is
 * actually stored. Asking the journal for Pinot Noir has to return the bottle
 * filed as Pinot Nero, or the count on the insight and the list behind it
 * disagree.
 */
export function grapeGroup(value:string|null|undefined){
  const canonical=canonicalGrapeName(value);
  const entry=GRAPES.find(item=>item.name===canonical);
  return entry?[entry.name,...entry.also??[]]:canonical?[canonical]:[];
}

/** Whether the table has an opinion about this name at all. */
export const knownGrape=(value:string)=>byKey.has(key(value));

/**
 * Names to offer for a half-typed grape, canonical only.
 *
 * Aliases are matched but never offered: typing "spat" should suggest Pinot
 * Noir, because that is what pressing it will store, and offering
 * "Spätburgunder" as a choice that silently becomes something else is worse
 * than offering nothing. A name that starts with what was typed comes before
 * one that merely contains it, and the grapes most journals are full of come
 * before the rest.
 */
export function grapeSuggestions(typed:string,limit=6){
  const needle=key(typed);
  if(needle.length<2)return [];
  const scored:Array<{name:string;rank:number}>=[];
  for(const entry of GRAPES){
    const names=[entry.name,...entry.also??[]].map(key);
    let rank=Number.POSITIVE_INFINITY;
    for(const name of names){
      if(name===needle)rank=Math.min(rank,0);
      else if(name.startsWith(needle))rank=Math.min(rank,1);
      else if(name.includes(needle))rank=Math.min(rank,2);
    }
    if(rank===Number.POSITIVE_INFINITY)continue;
    scored.push({name:entry.name,rank:rank*2+(entry.common?0:1)});
  }
  return scored.sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name)).slice(0,limit).map(entry=>entry.name);
}
