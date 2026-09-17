import { Link,useSearchParams } from 'react-router-dom';
import '../../auth.css';

const GOOGLE_SIGNIN_BUTTON='https://developers.google.com/static/identity/images/branding_guideline_sample_lt_sq_lg.png';

export function LoginPage(){
  const [params]=useSearchParams(),invite=params.get('invitation');
  const target=`/api/auth/google/start${invite?`?invitation=${encodeURIComponent(invite)}`:''}`;
  return <main className="login-page"><section className="login-card"><p className="eyebrow">YOUR WINE JOURNAL</p><h1>Sign in to WineLog</h1><p>Use your Google account. New members need an invitation from the owner.</p><a className="google-signin" href={target} aria-label="Sign in with Google"><img src={GOOGLE_SIGNIN_BUTTON} alt="Sign in with Google" width="355" height="80" referrerPolicy="no-referrer"/></a>{params.get('error')&&<p role="alert">{params.get('error')}</p>}<p>Your journal is private until you choose friends to share with.</p><p className="login-legal"><Link to="/privacy">Privacy Policy</Link><span aria-hidden="true"> · </span><Link to="/terms">Terms of Service</Link></p></section></main>;
}
