import type { VintageWindow } from './vintageWindow';

export type VintageResearchStatus={
  id:string;
  status:'queued'|'running'|'complete'|'failed';
  window:VintageWindow|null;
  error:string|null;
  /** Original queue time, so a reopened panel can resume the same elapsed clock. */
  createdAt?:string;
};
