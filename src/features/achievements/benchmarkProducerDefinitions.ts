import type { AchievementDefinition,AchievementDefinitionItem } from './types';

type BenchmarkEntry={label:string;note:string;producerNames:string[]};
type BenchmarkGroup={section:string;subsection:string|null;entries:BenchmarkEntry[]};

const slug=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const benchmarkGroups:BenchmarkGroup[]=[
  {section:"Germany",subsection:"Riesling & Spätburgunder",entries:[
    {label:"Egon Müller",note:"Riesling",producerNames:["Egon Müller","Egon Muller","Weingut Egon Müller","Weingut Egon Muller","Egon Müller Scharzhof","Egon Muller Scharzhof"]},
    {label:"Keller",note:"Riesling · Spätburgunder",producerNames:["Keller","Weingut Keller","Klaus Peter Keller"]},
    {label:"Schloss Johannisberg",note:"Riesling",producerNames:["Schloss Johannisberg"]},
    {label:"J.J. Prüm",note:"Riesling",producerNames:["J.J. Prüm","J J Prüm","Joh. Jos. Prüm","Joh Jos Prum","Weingut Joh. Jos. Prüm"]},
    {label:"Emrich-Schönleber",note:"Riesling",producerNames:["Emrich-Schönleber","Emrich Schonleber","Weingut Emrich-Schönleber"]},
    {label:"Bernhard Huber",note:"Spätburgunder · Baden",producerNames:["Bernhard Huber","Weingut Bernhard Huber"]},
    {label:"Franz Künstler",note:"Spätburgunder · Rheingau",producerNames:["Franz Künstler","Franz Kunstler","Weingut Künstler","Weingut Kunstler","Künstler"]},
    {label:"Jean Stodden",note:"Spätburgunder · Ahr",producerNames:["Jean Stodden","Weingut Jean Stodden"]},
    {label:"Meyer-Näkel",note:"Spätburgunder · Ahr",producerNames:["Meyer-Näkel","Meyer-Nakel","Weingut Meyer-Näkel","Weingut Meyer-Nakel"]},
  ]},
  {section:"France",subsection:"Loire",entries:[
    {label:"Edmond Vatan",note:"Sauvignon Blanc · Sancerre",producerNames:["Edmond Vatan","Domaine Edmond Vatan"]},
    {label:"Didier Dagueneau",note:"Sauvignon Blanc · Loire",producerNames:["Didier Dagueneau","Domaine Didier Dagueneau","Louis-Benjamin Dagueneau"]},
    {label:"Alphonse Mellot",note:"Sauvignon Blanc · Sancerre",producerNames:["Alphonse Mellot","Domaine Alphonse Mellot"]},
    {label:"Nicolas Joly",note:"Savennières",producerNames:["Nicolas Joly","Famille Joly"]},
    {label:"Domaine du Closel",note:"Savennières",producerNames:["Domaine du Closel","Château des Vaults","Chateau des Vaults"]},
    {label:"Domaine des Forges",note:"Savennières / Quarts de Chaume",producerNames:["Domaine des Forges"]},
    {label:"Domaine des Baumard",note:"Savennières / Quarts de Chaume",producerNames:["Domaine des Baumard","Baumard"]},
    {label:"Clos Rougeard",note:"Cabernet Franc · Saumur-Champigny",producerNames:["Clos Rougeard"]},
    {label:"Clau de Nell",note:"Cabernet Franc · Anjou",producerNames:["Clau de Nell","Château de Clau de Nell","Chateau de Clau de Nell"]},
    {label:"Charles Joguet",note:"Cabernet Franc · Chinon",producerNames:["Charles Joguet","Domaine Charles Joguet"]},
    {label:"Domaine de la Butte",note:"Cabernet Franc · Bourgueil",producerNames:["Domaine de la Butte"]},
  ]},
  {section:"France",subsection:"Saint-Émilion",entries:[
    {label:"Château Pavie",note:"Saint-Émilion benchmark",producerNames:["Château Pavie","Chateau Pavie"]},
    {label:"Château Figeac",note:"Saint-Émilion benchmark",producerNames:["Château Figeac","Chateau Figeac","Château-Figeac","Chateau-Figeac"]},
    {label:"Château Angélus",note:"Withdrew from the 2022 classification; retained in the course benchmark set",producerNames:["Château Angélus","Chateau Angelus","Chateau Angélus"]},
    {label:"Château Ausone",note:"Withdrew from the 2022 classification; retained in the course benchmark set",producerNames:["Château Ausone","Chateau Ausone"]},
    {label:"Château Cheval Blanc",note:"Withdrew from the 2022 classification; retained in the course benchmark set",producerNames:["Château Cheval Blanc","Chateau Cheval Blanc"]},
  ]},
  {section:"France",subsection:"Chablis",entries:[
    {label:"François Raveneau",note:"Chablis",producerNames:["François Raveneau","Francois Raveneau","Domaine François Raveneau","Domaine Francois Raveneau"]},
    {label:"Vincent Dauvissat",note:"Chablis",producerNames:["Vincent Dauvissat","Domaine Vincent Dauvissat","René et Vincent Dauvissat","Rene et Vincent Dauvissat"]},
    {label:"William Fèvre",note:"Chablis",producerNames:["William Fèvre","William Fevre","Domaine William Fèvre","Domaine William Fevre"]},
  ]},
  {section:"France",subsection:"Northern Rhône",entries:[
    {label:"E. Guigal",note:"Condrieu · Côte-Rôtie · Saint-Joseph",producerNames:["E. Guigal","E Guigal","Guigal","Maison Guigal"]},
    {label:"Yves Cuilleron",note:"Condrieu",producerNames:["Yves Cuilleron","Domaine Yves Cuilleron"]},
    {label:"Domaine Georges Vernay",note:"Condrieu",producerNames:["Domaine Georges Vernay","Georges Vernay"]},
    {label:"Domaine Jamet",note:"Côte-Rôtie",producerNames:["Domaine Jamet","Jamet"]},
    {label:"Domaine Yves Gangloff",note:"Côte-Rôtie",producerNames:["Domaine Yves Gangloff","Yves Gangloff","Gangloff"]},
    {label:"Maison Stéphan",note:"Côte-Rôtie",producerNames:["Maison Stéphan","Maison Stephan","Jean-Michel Stéphan","Jean-Michel Stephan","Domaine Jean-Michel Stéphan"]},
    {label:"Pierre Gonon",note:"Saint-Joseph",producerNames:["Pierre Gonon","Domaine Pierre Gonon","Jean & Pierre Gonon","Jean et Pierre Gonon"]},
    {label:"Jean-Louis Chave",note:"Hermitage",producerNames:["Jean-Louis Chave","Jean Louis Chave","Domaine Jean-Louis Chave","Domaine Jean Louis Chave"]},
    {label:"Paul Jaboulet Aîné",note:"Hermitage",producerNames:["Paul Jaboulet Aîné","Paul Jaboulet Aine","Maison Paul Jaboulet Aîné","Maison Paul Jaboulet Aine"]},
    {label:"Delas Frères",note:"Hermitage",producerNames:["Delas Frères","Delas Freres","Delas"]},
  ]},
  {section:"Spain",subsection:"Jumilla",entries:[
    {label:"Bodegas El Nido",note:"Jumilla",producerNames:["Bodegas El Nido","El Nido"]},
  ]},
  {section:"Spain",subsection:"Ribera del Duero",entries:[
    {label:"Vega Sicilia",note:"Ribera del Duero",producerNames:["Vega Sicilia","Bodegas Vega Sicilia","Tempos Vega Sicilia"]},
    {label:"Dominio de Pingus",note:"Ribera del Duero",producerNames:["Dominio de Pingus","Pingus"]},
    {label:"Dominio del Águila",note:"Ribera del Duero",producerNames:["Dominio del Águila","Dominio del Aguila"]},
    {label:"Bendito Destino",note:"Ribera del Duero",producerNames:["Bendito Destino"]},
  ]},
  {section:"Spain",subsection:"Rioja",entries:[
    {label:"Álvaro Palacios",note:"Rioja benchmark shown with Palacios Remondo",producerNames:["Álvaro Palacios","Alvaro Palacios","Palacios Remondo","Bodegas Palacios Remondo"]},
    {label:"Remelluri",note:"Rioja",producerNames:["Remelluri","Granja Nuestra Señora de Remelluri","Granja Nuestra Senora de Remelluri"]},
    {label:"La Rioja Alta",note:"Rioja · Gran Reserva 904 shown",producerNames:["La Rioja Alta","La Rioja Alta S.A.","La Rioja Alta SA"]},
    {label:"CVNE",note:"Rioja · Imperial shown",producerNames:["CVNE","C.V.N.E.","Compañía Vinícola del Norte de España","Compania Vinicola del Norte de Espana"]},
    {label:"Artadi",note:"Rioja",producerNames:["Artadi","Bodegas y Viñedos Artadi","Bodegas y Vinedos Artadi"]},
    {label:"López de Heredia",note:"Rioja · Viña Tondonia shown",producerNames:["R. López de Heredia Viña Tondonia","R. Lopez de Heredia Vina Tondonia","López de Heredia","Lopez de Heredia","Bodegas R. López de Heredia Viña Tondonia"]},
  ]},
  {section:"Italy",subsection:"Valpolicella",entries:[
    {label:"Giuseppe Quintarelli",note:"Valpolicella",producerNames:["Giuseppe Quintarelli","Quintarelli"]},
    {label:"Dal Forno Romano",note:"Valpolicella",producerNames:["Dal Forno Romano","Romano Dal Forno","Dal Forno"]},
    {label:"Bertani",note:"Valpolicella",producerNames:["Bertani"]},
    {label:"Masi",note:"Valpolicella",producerNames:["Masi","Masi Agricola"]},
  ]},
  {section:"Italy",subsection:"Barolo",entries:[
    {label:"Giuseppe Mascarello",note:"Barolo",producerNames:["Giuseppe Mascarello","Giuseppe Mascarello e Figlio"]},
    {label:"Giacomo Conterno",note:"Barolo",producerNames:["Giacomo Conterno","Azienda Vitivinicola Giacomo Conterno"]},
    {label:"Bruno Giacosa",note:"Barolo",producerNames:["Bruno Giacosa","Azienda Agricola Falletto Bruno Giacosa"]},
    {label:"Bartolo Mascarello",note:"Barolo",producerNames:["Bartolo Mascarello","Cantina Bartolo Mascarello"]},
    {label:"Giuseppe Rinaldi",note:"Barolo",producerNames:["Giuseppe Rinaldi","Azienda Agricola Giuseppe Rinaldi"]},
    {label:"Luciano Sandrone",note:"Barolo",producerNames:["Luciano Sandrone","Sandrone"]},
  ]},
  {section:"Italy",subsection:"Abruzzo",entries:[
    {label:"Edoardo Valentini",note:"Central Italy · Trebbiano, Montepulciano & Cerasuolo d’Abruzzo",producerNames:["Edoardo Valentini","Valentini"]},
  ]},
  {section:"Italy",subsection:"Brunello di Montalcino",entries:[
    {label:"Biondi-Santi",note:"Brunello di Montalcino",producerNames:["Biondi-Santi","Biondi Santi","Tenuta Greppo Biondi-Santi"]},
    {label:"Il Marroneto",note:"Brunello di Montalcino",producerNames:["Il Marroneto"]},
    {label:"Fuligni",note:"Brunello di Montalcino",producerNames:["Fuligni","Azienda Agricola Fuligni"]},
    {label:"Il Poggione",note:"Brunello di Montalcino",producerNames:["Il Poggione","Tenuta Il Poggione"]},
    {label:"Banfi",note:"Brunello di Montalcino",producerNames:["Banfi","Castello Banfi"]},
    {label:"Poggio di Sotto",note:"Brunello di Montalcino",producerNames:["Poggio di Sotto"]},
    {label:"Mastrojanni",note:"Brunello di Montalcino",producerNames:["Mastrojanni"]},
    {label:"Soldera",note:"Brunello di Montalcino",producerNames:["Soldera","Case Basse di Gianfranco Soldera","Case Basse Soldera"]},
  ]},
  {section:"Italy",subsection:"Tuscany · Bordeaux-style benchmarks",entries:[
    {label:"Tenuta San Guido",note:"Sassicaia shown",producerNames:["Tenuta San Guido"]},
    {label:"Masseto",note:"Masseto shown",producerNames:["Masseto","Tenuta dell'Ornellaia Masseto"]},
    {label:"Marchesi Antinori",note:"Solaia shown",producerNames:["Marchesi Antinori","Antinori"]},
    {label:"Gaja",note:"Ca’Marcanda shown",producerNames:["Gaja","Ca’Marcanda","Ca'Marcanda","Gaja Ca'Marcanda"]},
  ]},
  {section:"Italy",subsection:"Etna",entries:[
    {label:"Tenuta delle Terre Nere",note:"Etna",producerNames:["Tenuta delle Terre Nere","Tenuta di Terre Nere","Terre Nere"]},
    {label:"Pietradolce",note:"Etna",producerNames:["Pietradolce"]},
    {label:"Girolamo Russo",note:"Etna",producerNames:["Girolamo Russo"]},
    {label:"Frank Cornelissen",note:"Etna",producerNames:["Frank Cornelissen"]},
  ]},
  {section:"Portugal",subsection:"Douro",entries:[
    {label:"Niepoort",note:"Douro",producerNames:["Niepoort"]},
  ]},
  {section:"New Zealand",subsection:"Chardonnay · Hawke’s Bay Syrah · Pinot Noir",entries:[
    {label:"Kumeu River",note:"Chardonnay",producerNames:["Kumeu River","Kumeu River Wines"]},
    {label:"Church Road",note:"Chardonnay · Hawke’s Bay Syrah",producerNames:["Church Road","Church Road Winery"]},
    {label:"Dog Point",note:"Chardonnay · Pinot Noir",producerNames:["Dog Point","Dog Point Vineyard"]},
    {label:"Pegasus Bay",note:"Chardonnay",producerNames:["Pegasus Bay","Pegasus Bay Winery"]},
    {label:"Dry River",note:"Chardonnay",producerNames:["Dry River","Dry River Wines"]},
    {label:"Bell Hill",note:"Chardonnay · Pinot Noir",producerNames:["Bell Hill","Bell Hill Vineyard"]},
    {label:"Te Mata Estate",note:"Hawke’s Bay Syrah",producerNames:["Te Mata Estate","Te Mata"]},
    {label:"Craggy Range",note:"Hawke’s Bay Syrah",producerNames:["Craggy Range"]},
    {label:"Trinity Hill",note:"Hawke’s Bay Syrah",producerNames:["Trinity Hill"]},
    {label:"Mission Estate",note:"Hawke’s Bay Syrah",producerNames:["Mission Estate","Mission Estate Winery"]},
    {label:"Kusuda",note:"Pinot Noir",producerNames:["Kusuda","Kusuda Wines"]},
    {label:"Felton Road",note:"Pinot Noir",producerNames:["Felton Road"]},
    {label:"Two Paddocks",note:"Pinot Noir",producerNames:["Two Paddocks"]},
  ]},
  {section:"Australia",subsection:"Chardonnay · Eden Valley · Pinot Noir",entries:[
    {label:"Penfolds",note:"Yattarna Chardonnay shown",producerNames:["Penfolds","Penfolds Wines"]},
    {label:"Leeuwin Estate",note:"Chardonnay",producerNames:["Leeuwin Estate","Leeuwin"]},
    {label:"Shaw + Smith",note:"Chardonnay",producerNames:["Shaw + Smith","Shaw & Smith","Shaw and Smith"]},
    {label:"Giant Steps",note:"Chardonnay · Pinot Noir",producerNames:["Giant Steps","Giant Steps Yarra Valley"]},
    {label:"Bindi",note:"Chardonnay",producerNames:["Bindi","Bindi Wines"]},
    {label:"By Farr",note:"Chardonnay · Pinot Noir",producerNames:["By Farr","Farr","By Farr Wines"]},
    {label:"Henschke",note:"Eden Valley",producerNames:["Henschke"]},
    {label:"Powell & Son",note:"Eden Valley",producerNames:["Powell & Son","Powell and Son"]},
    {label:"Two Hands",note:"Eden Valley",producerNames:["Two Hands","Two Hands Wines"]},
    {label:"Grosset",note:"Eden Valley slide benchmark",producerNames:["Grosset","Grosset Wines"]},
    {label:"Jim Barry",note:"Eden Valley slide benchmark",producerNames:["Jim Barry","Jim Barry Wines"]},
    {label:"Ashton Hills",note:"Pinot Noir",producerNames:["Ashton Hills","Ashton Hills Vineyard"]},
    {label:"William Downie",note:"Pinot Noir",producerNames:["William Downie"]},
    {label:"Bass Phillip",note:"Pinot Noir",producerNames:["Bass Phillip","Bass Phillip Wines"]},
    {label:"Tolpuddle Vineyard",note:"Pinot Noir",producerNames:["Tolpuddle Vineyard","Tolpuddle"]},
    {label:"Yering Station",note:"Pinot Noir",producerNames:["Yering Station"]},
  ]},
  {section:"United States",subsection:"Napa Valley",entries:[
    {label:"Harlan Estate",note:"Napa Valley",producerNames:["Harlan Estate"]},
    {label:"Robert Mondavi",note:"Napa Valley",producerNames:["Robert Mondavi","Robert Mondavi Winery"]},
    {label:"Dominus Estate",note:"Napa Valley",producerNames:["Dominus Estate","Dominus"]},
    {label:"Screaming Eagle",note:"Napa Valley",producerNames:["Screaming Eagle"]},
    {label:"Opus One",note:"Napa Valley",producerNames:["Opus One","Opus One Winery"]},
    {label:"Diamond Creek",note:"Napa Valley",producerNames:["Diamond Creek","Diamond Creek Vineyards"]},
    {label:"Heitz Cellar",note:"Napa Valley",producerNames:["Heitz Cellar","Heitz"]},
    {label:"Beaulieu Vineyard",note:"Napa Valley",producerNames:["Beaulieu Vineyard","BV"]},
    {label:"BOND",note:"Napa Valley",producerNames:["BOND","Bond"]},
    {label:"Promontory",note:"Napa Valley",producerNames:["Promontory","Promontory Wine"]},
    {label:"Joseph Phelps",note:"Napa Valley",producerNames:["Joseph Phelps","Joseph Phelps Vineyards"]},
    {label:"Stag’s Leap Wine Cellars",note:"Napa Valley · Cask 23 shown",producerNames:["Stag’s Leap Wine Cellars","Stag's Leap Wine Cellars","Stags Leap Wine Cellars"]},
  ]},
  {section:"United States",subsection:"Oregon Pinot Noir",entries:[
    {label:"Rose & Arrow",note:"Oregon Pinot Noir",producerNames:["Rose & Arrow","Rose and Arrow"]},
    {label:"Domaine Serene",note:"Oregon Pinot Noir",producerNames:["Domaine Serene","Serene"]},
    {label:"00 Wines",note:"Oregon Pinot Noir",producerNames:["00 Wines","Double Zero Wines"]},
    {label:"Bergström",note:"Oregon Pinot Noir",producerNames:["Bergström","Bergstrom","Bergström Wines","Bergstrom Wines"]},
    {label:"Cristom",note:"Oregon Pinot Noir",producerNames:["Cristom","Cristom Vineyards"]},
    {label:"Domaine Drouhin Oregon",note:"Oregon Pinot Noir",producerNames:["Domaine Drouhin Oregon","Drouhin Oregon","Domaine Drouhin"]},
  ]},
  {section:"South Africa",subsection:null,entries:[
    {label:"Hamilton Russell Vineyards",note:"South Africa",producerNames:["Hamilton Russell Vineyards","Hamilton Russell"]},
    {label:"Mullineux",note:"South Africa",producerNames:["Mullineux","Mullineux & Leeu Family Wines","Mullineux and Leeu Family Wines"]},
    {label:"The Sadie Family Wines",note:"South Africa",producerNames:["The Sadie Family Wines","Sadie Family","Sadie Family Wines","Eben Sadie"]},
    {label:"David & Nadia",note:"South Africa",producerNames:["David & Nadia","David and Nadia"]},
    {label:"Kanonkop",note:"South Africa",producerNames:["Kanonkop","Kanonkop Estate"]},
  ]},
  {section:"Argentina",subsection:null,entries:[
    {label:"Catena Zapata",note:"Argentina",producerNames:["Catena Zapata","Bodega Catena Zapata"]},
    {label:"PerSe",note:"Argentina",producerNames:["PerSe","Per Se"]},
    {label:"Otronia",note:"Argentina",producerNames:["Otronia","Bodega Otronia"]},
    {label:"Bodega Chacra",note:"Argentina",producerNames:["Bodega Chacra","Chacra"]},
    {label:"Matías Riccitelli",note:"Argentina",producerNames:["Matías Riccitelli","Matias Riccitelli","Riccitelli"]},
  ]},
];

const benchmarkItems:AchievementDefinitionItem[]=benchmarkGroups.flatMap(group=>group.entries.map(entry=>({
  id:`benchmark-${slug(entry.label)}`,label:entry.label,note:entry.note,selector:{type:'producer',producerNames:entry.producerNames}
})));

export const benchmarkProducerHeadings:Record<string,{section:string;subsection:string|null}>=Object.fromEntries(
  benchmarkGroups.flatMap(group=>group.entries.map(entry=>[`benchmark-${slug(entry.label)}`,{section:group.section,subsection:group.subsection}]))
);

export const benchmarkProducerDefinition:AchievementDefinition={
  id:'world-benchmark-producers',
  title:'World Benchmark Producers',
  subtitle:'One tasting checklist compiled from the producer examples in the 2025 course notes, organised into regional series.',
  category:'iconic-estates',icon:'beaujolais-crus',
  references:[],items:benchmarkItems
};
