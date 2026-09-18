import { describe,expect,it } from 'vitest';
import { parseRecognition } from '../../src/features/recognition/schema';
import { parseGroupRecognition } from '../../src/features/recognition/groupSchema';
import { parseSheetPage,sheetIdentityKey } from '../../src/features/recognition/sheetSchema';

describe('standard recognition identity fields',()=>{
 it('separates non-vintage from an unreadable vintage',()=>{
  const nv=parseRecognition(JSON.stringify({producer:'Krug',wineName:'Grande Cuvée',vintage:null,recognizedVintageText:'171ème Édition',vintageKind:'non_vintage',releaseDesignation:'171ème Édition',grapes:[],grapeBlend:[],sparklingDetails:null,confidence:0.98}));
  const unknown=parseRecognition(JSON.stringify({producer:'Krug',wineName:'Grande Cuvée',vintage:null,grapes:[],grapeBlend:[],sparklingDetails:null,confidence:0.7}));
  expect(nv.vintageKind).toBe('non_vintage');expect(nv.releaseDesignation).toBe('171ème Édition');
  expect(unknown.vintageKind).toBe('unknown');
  expect(nv.recognizedProducer).toBe('Krug');expect(nv.recognizedWineName).toBe('Grande Cuvée');
 });
 it('keeps different NV editions distinct in group dedupe',()=>{
  const wine=(releaseDesignation:string)=>({producer:'Krug',wineName:'Grande Cuvée',vintage:null,recognizedVintageText:releaseDesignation,vintageKind:'non_vintage',releaseDesignation,country:'France',region:'Champagne',appellation:'Champagne',grapes:[],grapeBlend:[],style:'sparkling',alcoholPercentage:12,locationName:null,confidence:.95,boundingBox:{xMin:0,yMin:0,xMax:200,yMax:900}});
  const parsed=parseGroupRecognition(JSON.stringify({wines:[wine('170ème Édition'),{...wine('171ème Édition'),boundingBox:{xMin:300,yMin:0,xMax:500,yMax:900}}],unresolvedCount:0}));
  expect(parsed.wines).toHaveLength(2);
 });
 it('uses vintage kind and release in sheet identity',()=>{
  const base={producer:'Krug',wineName:'Grande Cuvée',vintage:null,vintageKind:'non_vintage' as const,releaseDesignation:'171ème Édition'};
  expect(sheetIdentityKey(base)).not.toBe(sheetIdentityKey({...base,releaseDesignation:'172ème Édition'}));
 });
 it('accepts the new fields on wine-list rows',()=>{
  const page=parseSheetPage(JSON.stringify({wines:[{producer:'Krug',wineName:'Grande Cuvée',vintage:null,recognizedVintageText:'171ème Édition',vintageKind:'non_vintage',releaseDesignation:'171ème Édition',country:'France',region:'Champagne',appellation:'Champagne',grapes:[],grapeBlend:[],style:'sparkling',alcoholPercentage:12,priceOptions:[],section:null,lineNumber:1,confidence:.9}],currency:'HKD',unresolvedCount:0,truncated:false,lastLineNumber:1}));
  expect(page.wines[0].releaseDesignation).toBe('171ème Édition');
 });
});
