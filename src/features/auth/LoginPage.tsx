import { useSearchParams } from 'react-router-dom';
import '../../auth.css';

export function LoginPage(){
  const [params]=useSearchParams(),invite=params.get('invitation');
  const target=`/api/auth/google/start${invite?`?invitation=${encodeURIComponent(invite)}`:''}`;
  return <main className="login-page"><section className="login-card"><p className="eyebrow">YOUR WINE JOURNAL</p><h1>Sign in to WineLog</h1><p>Use your Google account. New members need an invitation from the owner.</p><a className="wide-action primary" href={target}>Continue with Google</a>{params.get('error')&&<p role="alert">{params.get('error')}</p>}<p>Your journal is private until you choose friends to share with.</p></section></main>;
}
