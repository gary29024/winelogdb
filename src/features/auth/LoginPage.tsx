import { useState,type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../lib/auth/client';
import '../../auth.css';

export function LoginPage(){
  const nav=useNavigate();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');
    const fd=new FormData(e.currentTarget);
    try{await login(String(fd.get('password')||''));nav('/',{replace:true})}
    catch(e){setError((e as Error).message);setBusy(false)}
  }
  return <main className="login-page"><section className="login-card"><p className="eyebrow">PRIVATE WINE JOURNAL</p><h1>Sign in to WineLog</h1><p>Enter the private app password configured in Cloudflare.</p><form onSubmit={submit}><label>Password<input name="password" type="password" autoComplete="current-password" required autoFocus/></label>{error&&<p role="alert" className="login-error">{error}</p>}<button className="wide-action" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form></section></main>
}
