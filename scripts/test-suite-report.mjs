import { readFileSync } from 'node:fs';
import { basename,resolve } from 'node:path';
import process from 'node:process';
import console from 'node:console';

// Reporting only: these purpose labels NEVER select or skip tests in CI.
// Mixed files are counted once under their primary purpose; tags expose overlap.
const report=JSON.parse(readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
const sourceRoot=resolve(process.argv[3]??'.');
const inventory=report.testResults.map(result=>{
  const file=basename(result.name.replaceAll('\\','/'));
  const source=readFileSync(resolve(sourceRoot,'tests/unit',file),'utf8');
  const tags=[];
  if(/support\/(realD1|sqliteD1)/.test(source))tags.push('real SQLite');
  if(/R2Bucket|\/r2\/|referenceR2/.test(source))tags.push('R2 contract');
  if(/\bQueue\b|flushOutbox|claimDelivery|durableQueue/.test(source))tags.push('Queue contract');
  if(/\b(readFileSync|readdirSync)\b/.test(source))tags.push('file/source assertions');
  const purpose=/Migration|migrationSequence|schemaColumns/.test(file)?'Migration/regression'
    :/^(multiUser|ownerClaim|ownerCutover|accountSwitch|sessionCache|friendRequests|cellarIsolation|producerRangeAccess|memberAi|memberProducer|unpricedAi)/.test(file)?'Authorization/multi-user'
    :source.includes('@vitest-environment jsdom')?'UI/component'
    :tags.includes('real SQLite')?'D1 persistence/integration'
    :/from ['"].*worker\//.test(source)?'API/Worker integration/contracts'
    :/from ['"].*\/(recognition|research|usage|credits)\//.test(source)||/^(ai|gemini|vertex|grounding|recognition|batchRecognition|producerResearch|producerRange)/i.test(file)?'AI routing/research/recognition'
    :tags.includes('file/source assertions')&&!/from ['"].*(src|worker)\//.test(source)?'Source/config contracts'
    :'Fast unit/domain rules';
  return {file,purpose,tags,tests:result.assertionResults.length,ms:Math.round(result.endTime-result.startTime)};
});
const categories={};
for(const row of inventory){
  const category=categories[row.purpose]??={files:0,tests:0};
  category.files++;category.tests+=row.tests;
}
console.log(JSON.stringify({
  tests:report.numTotalTests,passed:report.numPassedTests,failed:report.numFailedTests,
  files:inventory.length,seconds:(Math.max(...report.testResults.map(result=>result.endTime))-report.startTime)/1000,
  categories,slowest:[...inventory].sort((a,b)=>b.ms-a.ms).slice(0,10),inventory,
},null,2));
