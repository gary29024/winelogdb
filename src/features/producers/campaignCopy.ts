import type { ResearchCampaign,ResearchCampaignPlan } from './api';

export function formatDuration(ms:number){
  const minutes=Math.max(1,Math.round(ms/60000));
  if(minutes<60)return `${minutes} min`;
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return rest?`${hours}h ${rest}m`:`${hours}h`;
}

/**
 * What a batch run would cost, in the terms the person paying for it has:
 * how many producers, how many grounded Gemini requests that is, and how long
 * it will take at this library's own measured pace. Never an invented number -
 * with no completed runs to measure, the time is simply not claimed.
 */
export function planSummary(plan:ResearchCampaignPlan){
  const parts=[`${plan.willRun} producer${plan.willRun===1?'':'s'}`,`${plan.geminiRequests} grounded Gemini requests`];
  if(plan.estimatedMs!=null)parts.push(`about ${formatDuration(plan.estimatedMs)} at ${plan.concurrency} at a time`);
  return parts.join(' · ');
}

/** The one line that says where a finished or running campaign stands. */
export function campaignSummary(campaign:ResearchCampaign){
  const {complete,failed,running,pending,skipped}=campaign.counts;
  const done=complete+failed+skipped;
  if(campaign.status==='running')return `${done} of ${campaign.requested} done · ${running} running${pending?` · ${pending} waiting`:''}`;
  const parts=[`${complete} researched`];
  if(failed)parts.push(`${failed} failed`);
  if(skipped)parts.push(`${skipped} skipped`);
  return parts.join(' · ');
}

/** How a past run reads in the list of runs. */
export function campaignOutcomeLine(counts:Record<string,number>){
  const parts:string[]=[];
  if(counts.complete)parts.push(`${counts.complete} researched`);
  if(counts.failed)parts.push(`${counts.failed} failed`);
  if(counts.skipped)parts.push(`${counts.skipped} skipped`);
  const live=(counts.running??0)+(counts.pending??0);
  if(live)parts.push(`${live} still to go`);
  return parts.join(' · ')||'Nothing to do';
}
