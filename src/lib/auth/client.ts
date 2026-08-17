export const getSession=()=>localStorage.getItem('session');
export const hasSession=()=>Boolean(getSession());
export const authHeaders=(json=false):Record<string,string>=>{
  const headers:Record<string,string>={};
  const session=getSession();
  if(session)headers.Authorization=`Bearer ${session}`;
  if(json)headers['Content-Type']='application/json';
  return headers;
};
export const clearSession=()=>localStorage.removeItem('session');

export async function login(password:string){
  const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
  const body=await r.json().catch(()=>({})) as {token?:string;error?:string};
  if(!r.ok||!body.token)throw new Error(body.error||'Login failed');
  localStorage.setItem('session',body.token);
}
