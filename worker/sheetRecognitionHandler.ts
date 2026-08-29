import { parseSheetPage,type SheetPage } from '../src/features/recognition/sheetSchema';
import { sheetRecognitionResponseJsonSchema,PLACE_LEVEL_RULE,RECOGNITION_MODEL } from '../src/lib/recognition/geminiRequest';
import type { RecognitionModeSpec } from './visionRecognition';

const MAX_SHEET_IMAGE_BYTES=3*1024*1024;

/**
 * A trade tasting list runs to a hundred wines or more, so this asks for far
 * more output than a group photo: eighty rows at roughly a hundred tokens each
 * needs room the group mode's 8192 does not have, and a response cut off
 * mid-array loses the tail without saying so.
 *
 * Even this is a per-page budget, not a per-sheet one - a long list is several
 * calls, one per photographed page.
 */
const MAX_SHEET_OUTPUT_TOKENS=32768;

/**
 * Escalation is deliberately narrower than the group photo's.
 *
 * A list with no prices on it is an ordinary list, not a bad read, so nothing
 * here escalates on a missing price. What is worth a second, stronger look is a
 * page that produced nothing at all, or one where the model itself flagged
 * rows it could not resolve.
 */
export function sheetEscalationReasons(page:SheetPage){
  const reasons:string[]=[];
  if(!page.wines.length)reasons.push('no-wines');
  if(page.unresolvedCount>0)reasons.push('unresolved-wines');
  if(page.wines.some(wine=>wine.confidence<0.6))reasons.push('low-confidence');
  return reasons;
}

const continuation=(afterLine:number|null)=>afterLine
  ? ` IMPORTANT: this is a CONTINUATION of a page that was already partly read. Return ONLY wines printed AFTER line ${afterLine}. Do not repeat earlier wines. Keep lineNumber on the same scale as the first pass, counting from the top of the page.`
  : '';

export const sheetRecognitionSpec:RecognitionModeSpec<SheetPage>={
  kind:'scan_sheet',
  mode:'sheet',
  label:'Wine list recognition',
  model:RECOGNITION_MODEL,
  maxBytes:MAX_SHEET_IMAGE_BYTES,
  maxOutputTokens:MAX_SHEET_OUTPUT_TOKENS,
  oneFileError:'Send one wine list page per request',
  jsonSchema:sheetRecognitionResponseJsonSchema,
  parse:parseSheetPage,
  escalationReasons:sheetEscalationReasons,
  wineCount:page=>page.wines.length,
  logFields:page=>({unresolvedCount:page.unresolvedCount,truncated:page.truncated}),
  prompt:(context,afterLine)=>`This is ONE PAGE of a PRINTED WINE LIST handed out at a wine tasting. It is a document, not a photograph of bottles. Read the printed text and return every wine listed on this page, in the order it is printed, top to bottom.

Each wine is normally one line or one short block carrying some of: producer, cuvée or wine name, vintage, appellation, and one or more prices. Producer and wineName are identity-critical and must come from the printed text; never fill or substitute them from general wine knowledge. If a line is too damaged or ambiguous to yield a producer and a wine name, omit it and increment unresolvedCount rather than guessing.

Section headings such as "FLIGHT 2 - COTE DE NUITS", "WHITES", "SPARKLING" or a producer's name used as a heading over several of its wines are NOT wines. Do not return a heading as a wine. Instead, put the heading a wine sits under into that wine's section field. A producer named only in a heading DOES apply to the wines beneath it: use it as their producer.

lineNumber is the wine's 1-based position down this page, counting only wines. Set it on every wine.

PRICES. Return every price printed against a wine in priceOptions, in the order printed. Never invent a price that is not printed: a wine with no price on the sheet gets an empty priceOptions array. Where a line prints more than one number - bottle and glass, member and list, "from" and "to" - return each with a short label taken from the sheet ("bottle", "glass", "member"). Where only one number is printed, return it with a null label. Strip currency symbols, thousands separators and any per-unit wording from amount; amount is a plain number. Do not include vintages, scores, bottle sizes, case quantities or allocation numbers as prices.

CURRENCY. Report ONE currency for the whole page in the currency field, as a three-letter ISO 4217 code read from the symbols or codes printed on it (HK$ or $ beside a Hong Kong venue is HKD, £ is GBP, € is EUR, ¥ may be JPY or CNY - use the surrounding text to decide). Use null if no currency can be determined. Do not put a currency on individual wines.

Vintage must be a JSON integer such as 2019, never a quoted string. Use null for non-vintage, multi-vintage, an edition or release code, or unreadable; MV20, 173eme Edition and 90-21 are release identifiers, not vintages. After the printed identity is established, high-confidence canonical country, region, appellation, grapes and broad style may be filled from general wine knowledge. ${PLACE_LEVEL_RULE} Style must be one of red, white, rose, sparkling, dessert, fortified, orange, other. Blend percentages only when explicitly printed. Do not return tasting notes, scores or producer history.

Confidence is 0 to 1 for how clearly this wine's identity is printed on the page.

TRUNCATION. If this page lists more wines than you can return, return as many as you can IN PRINTED ORDER from the top, set truncated to true, and set lastLineNumber to the lineNumber of the last wine you returned. Never silently stop: a partial page that claims to be complete is worse than one that says it is partial. Set truncated to false and lastLineNumber to the last wine's line number when you did read the whole page.${continuation(afterLine)}

Return ONLY valid JSON. Do not use Markdown fences. Do not return a top-level array. ${context}`
};
