import { Link,useSearchParams } from 'react-router-dom';
import '../../auth.css';

const GOOGLE_SIGNIN_BUTTON='https://developers.google.com/static/identity/images/branding_guideline_sample_lt_sq_lg.png';

export function LoginPage(){
  const [params]=useSearchParams(),error=params.get('error');
  const target='/api/auth/google/start';
  // Only known reasons are shown; the raw query text is never echoed, so a link cannot put its own words on this page.
  const problem=error==='full'?'WineLog is full right now, so new accounts can’t be created. Please try again later.':error==='suspended'?'This account has been suspended. Contact the WineLog owner if you think this is a mistake.':error?'Sign-in didn’t work. Please try again.':null;
  return <main className="login-page"><section className="login-card"><p className="eyebrow">YOUR WINE JOURNAL</p><h1>Sign in to WineLog</h1><p>Use your Google account. If you’re new, signing in creates your account.</p>{problem&&<p className="login-error" role="alert">{problem}</p>}<a className="google-signin" href={target} aria-label="Sign in with Google"><img src={GOOGLE_SIGNIN_BUTTON} alt="Sign in with Google" width="355" height="80" referrerPolicy="no-referrer"/></a><p>Your journal is private until you choose friends to share with.</p><p className="login-legal"><Link to="/privacy">Privacy Policy</Link><span aria-hidden="true"> · </span><Link to="/terms">Terms of Service</Link></p></section></main>;
}
