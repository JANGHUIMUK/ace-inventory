// Only this loader is hosted on GitHub. Authenticated UI and records stay on the local server.
const backend='https://cortex-quartet-armless.ngrok-free.dev';
const nativeFetch=window.fetch.bind(window),storageKey='ace-web-session-v1',verifierKey='ace-web-verifier-v1';
let token=sessionStorage.getItem(storageKey)||'';
const error=document.querySelector('#error'),status=document.querySelector('#status');
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
async function signIn(){
 const verifier=encode(crypto.getRandomValues(new Uint8Array(48)));
 sessionStorage.setItem(verifierKey,verifier);
 const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 location.assign(backend+'/auth/feishu/start?client=pages&challenge='+challenge);
}
document.querySelector('#login').onclick=()=>signIn().catch(showError);
document.querySelector('#retry').onclick=()=>location.reload();
function showError(e){error.textContent=e.message||'连接失败，请稍后重试';document.querySelector('#retry').hidden=false;status.textContent='请确认本机库管系统已启动并保持联网。';}
async function api(path,options={}){
 const headers=new Headers(options.headers);headers.set('ngrok-skip-browser-warning','1');
 if(token)headers.set('Authorization','Bearer '+token);
 return nativeFetch(backend+path,{...options,headers,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
}
async function load(){
 const ticket=new URLSearchParams(location.hash.slice(1)).get('login_ticket');
 if(ticket){
  history.replaceState(null,'',location.pathname+location.search);
  const verifier=sessionStorage.getItem(verifierKey);sessionStorage.removeItem(verifierKey);
  if(!verifier)throw Error('登录验证已失效，请重新点击飞书登录。');
  status.textContent='正在完成飞书登录…';
  const response=await api('/auth/web/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket,verifier})});
  if(!response.ok)throw Error('登录验证已过期，请重新点击飞书登录。');
  token=(await response.json()).token;sessionStorage.setItem(storageKey,token);
 }
 if(!token)return;
 status.textContent='正在连接库管系统…';
 const response=await api('/api/frontend');
 if(response.status===401){sessionStorage.removeItem(storageKey);token='';status.textContent='登录已过期，请重新登录。';return;}
 if(!response.ok)throw Error('服务器连接失败，请确认本机已启动。');
 const bundle=await response.json();
 // Route API calls to the local backend without cross-site cookies.
 window.fetch=(input,options={})=>{
  if(typeof input==='string'){
   const path=input.replace(/^\.\//,'');
   if(path.startsWith('/api/')||['real-inventory.json','real-device-details.json'].includes(path))return api(path.startsWith('/')?path:'/'+path,options);
  }
  return nativeFetch(input,options);
 };
 const doc=new DOMParser().parseFromString(bundle.html,'text/html');doc.querySelectorAll('script').forEach(s=>s.remove());
 document.body.innerHTML=doc.body.innerHTML;
 const style=document.createElement('style');style.textContent=bundle.css+'\nbutton[hidden],a[hidden]{display:none!important}';document.head.append(style);
 const signOut=()=>{sessionStorage.removeItem(storageKey);sessionStorage.removeItem(verifierKey);location.replace(location.pathname);};
 document.addEventListener('submit',e=>{if(e.target.id==='identity-logout'){e.preventDefault();signOut();}},true);
 // Never persist inventory records in GitHub-origin storage.
 const app='const localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};\n'+bundle.app;
 const moduleUrl=source=>URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
 const stock=moduleUrl(bundle.stock),core=moduleUrl(bundle.core.replaceAll("'./stock-import.js'",JSON.stringify(stock)));
 const appUrl=moduleUrl(app.replaceAll("'./stock-import.js'",JSON.stringify(stock)).replaceAll("'./core.js'",JSON.stringify(core)));
 await import(appUrl);
 for(const url of [stock,core,appUrl])URL.revokeObjectURL(url);
}
load().catch(showError);
