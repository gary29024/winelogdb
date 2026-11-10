import '../loadError.css';

import { loadFailureReason } from './loadFailureReason';

type LoadErrorProps={
  /** The error as caught, or the message already taken from it. */
  error:unknown;
  /** Shown when the error carries no message of its own. */
  fallback:string;
  /** Omitted where trying again cannot help, such as a record that is gone. */
  onRetry?:()=>void;
  retrying?:boolean;
};

export function LoadError({error,fallback,onRetry,retrying=false}:LoadErrorProps){
  return <div className="load-error" role="alert">
    <p>{loadFailureReason(error,fallback)}</p>
    {onRetry&&<button type="button" className="load-error-retry" disabled={retrying} onClick={onRetry}>{retrying?'Trying again…':'Try again'}</button>}
  </div>;
}
