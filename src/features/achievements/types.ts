export type AchievementCategory='iconic-estates'|'historic-tastings'|'regional-exploration'|'guide-selections';
export type AchievementIconKey='first-growth'|'judgment-paris'|'beaujolais-crus'|'bordeaux-classification'|'sauternes'|'graves'|'saint-emilion'|'burgundy-grand-cru'|'gevrey-grand-cru'|'rhone-crus'|'michelin-grapes';
export type AchievementItemStatus='tasted'|'possible'|'pending';
export type AchievementOrigin='curated'|'custom'|'catalogue';
export type AchievementMatchMode='exact'|'cuvee'|'producer';

export type ProducerSelector={type:'producer';producerNames:string[];producerId?:string};
export type CuveeSelector={type:'cuvee';producerNames:string[];cuveeNames:string[];appellationNames?:string[];producerId?:string;cuveeId?:string};
export type WineVintageSelector={type:'wine_vintage';producerNames:string[];cuveeNames:string[];vintage:number;appellationNames?:string[];producerId?:string;cuveeId?:string};
export type AppellationSelector={type:'appellation';appellationNames:string[]};
export type SiteSelector={type:'site';cuveeNames:string[];appellationNames?:string[]};
export type AchievementSelector=ProducerSelector|CuveeSelector|WineVintageSelector|AppellationSelector|SiteSelector;

export type AchievementCatalogueRule=
  |{type:'producer_cuvees';producerId:string;producerName:string}
  |{type:'appellation_producers';appellation:string}
  |{type:'region_producers';region:string;country?:string|null};

export type AchievementDefinitionItem={id:string;label:string;note?:string;selector:AchievementSelector};
export type AchievementReference={title:string;url:string};
export type AchievementSeries={id:string;authority:string;region:string;edition:number;tier:string};
export type AchievementDefinition={
  id:string;
  title:string;
  subtitle:string;
  category:AchievementCategory;
  icon:AchievementIconKey;
  items:AchievementDefinitionItem[];
  references:AchievementReference[];
  series?:AchievementSeries;
  origin?:AchievementOrigin;
  editable?:boolean;
  catalogueRule?:AchievementCatalogueRule;
};

export type AchievementProducerIdentity={id:string;canonicalName:string;aliases?:string[];country?:string|null;region?:string|null};
export type AchievementCuveeIdentity={id:string;producerId:string;canonicalName:string;aliases?:string[];appellation?:string|null;wineStyle?:string|null;catalogBacked?:boolean};
export type AchievementIdentityRegistry={producers:AchievementProducerIdentity[];cuvees:AchievementCuveeIdentity[]};
export type AchievementWine={id:string;producerId?:string|null;cuveeId?:string|null;producer:string;wineName:string;vintage?:number|null;appellation?:string|null};
export type AchievementItemProgress={id:string;label:string;note?:string;status:AchievementItemStatus;tastedWineIds:string[];tastedVintages:number[];resolvedProducerId?:string;resolvedCuveeId?:string};
export type AchievementProgress={definition:AchievementDefinition;completed:number;possible:number;pending:number;total:number;percent:number;complete:boolean;items:AchievementItemProgress[];matchMode:AchievementMatchMode;supportsRelaxedMatching:boolean};

export type AchievementCatalogueProducerOption={id:string;name:string;country:string|null;region:string|null;catalogCount:number};
export type AchievementCatalogueCuveeOption={id:string;producerId:string;producerName:string;name:string;appellation:string|null;wineStyle:string|null;catalogBacked:boolean};
export type AchievementCatalogueAppellationOption={name:string;producerCount:number;cuveeCount:number};
export type AchievementCatalogueRegionOption={name:string;country:string|null;producerCount:number};
export type AchievementCatalogueOptions={
  producers:AchievementCatalogueProducerOption[];
  cuvees:AchievementCatalogueCuveeOption[];
  appellations:AchievementCatalogueAppellationOption[];
  regions:AchievementCatalogueRegionOption[];
};

export type CustomAchievementManualItem=
  |{type:'producer';producerId:string}
  |{type:'cuvee';cuveeId:string}
  |{type:'appellation';appellation:string};
export type CustomAchievementInput={
  title:string;
  subtitle:string;
  icon:AchievementIconKey;
  mode:'manual'|'catalogue';
  items?:CustomAchievementManualItem[];
  rule?:AchievementCatalogueRule;
};
