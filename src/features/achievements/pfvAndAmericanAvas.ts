import type { AchievementDefinition,AchievementDefinitionItem } from './types';

const producer=(id:string,label:string,...producerNames:string[]):AchievementDefinitionItem=>({id,label,selector:{type:'producer',producerNames}});
const appellation=(id:string,label:string,...appellationNames:string[]):AchievementDefinitionItem=>({id,label,selector:{type:'appellation',appellationNames}});

const pfvFamilies:AchievementDefinitionItem[]=[
  producer('pfv-baron-philippe-de-rothschild','Baron Philippe de Rothschild','Baron Philippe de Rothschild','Baron Philippe de Rothschild S.A.'),
  producer('pfv-domaine-clarence-dillon','Domaine Clarence Dillon','Domaine Clarence Dillon','Clarence Dillon'),
  producer('pfv-egon-muller-scharzhof','Egon Müller Scharzhof','Egon Müller Scharzhof','Egon Müller','Weingut Egon Müller','Weingut Egon Müller-Scharzhof'),
  producer('pfv-familia-torres','Familia Torres','Familia Torres','Miguel Torres','Torres'),
  producer('pfv-famille-hugel','Famille Hugel','Famille Hugel','Hugel','Hugel & Fils','Hugel et Fils'),
  producer('pfv-famille-perrin','Famille Perrin','Famille Perrin','Perrin & Fils','Perrin et Fils'),
  producer('pfv-maison-joseph-drouhin','Maison Joseph Drouhin','Maison Joseph Drouhin','Joseph Drouhin'),
  producer('pfv-marchesi-antinori','Marchesi Antinori','Marchesi Antinori','Antinori'),
  producer('pfv-pol-roger','Pol Roger','Pol Roger','Champagne Pol Roger'),
  producer('pfv-symington-family-estates','Symington Family Estates','Symington Family Estates','Symington'),
  producer('pfv-tempos-vega-sicilia','Tempos Vega Sicilia','Tempos Vega Sicilia','Vega Sicilia','Bodegas Vega Sicilia'),
  producer('pfv-tenuta-san-guido','Tenuta San Guido','Tenuta San Guido')
];

const napaNestedAvas:AchievementDefinitionItem[]=[
  appellation('napa-atlas-peak','Atlas Peak','Atlas Peak'),
  appellation('napa-calistoga','Calistoga','Calistoga'),
  appellation('napa-chiles-valley','Chiles Valley','Chiles Valley','Chiles Valley District'),
  appellation('napa-coombsville','Coombsville','Coombsville'),
  appellation('napa-crystal-springs','Crystal Springs of Napa Valley','Crystal Springs of Napa Valley','Crystal Springs'),
  appellation('napa-diamond-mountain','Diamond Mountain District','Diamond Mountain District','Diamond Mountain'),
  appellation('napa-howell-mountain','Howell Mountain','Howell Mountain'),
  appellation('napa-los-carneros','Los Carneros','Los Carneros','Carneros'),
  appellation('napa-mount-veeder','Mount Veeder','Mount Veeder','Mt. Veeder'),
  appellation('napa-oak-knoll','Oak Knoll District of Napa Valley','Oak Knoll District of Napa Valley','Oak Knoll District','Oak Knoll'),
  appellation('napa-oakville','Oakville','Oakville'),
  appellation('napa-rutherford','Rutherford','Rutherford'),
  appellation('napa-spring-mountain','Spring Mountain District','Spring Mountain District','Spring Mountain'),
  appellation('napa-st-helena','St. Helena','St. Helena','Saint Helena'),
  appellation('napa-stags-leap','Stags Leap District','Stags Leap District',"Stag's Leap District"),
  appellation('napa-wild-horse-valley','Wild Horse Valley','Wild Horse Valley'),
  appellation('napa-yountville','Yountville','Yountville')
];

const willametteNestedAvas:AchievementDefinitionItem[]=[
  appellation('willamette-chehalem-mountains','Chehalem Mountains','Chehalem Mountains','Chehalem Mts'),
  appellation('willamette-dundee-hills','Dundee Hills','Dundee Hills'),
  appellation('willamette-eola-amity-hills','Eola-Amity Hills','Eola-Amity Hills','Eola Amity Hills'),
  appellation('willamette-laurelwood-district','Laurelwood District','Laurelwood District'),
  appellation('willamette-lower-long-tom','Lower Long Tom','Lower Long Tom'),
  appellation('willamette-mcminnville','McMinnville','McMinnville'),
  appellation('willamette-mount-pisgah','Mount Pisgah, Polk County, Oregon','Mount Pisgah, Polk County, Oregon','Mount Pisgah','Mount Pisgah Polk County Oregon'),
  appellation('willamette-ribbon-ridge','Ribbon Ridge','Ribbon Ridge'),
  appellation('willamette-tualatin-hills','Tualatin Hills','Tualatin Hills'),
  appellation('willamette-van-duzer-corridor','Van Duzer Corridor','Van Duzer Corridor'),
  appellation('willamette-yamhill-carlton','Yamhill-Carlton','Yamhill-Carlton','Yamhill Carlton')
];

export const pfvAndAmericanAvaDefinitions:AchievementDefinition[]=[
  {
    id:'primum-familiae-vini-12',title:'Primum Familiae Vini · The 12 Families',subtitle:'Taste a wine from each of the twelve current PFV member families.',category:'iconic-estates',icon:'first-growth',
    references:[{title:'Primum Familiae Vini · Members',url:'https://pfv.org/en/contact-us'}],items:pfvFamilies
  },
  {
    id:'napa-valley-17-nested-avas',title:'Napa Valley · 17 Nested AVAs',subtitle:'Taste a wine from every nested American Viticultural Area within Napa Valley.',category:'regional-exploration',icon:'rhone-crus',
    references:[{title:'Napa Valley Vintners · Napa Valley appellation',url:'https://napavalley.wine/region'},{title:'TTB · Crystal Springs of Napa Valley AVA',url:'https://www.ttb.gov/public-information/featured-stories/ttb-establishes-crystal-springs-napa-valley-american'}],items:napaNestedAvas
  },
  {
    id:'willamette-valley-11-nested-avas',title:'Willamette Valley · 11 Nested AVAs',subtitle:'Taste a wine from every nested American Viticultural Area within the Willamette Valley.',category:'regional-exploration',icon:'rhone-crus',
    references:[{title:'Willamette Valley Wineries Association · AVA Overviews',url:'https://www.willamettewines.com/about-the-valley/ava-overviews/'}],items:willametteNestedAvas
  }
];
