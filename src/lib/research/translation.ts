import { z } from 'zod';

/**
 * Reading research in another language.
 *
 * A translation belongs to the exact English it was made from, not to a wine
 * or a producer: it is filed under a hash of that English (and of the prompt
 * version), so a re-run Deep Search that rewrites a section simply stops
 * matching its old translation instead of showing stale Chinese beside new
 * English. Keying on the text also means anyone who can already read the
 * English - a friend a wine is shared with - can read its translation without
 * a second permission check, because the hash reveals nothing they do not have.
 */
export const TRANSLATION_LANGS=['zh-Hant-HK'] as const;
export type TranslationLang=typeof TRANSLATION_LANGS[number];

/** Bumped when the prompt changes, so old translations are redone rather than reused. */
export const TRANSLATION_PROMPT_VERSION='v1';

const MAX_FIELD_CHARS=6000,MAX_TOTAL_CHARS=40000,MAX_FIELDS=12;

export const translationRequestSchema=z.object({
 lang:z.enum(TRANSLATION_LANGS),
 fields:z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,63}$/),z.string().max(MAX_FIELD_CHARS))
}).transform(value=>{
 const fields:Record<string,string>={};
 for(const [key,text] of Object.entries(value.fields)){const trimmed=text.trim();if(trimmed)fields[key]=trimmed}
 return {lang:value.lang,fields};
}).refine(value=>Object.keys(value.fields).length>0,'Nothing to translate')
 .refine(value=>Object.keys(value.fields).length<=MAX_FIELDS,'Too many sections to translate at once')
 .refine(value=>Object.values(value.fields).reduce((sum,text)=>sum+text.length,0)<=MAX_TOTAL_CHARS,'This research is too long to translate at once');
export type TranslationRequest=z.output<typeof translationRequestSchema>;

/** Field order does not change the text, so it must not change the key. */
export async function translationSourceHash(lang:TranslationLang,fields:Record<string,string>){
 const canonical=JSON.stringify([TRANSLATION_PROMPT_VERSION,lang,Object.entries(fields).sort(([a],[b])=>a<b?-1:a>b?1:0)]);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function translationPrompt(fields:Record<string,string>){
 return `Translate this wine research from English into Traditional Chinese as written in Hong Kong (繁體中文, Hong Kong wine-trade usage, e.g. 布根地 for Burgundy).

Rules:
- Translate every field completely and faithfully. Do not summarise, add, drop or soften facts, numbers, dates, percentages, negations or uncertainty ("may", "reportedly").
- After the Chinese for each grape variety, place, appellation, vineyard, classification and winemaking term, put the original English in brackets the first time it appears in a field, e.g. 黑皮諾 (Pinot Noir), 特級園 (Grand Cru), 蘋果酸乳酸發酵 (malolactic fermentation), 整串發酵 (whole-cluster fermentation). Later mentions in the same field can use the Chinese alone.
- Keep producer names, wine/cuvée names, people's names and domaine names exactly as written in English. Do not translate or transliterate them, and do not add Chinese to them.
- Keep line breaks, and keep lines that start with "- " or "• " as bullet lines starting with "- ".
- Use full-width Chinese punctuation in Chinese sentences.
- Return a JSON object with exactly the same keys as the input and the translated text as each value.

Input:
${JSON.stringify(fields)}`;
}

export function translationResponseJsonSchema(keys:string[]){
 return {type:'object',properties:Object.fromEntries(keys.map(key=>[key,{type:'string'}])),required:keys,additionalProperties:false};
}

/** A reply missing a section, or with an empty one, is not a translation of this research. */
export function readTranslationReply(text:string,keys:string[]):Record<string,string>|null{
 let parsed:unknown;
 try{parsed=JSON.parse(text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''))}catch{return null}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return null;
 const record=parsed as Record<string,unknown>,out:Record<string,string>={};
 for(const key of keys){const value=record[key];if(typeof value!=='string'||!value.trim())return null;out[key]=value.trim()}
 return out;
}
