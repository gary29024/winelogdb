import type { AchievementDefinition,AchievementDefinitionItem } from './types';

type NamedEstate=string|readonly [string,...string[]];
const slug=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const producerItems=(prefix:string,entries:readonly NamedEstate[]):AchievementDefinitionItem[]=>entries.map(entry=>{
  const values=typeof entry==='string'?[entry]:[entry[0],...entry.slice(1)];
  const [label,...aliases]=values;
  return {id:`${prefix}-${slug(label)}`,label,selector:{type:'producer',producerNames:[label,...aliases]}};
});

const michelin2026='https://www.michelin.com/en/publications/products-and-services/the-michelin-guide-first-grape-selection-burgundy-france';
const reference={title:'MICHELIN · 2026 Burgundy Grape Selection',url:michelin2026};

const threeGrapes:readonly NamedEstate[]=[
  ['Cécile Tremblay','Domaine Cécile Tremblay'],
  ['Dugat-Py','Domaine Dugat-Py'],
  ['Roumier','Domaine Georges Roumier','Georges Roumier'],
  ['Domaine de la Romanée-Conti','Domaine de la Romanee-Conti','DRC'],
  ['Domaine Leroy','Leroy'],
  ["Domaine d’Auvenay","Domaine d'Auvenay",'Auvenay'],
  ['Coche-Dury','Domaine Coche-Dury'],
  ['Jean-Marc & Thomas Bouley','Domaine Jean-Marc & Thomas Bouley','Jean-Marc et Thomas Bouley','Domaine Jean-Marc Bouley'],
  ['Hubert Lamy','Domaine Hubert Lamy']
];

const twoGrapes:readonly NamedEstate[]=[
  ['Dujac','Domaine Dujac'],['Denis Mortet','Domaine Denis Mortet'],['Georges Mugneret-Gibourg','Domaine Georges Mugneret-Gibourg'],
  ['Bruno Clair','Domaine Bruno Clair'],['Gérard Mugneret','Domaine Gérard Mugneret','Gerard Mugneret'],['Jacques-Frédéric Mugnier','Domaine Jacques-Frédéric Mugnier','Jacques-Frederic Mugnier'],
  ['Jean-Claude Bachelet','Domaine Jean-Claude Bachelet'],['Paul Pillot','Domaine Paul Pillot'],['Arnaud Ente','Domaine Arnaud Ente'],['Benoît Ente','Domaine Benoît Ente','Benoit Ente'],
  ['Benoît Moreau','Domaine Benoît Moreau','Benoit Moreau'],['Lamy-Caillat','Domaine Lamy-Caillat'],['Bonneau du Martray','Domaine Bonneau du Martray'],
  ['Domaine des Comtes Lafon','Comtes Lafon'],['Domaine des Croix','Des Croix'],['Domaine Leflaive','Leflaive'],['Etienne Sauzet','Domaine Etienne Sauzet','Étienne Sauzet'],
  ['Jean-Marc Vincent','Domaine Jean-Marc Vincent'],['Bruno Lorenzon','Domaine Bruno Lorenzon'],['Dureuil-Janthial','Domaine Dureuil-Janthial']
];

const oneGrape:readonly NamedEstate[]=[
  ['Armand Rousseau','Domaine Armand Rousseau'],['Claude Dugat','Domaine Claude Dugat'],['Denis Bachelet','Domaine Denis Bachelet'],['Duroché','Domaine Duroché','Domaine Duroche'],
  ['Joseph Roty','Domaine Joseph Roty'],['Trapet','Domaine Trapet','Domaine Jean-Louis Trapet'],['Comte Georges de Vogüé','Domaine Comte Georges de Vogüé','Comte Georges de Vogue'],
  ['Ghislaine Barthod','Domaine Ghislaine Barthod'],['Hudelot-Noëllat','Domaine Hudelot-Noëllat','Hudelot-Noellat'],['Louis Boillot','Domaine Louis Boillot'],
  ['Clos de Tart','Domaine du Clos de Tart'],['Domaine des Lambrays','Clos des Lambrays'],['Domaine Ponsot','Ponsot'],['Arnoux-Lachaux','Domaine Arnoux-Lachaux'],
  ['Domaine Sylvain Cathiard','Sylvain Cathiard'],['Méo-Camuzet','Domaine Méo-Camuzet','Meo-Camuzet'],['Château de la Tour','Chateau de la Tour'],['Faiveley','Domaine Faiveley'],
  ['Bernard-Bonin','Domaine Bernard-Bonin'],['Henri Boillot','Domaine Henri Boillot'],['Henri Germain','Domaine Henri Germain'],['Roulot','Domaine Roulot','Guy Roulot'],
  ['Vincent Girardin','Domaine Vincent Girardin'],['Domaine de Montille','De Montille'],["Marquis d'Angerville",'Domaine Marquis d’Angerville','Domaine Marquis d\'Angerville'],
  ['Michel Lafarge','Domaine Michel Lafarge'],['Roblet-Monnot','Domaine Roblet-Monnot'],['Benjamin Leroux','Domaine Benjamin Leroux'],['Joseph Drouhin','Maison Joseph Drouhin'],
  ['Louis Jadot','Maison Louis Jadot'],['Pierre-Yves Colin-Morey','Domaine Pierre-Yves Colin-Morey','PYCM'],['Marc Colin','Domaine Marc Colin'],['Henri & Gilles Buisson','Domaine Henri & Gilles Buisson','Henri et Gilles Buisson']
];

const selected:readonly NamedEstate[]=[
  ['Domaine Berthaut-Gerbet','Berthaut-Gerbet'],['Sylvain Pataille','Domaine Sylvain Pataille'],['Domaine Felettig','Felettig'],['Domaine Camille Thiriet','Camille Thiriet'],
  ['Benoit Chevallier','Benoît Chevallier','Domaine Benoit Chevallier'],['Charles Audoin','Domaine Charles Audoin'],['Fourrier','Domaine Fourrier'],['Hubert Lignier','Domaine Hubert Lignier'],
  ['Domaine Jobard-Morey','Jobard-Morey'],['Anne Boisson','Domaine Anne Boisson'],['Ballot-Millot','Domaine Ballot-Millot'],['Buisson-Charles','Domaine Buisson-Charles'],
  ['Camille & Guillaume Boillot','Domaine Camille & Guillaume Boillot','Camille et Guillaume Boillot'],['Pierre Boisson','Domaine Pierre Boisson'],['Pierre Girardin','Domaine Pierre Girardin'],['Pierre Morey','Domaine Pierre Morey'],
  ['Alex Moreau','Domaine Alex Moreau'],['Ramonet','Domaine Ramonet'],['Vincent Dancer','Domaine Vincent Dancer'],['Jacques Carillon','Domaine Jacques Carillon'],
  ['Thomas-Collardot','Domaine Thomas-Collardot'],['Albert Bichot','Maison Albert Bichot'],['Bouchard Père & Fils','Bouchard Pere & Fils','Maison Bouchard Père & Fils'],
  ['Bachelet-Monnot','Domaine Bachelet-Monnot'],['Nicolas Perrault','Domaine Nicolas Perrault'],['Alain Gras','Domaine Alain Gras'],['Joseph Colin','Domaine Joseph Colin'],
  ['Lafouge','Domaine Lafouge'],['Pierre Guillemot','Domaine Pierre Guillemot'],['Rapet','Domaine Rapet','Domaine Rapet Père & Fils'],['Yvon Clerget','Domaine Yvon Clerget'],['Maxime Cottenceau','Domaine Maxime Cottenceau']
];

function collection(id:string,title:string,subtitle:string,tier:string,items:readonly NamedEstate[]):AchievementDefinition{
  return {
    id,title,subtitle,category:'guide-selections',icon:'michelin-grapes',references:[reference],items:producerItems(id,items),
    series:{id:'michelin-grapes',authority:'MICHELIN Guide',region:'Burgundy',edition:2026,tier}
  };
}

export const michelinAchievementDefinitions:AchievementDefinition[]=[
  collection('michelin-grapes-burgundy-2026-three','Three MICHELIN Grapes · Burgundy 2026','Taste wines from all 9 estates awarded the inaugural highest MICHELIN Grape distinction.','three',threeGrapes),
  collection('michelin-grapes-burgundy-2026-two','Two MICHELIN Grapes · Burgundy 2026','Taste wines from all 20 estates awarded Two MICHELIN Grapes in Burgundy.','two',twoGrapes),
  collection('michelin-grapes-burgundy-2026-one','One MICHELIN Grape · Burgundy 2026','Taste wines from all 33 Burgundy estates awarded One MICHELIN Grape.','one',oneGrape),
  collection('michelin-grapes-burgundy-2026-selected','MICHELIN Selected Estates · Burgundy 2026','Taste wines from all 32 additional Burgundy estates selected by the MICHELIN Guide.','selected',selected)
];
