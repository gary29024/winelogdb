/**
 * A wine place tree, used to decide which of `region` and `appellation` a name
 * belongs in rather than trusting whichever slot recognition happened to pick.
 *
 * Old World labels carry a convention strong enough that a model is consistent
 * about them. New World appellations nest three or four deep - California ›
 * Napa Valley › Oakville - with no convention about which two levels to emit,
 * so the same wine comes back as region "Napa Valley" / appellation "Oakville"
 * one day and region "California" / appellation "Napa Valley" the next.
 *
 * Tiers, broadest first. Only `region` ever fills the region column; anything
 * below it fills appellation. `area` exists so that "California" and "South
 * Australia" resolve to something without being mistaken for growing regions,
 * and `subregion` so that "Côte de Nuits" keeps Burgundy in the region column
 * the way the journal already records it.
 */
export type PlaceTier='country'|'area'|'region'|'subregion'|'appellation';

/**
 * Where an appellation sits in a classified hierarchy, when its country has one.
 * A grand cru is an appellation in its own right, so the tree carries it; the
 * premier cru tier is never a separate appellation and is read off the label
 * text instead. Left undefined wherever there is no such system to report.
 */
/**
 * A cru tier a place holds in its own right. "premier_cru" is here for the one
 * shape that breaks the usual rule - Chablis Premier Cru is itself an AOC,
 * where everywhere else in Burgundy a premier cru is a climat inside a village
 * appellation and has to be read off the label instead.
 */
export type PlaceClassification='grand_cru'|'premier_cru'|'village';

/**
 * The denomination an appellation holds - DOCG, AOC, AVA. Unlike the cru tier
 * this is a fact about the place rather than the bottle: every Chianti Classico
 * is DOCG, so it belongs here and not on the wine.
 *
 * Inherited down the tree, so a country sets the common case once and only the
 * exceptions are named. Italy is the exception that matters: DOCG and DOC sit
 * side by side, so its DOCGs are listed one by one and everything else falls
 * back to DOC - erring toward the lesser claim where memory is uncertain.
 */
export type PlaceNode={
  id:string;
  name:string;
  tier:PlaceTier;
  parent:string|null;
  aliases:readonly string[];
  classification?:PlaceClassification;
  denomination?:string;
  /**
   * Whether the label must spell the denomination out for this node to match.
   *
   * Italy's broad IGT zones are named after the region they cover, and the tree
   * can only hold one meaning per name: "Toscana" the administrative region and
   * "Toscana" the IGT zone are different places. The label is what separates
   * them, so these nodes answer to "Toscana IGT" and leave the bare name to the
   * region. Zones with a name of their own - Terre Siciliane, Salento - need no
   * such marker and match either way.
   */
  denominationRequired?:boolean;
  /**
   * The shallowest tier a country's denomination reaches. New World schemes are
   * the whole map below the state tier - every AVA, GI and WO is one, at
   * whatever depth the tree files it - while Old World defaults stop at the
   * appellation, because Burgundy and Tuscany are administrative rather than
   * legal names.
   */
  denominationFrom?:PlaceTier;
};

type Draft={name:string;tier:PlaceTier;aliases:readonly string[];children:readonly Draft[];classification?:PlaceClassification;denomination?:string;denominationRequired?:boolean;denominationFrom?:PlaceTier};

const node=(tier:PlaceTier)=>(name:string,aliases:readonly string[]=[],children:readonly Draft[]=[]):Draft=>
  ({name,tier,aliases,children});

const country=node('country'),area=node('area'),region=node('region'),sub=node('subregion'),appellation=node('appellation');

/** Shorthand for a run of appellations that carry no aliases of their own. */
const appellations=(...names:string[]):Draft[]=>names.map(name=>appellation(name));
const classified=(classification:PlaceClassification)=>(...names:string[]):Draft[]=>
  names.map(name=>({...appellation(name),classification}));
const grandCrus=classified('grand_cru'),premierCrus=classified('premier_cru'),villages=classified('village');
/** Appellations that hold a denomination other than the one they inherit. */
const denominated=(denomination:string)=>(...names:string[]):Draft[]=>
  names.map(name=>({...appellation(name),denomination}));
const docg=denominated('DOCG');
/**
 * A geographic-indication zone: IGT in Italy, IGP in France. These are real
 * appellations that the country default cannot express - Italy's default is DOC
 * and France's AOC - so every one a wine might carry has to be named. Where the
 * zone shares its name with the region it covers, the label's marker is what
 * picks it out, so the bare name is left to the region.
 */
const geographic=(denomination:string)=>(...names:string[]):Draft[]=>
  names.map(name=>({...appellation(name,[`${name} ${denomination}`]),denomination}));
const geographicRegionwide=(denomination:string)=>(...names:string[]):Draft[]=>
  names.map(name=>({...appellation(name,[`${name} ${denomination}`]),denomination,denominationRequired:true}));
const igt=geographic('IGT'),igtRegion=geographicRegionwide('IGT');
const igp=geographic('IGP');
const denominatedCountry=(denomination:string)=>(name:string,aliases:readonly string[]=[],children:readonly Draft[]=[]):Draft=>
  ({...country(name,aliases,children),denomination});
/**
 * A region that is itself a denomination rather than an administrative area.
 * Marking matters here because a region never inherits its country's default:
 * Rioja and Ribera del Duero are DOs, while Catalonia and Castilla y León are
 * only where several of them happen to sit.
 */
const denominatedRegion=(denomination:string)=>(name:string,aliases:readonly string[]=[],children:readonly Draft[]=[]):Draft=>
  ({...region(name,aliases,children),denomination});
const doRegion=denominatedRegion('DO'),docRegion=denominatedRegion('DOC'),aocRegion=denominatedRegion('AOC');
/**
 * A multi-region IGP that is itself the denomination, in the same shape as
 * Rioja or Priorat: nothing administrative shares its name, so the bare name
 * resolves and carries IGP without the label having to spell it out.
 */
const igpRegionwide=denominatedRegion('IGP');
/** A country whose denomination covers every named place below the state tier. */
const regionwideCountry=(denomination:string)=>(name:string,aliases:readonly string[]=[],children:readonly Draft[]=[]):Draft=>
  ({...denominatedCountry(denomination)(name,aliases,children),denominationFrom:'region'});

const tree:readonly Draft[]=[
  regionwideCountry('AVA')('United States',['USA','U.S.A.','US','United States of America','America'],[
    area('California',[],[
      area('North Coast',[],[
        region('Napa Valley',['Napa'],appellations(
          'Oakville','Rutherford','St. Helena','Stags Leap District','Yountville','Calistoga',
          'Howell Mountain','Spring Mountain District','Mount Veeder','Diamond Mountain District',
          'Atlas Peak','Coombsville','Oak Knoll District','Chiles Valley','Wild Horse Valley'
        ).concat(appellation('Los Carneros',['Carneros','Napa Carneros']))),
        region('Sonoma County',['Sonoma'],appellations(
          'Russian River Valley','Sonoma Coast','Alexander Valley','Dry Creek Valley','Chalk Hill',
          'Knights Valley','Bennett Valley','Sonoma Valley','Fort Ross-Seaview','Petaluma Gap',
          'Moon Mountain District','Rockpile','Green Valley of Russian River Valley','Sonoma Mountain'
        )),
        region('Mendocino County',['Mendocino'],appellations('Anderson Valley','Yorkville Highlands','Potter Valley')),
        region('Lake County',[],appellations('Red Hills Lake County','Guenoc Valley'))
      ]),
      area('Central Coast',[],[
        region('Santa Barbara County',['Santa Barbara'],appellations(
          'Sta. Rita Hills','Santa Maria Valley','Ballard Canyon','Happy Canyon of Santa Barbara',
          'Los Olivos District','Santa Ynez Valley','Alisos Canyon'
        )),
        region('Monterey County',['Monterey'],appellations('Santa Lucia Highlands','Arroyo Seco','Chalone','Carmel Valley')),
        region('San Luis Obispo County',['San Luis Obispo'],appellations(
          'Paso Robles','Edna Valley','Arroyo Grande Valley','Willow Creek District','Adelaida District','Templeton Gap District'
        )),
        region('Santa Cruz Mountains',[],[]),
        region('Ballard Canyon',[],[])
      ]),
      region('Sierra Foothills',[],appellations('El Dorado','Amador County','Fiddletown','Fair Play','Shenandoah Valley')),
      region('Lodi',[],[]),
      region('Livermore Valley',[],[]),
      region('Napa-Sonoma',[],[])
    ]),
    area('Oregon',[],[
      region('Willamette Valley',[],appellations(
        'Dundee Hills','Eola-Amity Hills','Yamhill-Carlton','Ribbon Ridge','Chehalem Mountains',
        'McMinnville','Laurelwood District','Van Duzer Corridor','Tualatin Hills','Lower Long Tom'
      )),
      region('Southern Oregon',[],appellations('Umpqua Valley','Rogue Valley','Applegate Valley','Elkton Oregon'))
    ]),
    area('Washington',['Washington State'],[
      region('Columbia Valley',[],appellations(
        'Walla Walla Valley','Yakima Valley','Red Mountain','Horse Heaven Hills','Wahluke Slope',
        'Rattlesnake Hills','Royal Slope','Candy Mountain','The Rocks District of Milton-Freewater'
      )),
      region('Puget Sound',[],[])
    ]),
    area('New York',['New York State'],[
      region('Finger Lakes',[],appellations('Seneca Lake','Cayuga Lake','Keuka Lake')),
      region('Long Island',[],appellations('North Fork of Long Island','The Hamptons'))
    ]),
    area('Virginia',[],[region('Monticello',[],[])]),
    area('Texas',[],[region('Texas Hill Country',[],[])])
  ]),

  denominatedCountry('AOC')('France',[],[
    region('Burgundy',['Bourgogne'],[
      sub('Côte de Nuits',[],[
        ...villages('Gevrey-Chambertin','Morey-Saint-Denis','Chambolle-Musigny','Vougeot','Vosne-Romanée',
          'Nuits-Saint-Georges','Fixin','Marsannay','Côte de Nuits-Villages'),
        // Grand crus are standalone AOCs, so they are siblings of the villages
        // rather than children: a Charmes-Chambertin is not a Gevrey-Chambertin.
        ...grandCrus('Chambertin','Chambertin-Clos de Bèze','Charmes-Chambertin','Mazoyères-Chambertin',
          'Griotte-Chambertin','Chapelle-Chambertin','Latricières-Chambertin','Mazis-Chambertin',
          'Ruchottes-Chambertin','Clos de la Roche','Clos Saint-Denis','Clos des Lambrays',
          'Clos de Tart','Bonnes-Mares','Musigny','Clos de Vougeot','Échezeaux','Grands Échezeaux',
          'Romanée-Conti','La Tâche','Richebourg','Romanée-Saint-Vivant','La Romanée','La Grande Rue')
      ]),
      // Like Chablis, both a subregion and a village AOC in its own right - the
      // small one on the hill above Beaune. Only a wine whose appellation field
      // names it reads as a village; villageIfCertain already withholds the tier
      // where the name came from the region field instead.
      {...sub('Côte de Beaune',[],[
        ...villages('Aloxe-Corton','Pernand-Vergelesses','Savigny-lès-Beaune','Beaune','Pommard','Volnay',
          'Meursault','Puligny-Montrachet','Chassagne-Montrachet','Saint-Aubin','Santenay',
          'Auxey-Duresses','Monthélie','Saint-Romain','Ladoix','Chorey-lès-Beaune','Côte de Beaune-Villages'),
        ...grandCrus('Corton','Corton-Charlemagne','Charlemagne','Montrachet','Chevalier-Montrachet',
          'Bâtard-Montrachet','Bienvenues-Bâtard-Montrachet','Criots-Bâtard-Montrachet')
      ]),classification:'village' as const,denomination:'AOC'},
      sub('Côte Chalonnaise',[],villages('Mercurey','Givry','Rully','Montagny','Bouzeron')),
      // Mâcon-Villages is a regional appellation despite the name, so it is not
      // one of the village AOCs beside it.
      sub('Mâconnais',[],[...villages('Pouilly-Fuissé','Saint-Véran','Viré-Clessé'),
        appellation('Mâcon-Villages'),appellation('Mâcon',['Macon'])]),
      // Chablis is both a subregion holding its own pyramid and the village AOC
      // at the middle of it. The tier says container, so the village reading and
      // the AOC are stated here rather than inherited: a denomination only
      // reaches the appellation tier, and Chablis sits one above it.
      {...sub('Chablis',[],[appellation('Petit Chablis'),...premierCrus('Chablis Premier Cru'),...grandCrus('Chablis Grand Cru')]),
        classification:'village' as const,denomination:'AOC'},
      // Village AOCs of the Grand Auxerrois, which has no subregion of its own
      // here - they sit beside Chablis rather than inside it.
      ...villages('Irancy','Saint-Bris'),
      // Regional appellations: Burgundy's base tier, and deliberately unclassified.
      // They are AOCs, so they say so, but a Hautes Côtes is not a village and
      // counting it as one would inflate the cru mix on Insights.
      appellation('Bourgogne Rouge'),appellation('Bourgogne Blanc'),appellation('Bourgogne Aligoté'),
      appellation('Bourgogne Hautes Côtes de Nuits',['Hautes Côtes de Nuits']),
      appellation('Bourgogne Hautes Côtes de Beaune',['Hautes Côtes de Beaune']),
      appellation('Bourgogne Côte Chalonnaise'),appellation('Bourgogne Côte d’Or',['Bourgogne Cote d\'Or']),
      appellation('Bourgogne Passe-Tout-Grains'),appellation('Bourgogne Vézelay',['Vézelay']),
      appellation('Coteaux Bourguignons'),appellation('Crémant de Bourgogne')
    ]),
    region('Bordeaux',[],[
      sub('Médoc',[],appellations('Margaux','Pauillac','Saint-Julien','Saint-Estèphe','Haut-Médoc','Listrac-Médoc','Moulis-en-Médoc')),
      sub('Graves',[],appellations('Pessac-Léognan','Sauternes','Barsac','Cérons')),
      sub('Right Bank',[],appellations('Saint-Émilion','Saint-Émilion Grand Cru','Pomerol','Fronsac','Lalande-de-Pomerol','Castillon Côtes de Bordeaux')),
      appellation('Entre-Deux-Mers')
    ]),
    // Champagne, Alsace and Beaujolais are each a single appellation covering
    // the whole region they name, in the same shape as Rioja - unlike Burgundy
    // or Tuscany, which are collective names holding many appellations. Without
    // marking them the country default stops above the region tier, so a wine
    // recorded as "Champagne" showed no denomination while the same wine
    // recorded under its village showed AOC.
    aocRegion('Champagne',[],appellations('Montagne de Reims','Côte des Blancs','Vallée de la Marne','Côte des Bar','Aÿ','Cramant','Le Mesnil-sur-Oger')),
    region('Rhône',['Rhone','Rhône Valley','Rhone Valley'],[
      sub('Northern Rhône',['Northern Rhone'],appellations('Côte-Rôtie','Hermitage','Crozes-Hermitage','Cornas','Saint-Joseph','Condrieu','Château-Grillet','Saint-Péray')),
      sub('Southern Rhône',['Southern Rhone'],appellations('Châteauneuf-du-Pape','Gigondas','Vacqueyras','Rasteau','Lirac','Tavel','Vinsobres','Cairanne','Côtes du Rhône','Côtes du Rhône Villages'))
    ]),
    region('Loire',['Loire Valley'],appellations(
      'Sancerre','Pouilly-Fumé','Vouvray','Chinon','Bourgueil','Saumur-Champigny','Savennières',
      'Muscadet Sèvre et Maine','Anjou','Quincy','Menetou-Salon','Coteaux du Layon','Saumur'
    )),
    aocRegion('Alsace',[],grandCrus('Alsace Grand Cru')),
    aocRegion('Beaujolais',[],appellations('Morgon','Fleurie','Moulin-à-Vent','Brouilly','Côte de Brouilly','Juliénas','Chénas','Chiroubles','Régnié','Saint-Amour','Beaujolais-Villages')),
    region('Languedoc',['Languedoc-Roussillon'],appellations('Corbières','Minervois','Faugères','Pic Saint-Loup','Saint-Chinian','Fitou','Picpoul de Pinet')),
    region('Roussillon',[],appellations('Côtes du Roussillon','Collioure','Banyuls','Maury')),
    region('Provence',[],appellations('Bandol','Côtes de Provence','Cassis','Palette','Coteaux d’Aix-en-Provence')),
    region('Jura',[],appellations('Arbois','Château-Chalon','Côtes du Jura','L’Étoile')),
    region('Savoie',[],[]),
    region('South West France',['Sud-Ouest'],[
      ...appellations('Cahors','Madiran','Jurançon','Bergerac','Irouléguy'),
      ...igp('Comté Tolosan','Côtes de Gascogne','Périgord','Landes','Aveyron')
    ]),
    region('Corsica',['Corse'],igp('Île de Beauté')),
    // France's regional IGPs cover several administrative regions each, so they
    // sit beside them rather than inside one. Pays d'Oc alone is a tenth of the
    // country's output and was previously unresolvable.
    igpRegionwide('Pays d’Oc',['Oc']),
    igpRegionwide('Méditerranée'),
    igpRegionwide('Val de Loire'),
    igpRegionwide('Atlantique'),
    igpRegionwide('Comtés Rhodaniens')
  ]),

  // Italy names its DOCGs and its IGTs one by one; everything between them
  // inherits DOC. A zone that spans regions - Delle Venezie, Vigneti delle
  // Dolomiti - is filed once, under the region it is most often labelled from,
  // because one name may mean only one place in the tree.
  denominatedCountry('DOC')('Italy',[],[
    // Piedmont registers no IGT at all: every wine it makes is DOC or DOCG.
    region('Piedmont',['Piemonte'],[
      ...docg('Barolo','Barbaresco','Barbera d’Asti','Roero','Gattinara','Ghemme','Moscato d’Asti','Alta Langa'),
      ...appellations('Barbera d’Alba','Dolcetto d’Alba','Langhe','Nebbiolo d’Alba')
    ]),
    region('Tuscany',['Toscana'],[
      ...docg('Brunello di Montalcino','Chianti Classico','Chianti','Vino Nobile di Montepulciano','Carmignano'),
      ...appellations('Bolgheri','Bolgheri Sassicaia','Maremma Toscana','Rosso di Montalcino','Montecucco'),
      ...igtRegion('Toscana'),
      ...igt('Alta Valle della Greve','Colli della Toscana Centrale','Costa Toscana','Montecastelli','Val di Magra')
    ]),
    region('Veneto',[],[
      ...docg('Amarone della Valpolicella','Recioto della Valpolicella'),
      ...appellations('Valpolicella','Soave','Bardolino','Prosecco','Valpolicella Ripasso'),
      ...igtRegion('Veneto'),
      ...igt('Colli Trevigiani','Conselvano','Marca Trevigiana','Provincia di Verona','Veneto Orientale'),
      // Delle Venezie and Alto Livenza run into Friuli and Trentino as well.
      // Filing a shared zone fixes the region it reports, so each sits under
      // the one it is most often labelled from rather than the one it touches
      // first alphabetically.
      ...igt('Delle Venezie','Alto Livenza')
    ]),
    region('Friuli-Venezia Giulia',['Friuli'],[
      ...appellations('Collio','Colli Orientali del Friuli','Carso','Isonzo'),
      ...igt('Venezia Giulia')
    ]),
    region('Trentino-Alto Adige',['Alto Adige','Südtirol','Trentino'],
      igt('Mitterberg','Vallagarina','Vigneti delle Dolomiti')),
    region('Lombardy',['Lombardia'],[
      ...docg('Franciacorta'),...appellations('Valtellina','Oltrepò Pavese'),
      ...igt('Alto Mincio','Benaco Bresciano','Bergamasca','Collina del Milanese','Montenetto di Brescia',
        'Provincia di Mantova','Provincia di Pavia','Quistello','Ronchi di Brescia','Ronchi Varesini',
        'Sabbioneta','Sebino','Terrazze Retiche di Sondrio','Terre Lariane','Valcamonica')
    ]),
    region('Sicily',['Sicilia'],[
      ...docg('Cerasuolo di Vittoria'),...appellations('Etna','Vittoria','Noto'),
      ...igt('Avola','Camarro','Fontanarossa di Cerda','Salemi','Salina','Terre Siciliane','Valle Belice')
    ]),
    region('Campania',[],[
      ...docg('Taurasi','Fiano di Avellino','Greco di Tufo','Aglianico del Taburno'),
      ...igtRegion('Campania'),
      ...igt('Beneventano','Catalanesca del Monte Somma','Colli di Salerno','Dugenta','Epomeo',
        'Paestum','Pompeiano','Roccamonfina','Terre del Volturno')
    ]),
    region('Abruzzo',[],[
      ...appellations('Montepulciano d’Abruzzo','Trebbiano d’Abruzzo'),
      ...igt('Colli Aprutini','Colline Frentane','Colline Pescaresi','Colline Teatine','Del Vastese',
        'Terre Aquilane','Terre di Chieti')
    ]),
    region('Marche',[],[
      ...docg('Conero'),...appellations('Verdicchio dei Castelli di Jesi','Verdicchio di Matelica'),
      ...igtRegion('Marche')
    ]),
    region('Umbria',[],[
      ...docg('Montefalco Sagrantino'),...appellations('Orvieto'),
      ...igtRegion('Umbria'),
      ...igt('Allerona','Bettona','Cannara','Narni','Spello')
    ]),
    region('Puglia',['Apulia'],[
      ...appellations('Primitivo di Manduria','Salice Salentino','Castel del Monte'),
      ...igtRegion('Puglia'),
      ...igt('Daunia','Murgia','Salento','Tarantino','Valle d’Itria')
    ]),
    region('Sardinia',['Sardegna'],[
      ...docg('Vermentino di Gallura'),...appellations('Cannonau di Sardegna'),
      ...igt('Barbagia','Colli del Limbara','Isola dei Nuraghi','Marmilla','Nurra','Ogliastra','Parteolla',
        'Planargia','Provincia di Nuoro','Romangia','Sibiola','Tharros','Trexenta','Valle del Tirso',
        'Valli di Porto Pino')
    ]),
    region('Emilia-Romagna',[],[
      ...appellations('Lambrusco di Sorbara','Colli Bolognesi','Romagna'),
      ...igt('Bianco di Castelfranco Emilia','Emilia','Forlì','Fortana del Taro','Modena','Ravenna',
        'Rubicone','Sillaro','Terre di Veleja','Val Tidone')
    ]),
    region('Lazio',[],[
      ...appellations('Frascati','Cesanese del Piglio','Est! Est!! Est!!! di Montefiascone'),
      ...igtRegion('Lazio'),
      ...igt('Civitella d’Agliano','Colli Cimini','Costa Etrusco Romana','Frusinate')
    ]),
    region('Calabria',[],[
      ...appellations('Cirò','Savuto'),
      ...igtRegion('Calabria'),
      ...igt('Arghillà','Costa Viola','Esaro','Lipuda','Locride','Palizzi','Pellaro','Scilla',
        'Val di Neto','Valdamato','Valle dei Crati')
    ]),
    region('Basilicata',[],[...appellations('Aglianico del Vulture'),...igtRegion('Basilicata')]),
    region('Liguria',[],[
      ...appellations('Cinque Terre','Rossese di Dolceacqua','Colli di Luni'),
      ...igt('Colline Savonesi','Golfo dei Poeti La Spezia','Liguria di Levante','Terrazze dell’Imperiese')
    ]),
    region('Molise',[],[...appellations('Biferno'),...igt('Osco','Rotae')]),
    // Valle d'Aosta registers no IGT either; its one DOC covers the whole region.
    region('Valle d’Aosta',['Vallée d’Aoste'],appellations('Valle d’Aosta'))
  ]),

  denominatedCountry('DO')('Spain',['España'],[
    denominatedRegion('DOCa')('Rioja',[],appellations('Rioja Alta','Rioja Alavesa','Rioja Oriental','Rioja Baja')),
    doRegion('Ribera del Duero'),
    denominatedRegion('DOQ')('Priorat',['Priorato']),
    doRegion('Rías Baixas',['Rias Baixas']),
    region('Catalonia',['Catalunya','Cataluña'],appellations('Penedès','Montsant','Cava','Costers del Segre','Empordà','Terra Alta')),
    doRegion('Jerez',['Sherry','Jerez-Xérès-Sherry']),
    region('Castilla y León',[],appellations('Toro','Rueda','Bierzo','Cigales')),
    doRegion('Navarra'),
    region('Galicia',[],appellations('Ribeira Sacra','Valdeorras','Ribeiro','Monterrei')),
    region('Andalusia',['Andalucía'],appellations('Montilla-Moriles','Málaga'))
  ]),

  denominatedCountry('DOC')('Portugal',[],[
    docRegion('Douro',[],appellations('Port','Douro Superior','Cima Corgo','Baixo Corgo')),
    docRegion('Dão',['Dao']),
    docRegion('Bairrada'),
    docRegion('Alentejo'),
    docRegion('Vinho Verde',[],appellations('Monção e Melgaço')),
    region('Lisboa',['Estremadura'],appellations('Colares','Bucelas')),
    region('Setúbal',[],[]),
    region('Madeira',[],[])
  ]),

  country('Germany',['Deutschland'],[
    region('Mosel',['Mosel-Saar-Ruwer'],appellations('Saar','Ruwer','Bernkastel','Piesport','Ürzig','Wehlen','Erden','Graach')),
    region('Rheingau',[],appellations('Rüdesheim','Johannisberg','Erbach','Hochheim')),
    region('Rheinhessen',[],appellations('Nierstein','Nackenheim','Westhofen')),
    region('Pfalz',[],appellations('Forst','Deidesheim','Ruppertsberg','Wachenheim')),
    region('Nahe',[],[]),region('Baden',[],[]),region('Württemberg',[],[]),
    region('Franken',['Franconia'],[]),region('Ahr',[],[]),region('Saale-Unstrut',[],[])
  ]),

  denominatedCountry('DAC')('Austria',['Österreich'],[
    region('Wachau',[],[]),region('Kamptal',[],[]),region('Kremstal',[],[]),
    region('Burgenland',[],appellations('Neusiedlersee','Leithaberg','Eisenberg','Mittelburgenland')),
    region('Weinviertel',[],[]),region('Thermenregion',[],[]),region('Steiermark',['Styria'],[]),
    region('Wien',['Vienna'],[]),region('Traisental',[],[]),region('Carnuntum',[],[])
  ]),

  regionwideCountry('GI')('Australia',[],[
    area('South Australia',[],[
      region('Barossa Valley',['Barossa'],[]),region('Eden Valley',[],[]),region('McLaren Vale',[],[]),
      region('Clare Valley',[],[]),region('Coonawarra',[],[]),region('Adelaide Hills',[],[]),
      region('Padthaway',[],[]),region('Wrattonbully',[],[]),region('Langhorne Creek',[],[])
    ]),
    area('Victoria',[],[
      region('Yarra Valley',[],[]),region('Mornington Peninsula',[],[]),region('Heathcote',[],[]),
      region('Rutherglen',[],[]),region('Geelong',[],[]),region('Grampians',[],[]),region('Beechworth',[],[])
    ]),
    area('New South Wales',[],[region('Hunter Valley',['Hunter'],[]),region('Orange',[],[]),region('Mudgee',[],[]),region('Canberra District',[],[])]),
    area('Western Australia',[],[region('Margaret River',[],[]),region('Great Southern',[],[]),region('Frankland River',[],[])]),
    area('Tasmania',[],[region('Tamar Valley',[],[]),region('Coal River Valley',[],[])])
  ]),

  regionwideCountry('GI')('New Zealand',[],[
    region('Marlborough',[],appellations('Wairau Valley','Awatere Valley','Southern Valleys')),
    region('Central Otago',[],appellations('Bannockburn','Gibbston','Bendigo','Cromwell','Wanaka')),
    region('Hawke’s Bay',['Hawkes Bay','Hawke s Bay'],appellations('Gimblett Gravels','Bridge Pa Triangle')),
    region('Martinborough',['Wairarapa'],[]),region('Nelson',[],[]),region('Waipara Valley',['North Canterbury'],[]),
    region('Gisborne',[],[]),region('Waiheke Island',[],[]),region('Auckland',[],[])
  ]),

  regionwideCountry('IG')('Argentina',[],[
    region('Mendoza',[],[
      sub('Uco Valley',['Valle de Uco'],appellations('Gualtallary','Altamira','La Consulta','San Pablo','Vista Flores','Los Chacayes')),
      sub('Luján de Cuyo',['Lujan de Cuyo'],appellations('Agrelo','Las Compuertas','Vistalba','Perdriel')),
      sub('Maipú',['Maipu'],[])
    ]),
    region('Salta',[],appellations('Cafayate')),
    region('Patagonia',[],appellations('Río Negro','Neuquén')),
    region('San Juan',[],[])
  ]),

  regionwideCountry('DO')('Chile',[],[
    region('Colchagua Valley',['Colchagua'],[]),region('Maipo Valley',['Maipo'],appellations('Puente Alto','Pirque')),
    region('Casablanca Valley',['Casablanca'],[]),region('San Antonio Valley',[],appellations('Leyda Valley')),
    region('Cachapoal Valley',['Cachapoal'],appellations('Apalta')),region('Maule Valley',['Maule'],[]),
    region('Limarí Valley',['Limarí'],[]),region('Itata Valley',['Itata'],[]),region('Aconcagua Valley',['Aconcagua'],[]),
    region('Bío Bío Valley',['Bio Bio'],[]),region('Elqui Valley',['Elqui'],[]),region('Curicó Valley',['Curico'],[])
  ]),

  regionwideCountry('WO')('South Africa',[],[
    region('Stellenbosch',[],appellations('Simonsberg-Stellenbosch','Jonkershoek Valley','Banghoek','Polkadraai Hills')),
    region('Swartland',[],appellations('Riebeekberg','Paardeberg')),
    region('Franschhoek',['Franschhoek Valley'],[]),region('Walker Bay',[],appellations('Hemel-en-Aarde Valley','Hemel-en-Aarde Ridge')),
    region('Paarl',[],appellations('Simonsberg-Paarl','Voor Paardeberg')),
    region('Constantia',[],[]),region('Elgin',[],[]),region('Robertson',[],[]),region('Breedekloof',[],[]),region('Darling',[],[])
  ]),

  country('Greece',['Hellas'],[
    region('Santorini',[],[]),region('Nemea',[],[]),region('Naoussa',[],[]),
    region('Mantinia',[],[]),region('Crete',[],[]),region('Macedonia',[],[])
  ]),
  country('Hungary',['Magyarország'],[region('Tokaj',['Tokaji'],[]),region('Eger',[],[]),region('Villány',[],[]),region('Szekszárd',[],[])]),
  country('Israel',[],[region('Galilee',['Galil'],appellations('Upper Galilee')),region('Judean Hills',[],[]),region('Golan Heights',[],[])]),
  country('Lebanon',[],[region('Bekaa Valley',['Beqaa Valley'],[])]),
  country('Georgia',[],[region('Kakheti',[],appellations('Kindzmarauli','Tsinandali')),region('Kartli',[],[]),region('Imereti',[],[])]),
  country('Slovenia',[],[region('Primorska',[],appellations('Goriška Brda','Vipava Valley')),region('Podravje',[],[]),region('Posavje',[],[])]),
  country('Croatia',[],[region('Istria',['Istra'],[]),region('Dalmatia',[],appellations('Pelješac','Dingač'))]),
  country('Switzerland',['Suisse','Schweiz'],[region('Valais',[],[]),region('Vaud',[],appellations('Lavaux','Chablais')),region('Genève',['Geneva'],[]),region('Ticino',[],[]),region('Neuchâtel',[],[])]),
  regionwideCountry('VQA')('Canada',[],[
    area('British Columbia',[],[region('Okanagan Valley',[],appellations('Naramata Bench','Golden Mile Bench','Black Sage Bench'))]),
    area('Ontario',[],[region('Niagara Peninsula',[],appellations('Beamsville Bench','Twenty Mile Bench','Four Mile Creek')),region('Prince Edward County',[],[])])
  ]),
  country('Uruguay',[],[region('Canelones',[],[]),region('Maldonado',[],[])]),
  country('Brazil',[],[region('Serra Gaúcha',[],appellations('Vale dos Vinhedos')),region('Campanha',[],[])]),
  country('Mexico',[],[region('Valle de Guadalupe',[],[])]),
  country('China',[],[region('Ningxia',[],[]),region('Shandong',[],[])]),
  country('Japan',[],[region('Yamanashi',[],[]),region('Nagano',[],[]),region('Hokkaido',[],[])]),
  country('England',['United Kingdom','UK','Great Britain'],[region('Sussex',[],[]),region('Kent',[],[]),region('Hampshire',[],[]),region('Essex',[],[])]),
  country('Romania',[],[region('Dealu Mare',[],[]),region('Recaș',[],[])]),
  country('Bulgaria',[],[region('Thracian Valley',[],[]),region('Danubian Plain',[],[])]),
  country('Moldova',[],[region('Codru',[],[]),region('Ștefan Vodă',[],[])]),
  country('Turkey',['Türkiye'],[region('Thrace',[],[]),region('Cappadocia',[],[])]),
  country('India',[],[region('Nashik',[],[])])
];

const slug=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function flatten(){
  const nodes:PlaceNode[]=[];
  const walk=(draft:Draft,parent:string|null)=>{
    // Prefixing with the parent keeps "Chablis" in Burgundy distinct from any
    // later namesake, without the ids depending on tree order.
    const id=parent?`${parent}/${slug(draft.name)}`:slug(draft.name);
    nodes.push({id,name:draft.name,tier:draft.tier,parent,aliases:draft.aliases,
      ...(draft.classification?{classification:draft.classification}:{}),
      ...(draft.denomination?{denomination:draft.denomination}:{}),
      ...(draft.denominationRequired?{denominationRequired:true}:{}),
      ...(draft.denominationFrom?{denominationFrom:draft.denominationFrom}:{})});
    for(const child of draft.children)walk(child,id);
  };
  for(const draft of tree)walk(draft,null);
  return nodes;
}

export const PLACES:readonly PlaceNode[]=flatten();
