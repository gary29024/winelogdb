export type AchievementCategory='iconic-estates'|'historic-tastings'|'regional-exploration'|'guide-selections';
export type AchievementIconKey='first-growth'|'judgment-paris'|'beaujolais-crus'|'bordeaux-classification'|'sauternes'|'graves'|'saint-emilion'|'burgundy-grand-cru'|'gevrey-grand-cru'|'rhone-crus'|'michelin-grapes';
export type AchievementItemStatus='tasted'|'possible'|'pending';

export type ProducerSelector={
  type:'producer';
  producerNames:string[];
};

export type CuveeSelector={
  type:'cuvee';
  producerNames:string[];
  cuveeNames:string[];
  appellationNames?:string[];
};

export type WineVintageSelector={
  type:'wine_vintage';
  producerNames:string[];
  cuveeNames:string[];
  vintage:number;
  appellationNames?:string[];
};

export type AppellationSelector={
  type:'appellation';
  appellationNames:string[];
};

export type AchievementSelector=ProducerSelector|CuveeSelector|WineVintageSelector|AppellationSelector;

export type AchievementDefinitionItem={
  id:string;
  label:string;
  note?:string;
  selector:AchievementSelector;
};

export type AchievementReference={title:string;url:string};

export type AchievementSeries={
  id:string;
  authority:string;
  region:string;
  edition:number;
  tier:string;
};

export type AchievementDefinition={
  id:string;
  title:string;
  subtitle:string;
  category:AchievementCategory;
  icon:AchievementIconKey;
  items:AchievementDefinitionItem[];
  references:AchievementReference[];
  series?:AchievementSeries;
};

export type AchievementProducerIdentity={
  id:string;
  canonicalName:string;
  aliases?:string[];
};

export type AchievementCuveeIdentity={
  id:string;
  producerId:string;
  canonicalName:string;
  aliases?:string[];
  appellation?:string|null;
};

export type AchievementIdentityRegistry={
  producers:AchievementProducerIdentity[];
  cuvees:AchievementCuveeIdentity[];
};

export type AchievementWine={
  id:string;
  producerId?:string|null;
  cuveeId?:string|null;
  producer:string;
  wineName:string;
  vintage?:number|null;
  appellation?:string|null;
};

export type AchievementItemProgress={
  id:string;
  label:string;
  note?:string;
  status:AchievementItemStatus;
  tastedWineIds:string[];
  tastedVintages:number[];
  resolvedProducerId?:string;
  resolvedCuveeId?:string;
};

export type AchievementProgress={
  definition:AchievementDefinition;
  completed:number;
  possible:number;
  pending:number;
  total:number;
  percent:number;
  complete:boolean;
  items:AchievementItemProgress[];
};