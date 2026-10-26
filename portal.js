// Only this loader is hosted on GitHub. Authenticated UI and records stay on the local server.
const backend='https://cortex-quartet-armless.ngrok-free.dev';
const nativeFetch=window.fetch.bind(window),storageKey='ace-web-session-v1',verifierKey='ace-web-verifier-v1';
let token=sessionStorage.getItem(storageKey)||'';
const error=document.querySelector('#error'),status=document.querySelector('#status');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const panel=document.querySelector('#login-panel');
let mode=new URLSearchParams(location.search).get('login')==='admin'?'admin':'employee',registrationEnabled=false,feishuRegistrationEnabled=false;
function showError(e){const target=document.querySelector('#error');if(target)target.textContent=e.message||'连接失败，请确认本机服务已启动';}
async function jsonApi(path,input){const response=await api(path,input===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});let value;try{value=await response.json();}catch{throw Error('后台暂不可用，请确认本机服务和公网连接已启动');}if(!response.ok){const e=Error(value.error||'请求失败');e.code=value.code;throw e;}return value;}
function loginForm(change=false){
 panel.innerHTML=`<div class="logo">a</div><h1>${mode==='admin'?'管理员登录':'员工账号登录'}</h1><p>账号和密码在此页面验证，无需飞书授权。</p><p id="error" role="alert"></p><form id="portal-login"><label>账号<input name="username" autocomplete="username" required maxlength="80"></label><label>${change?'临时密码':'密码'}<input type="password" name="password" autocomplete="current-password" required maxlength="128"></label>${change?'<label>新密码<input type="password" name="newPassword" minlength="12" maxlength="128" autocomplete="new-password" required></label><label>确认新密码<input type="password" name="confirmPassword" minlength="12" maxlength="128" required></label>':''}<button>登录</button></form><button class="secondary" id="switch-mode">${mode==='admin'?'返回员工登录':'管理员维护'}</button>${mode==='employee'?'<button class="secondary" id="name-register">首次使用：填写姓名生成账号</button>':''}${mode==='employee'&&registrationEnabled?'<button class="secondary" id="register">首次使用：公司邮箱开通</button>':''}<p><small>忘记密码请联系 JANGHUIMUK。</small></p>`;
 document.querySelector('#switch-mode').onclick=()=>{mode=mode==='admin'?'employee':'admin';loginForm();};
 const nameRegister=document.querySelector('#name-register');if(nameRegister)nameRegister.onclick=nameRegistrationForm;
 const feishu=document.querySelector('#feishu-register');if(feishu)feishu.onclick=()=>void startFeishu().catch(showError);
 const register=document.querySelector('#register');if(register)register.onclick=registerForm;
 document.querySelector('#portal-login').onsubmit=async e=>{e.preventDefault();const form=e.target,button=form.querySelector('button');button.disabled=true;const input=Object.fromEntries(new FormData(form));
 try{if(change&&input.newPassword!==input.confirmPassword)throw Error('两次新密码不一致');const value=await jsonApi('/api/portal/login',{...input,mode});token=value.token;sessionStorage.setItem(storageKey,token);location.reload();}catch(err){if(err.code==='PASSWORD_CHANGE_REQUIRED'){loginForm(true);document.querySelector('[name="username"]').value=input.username;}showError(err);}finally{button.disabled=false;}};
}
function nameRegistrationForm(){
 panel.innerHTML=`<h1>生成员工账号</h1><p>填写姓名并设置密码，无需邮箱或飞书授权。账号由 JANGHUIMUK 确认启用；姓名不是已验证的飞书身份。</p><p id="error" role="alert"></p><form id="name-registration"><label>姓名（与公司飞书显示名称一致）<input name="name" required maxlength="50" autocomplete="name"></label><label>设置密码<input type="password" name="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><label>确认密码<input type="password" name="confirmPassword" minlength="12" maxlength="128" autocomplete="new-password" required></label><button>生成账号</button></form><button class="secondary" id="back-login">返回登录</button>`;
 document.querySelector('#back-login').onclick=()=>loginForm();
 document.querySelector('#name-registration').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const result=await jsonApi('/api/portal/register-name',Object.fromEntries(new FormData(e.target)));panel.innerHTML=`<h1>账号已生成</h1><p>请保存下方登录账号，联系 JANGHUIMUK 确认启用后即可使用。飞书通知由管理员核对并绑定。</p><input readonly aria-label="登录账号" value="${esc(result.username)}"><button id="return-login">返回登录</button>`;document.querySelector('#return-login').onclick=()=>{loginForm();document.querySelector('[name="username"]').value=result.username;};}catch(err){showError(err);}finally{button.disabled=false;}};
}
async function startFeishu(){
 const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
 const verifier=encode(crypto.getRandomValues(new Uint8Array(48)));sessionStorage.setItem(verifierKey,verifier);
 const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 location.assign(backend+'/auth/feishu/start?via=feishu&client=pages&challenge='+challenge);
}
function activateFeishu(actor){
 panel.innerHTML=`<h1>飞书身份已验证</h1><p>${esc(actor.name)}，已生成你的内部员工 ID。设置密码后，以后可以直接用此 ID 登录。</p><label>员工账号<input readonly value="${esc(actor.employeeId?.toLowerCase()||'')}" aria-label="员工账号"></label><p id="error" role="alert"></p><form id="activate-feishu"><label>设置登录密码<input type="password" name="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><label>确认密码<input type="password" name="confirmPassword" minlength="12" maxlength="128" autocomplete="new-password" required></label><button>开通普通账号</button></form>`;
 document.querySelector('#activate-feishu').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const value=await jsonApi('/api/portal/activate',Object.fromEntries(new FormData(e.target)));token=value.token;sessionStorage.setItem(storageKey,token);panel.innerHTML=`<h1>账号已开通</h1><p>请保存登录账号；以后无需飞书授权，可直接使用账号和密码登录。</p><input readonly value="${esc(value.username)}" aria-label="登录账号"><button id="enter-system">进入系统</button>`;document.querySelector('#enter-system').onclick=()=>location.replace(location.pathname);}catch(err){showError(err);}finally{button.disabled=false;}};
}
function registerForm(){
 panel.innerHTML=`<h1>公司邮箱开通</h1><p>验证公司邮箱后创建普通员工账号。</p><p id="error" role="alert"></p><p id="notice" role="status"></p><form id="registration"><label>公司邮箱<input type="email" name="email" required maxlength="80" placeholder="员工@acerobotics.com"></label><button type="button" id="send-code">发送验证码</button><label>姓名<input name="name" required maxlength="60"></label><label>验证码<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code"></label><label>设置密码<input name="password" type="password" minlength="12" maxlength="128" required autocomplete="new-password"></label><label>确认密码<input name="confirmPassword" type="password" minlength="12" maxlength="128" required></label><button>验证并开通</button></form><button class="secondary" id="back-login">返回登录</button>`;
 document.querySelector('#back-login').onclick=()=>loginForm();
 document.querySelector('#send-code').onclick=async e=>{e.target.disabled=true;try{const value=await jsonApi('/api/portal/register-code',{email:document.querySelector('[name="email"]').value});document.querySelector('#notice').textContent=value.message;}catch(err){showError(err);}finally{e.target.disabled=false;}};
 document.querySelector('#registration').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button[type!="button"]')||e.target.querySelector('button:last-child');button.disabled=true;try{const value=await jsonApi('/api/portal/register',Object.fromEntries(new FormData(e.target)));token=value.token;sessionStorage.setItem(storageKey,token);location.reload();}catch(err){showError(err);}finally{button.disabled=false;}};
}
async function manageAccounts(){
 let value;try{value=await jsonApi('/api/portal/accounts');}catch(err){if(/登录已过期/.test(err.message)){sessionStorage.removeItem(storageKey);token='';mode='admin';loginForm();}throw err;}panel.style.maxWidth='1100px';
 panel.innerHTML=`<h1>员工账号管理</h1><p>员工默认无管理员权限；飞书绑定仅用于通知。</p><p id="error" role="alert"></p><div id="result"></div><form id="create-account"><label>姓名<input name="name" required maxlength="60"></label><label>账号<input name="username" required minlength="3" maxlength="80"></label><button>创建员工账号</button></form><div class="table"><table><thead><tr><th>姓名 / 账号</th><th>状态</th><th>飞书通知绑定</th><th>操作</th></tr></thead><tbody>${value.accounts.map(a=>`<tr><td>${esc(a.name)}<br>${esc(a.username)}</td><td>${a.pendingApproval?'待确认启用':a.enabled?'启用':'停用'}${a.mustChangePassword?' · 待首次改密':''}</td><td><button data-search="${esc(a.id)}">按姓名查找飞书账号</button><div class="contact-candidates" data-for="${esc(a.id)}"></div><form data-id="${esc(a.id)}" class="bind-account"><input name="openId" value="${esc(a.feishuOpenId||'')}" placeholder="飞书 Open ID"><button>保存绑定</button></form></td><td><button data-id="${esc(a.id)}" data-action="${a.enabled?'disable':'enable'}">${a.pendingApproval?'确认并启用':a.enabled?'停用':'启用'}</button><button data-id="${esc(a.id)}" data-action="reset">重置密码</button></td></tr>`).join('')}</tbody></table></div><p><a href="${esc(location.pathname)}">返回库管系统</a></p>`;
 async function change(input){try{const result=await jsonApi('/api/portal/accounts',input);await manageAccounts();if(result.temporaryPassword){const box=document.querySelector('#result');const label=document.createElement('p');label.textContent=`${result.account.name} 的临时密码（仅本次显示，请单独交给本人）：`;const field=document.createElement('input');field.readOnly=true;field.value=result.temporaryPassword;box.append(label,field);}}catch(err){showError(err);}}
 document.querySelector('#create-account').onsubmit=e=>{e.preventDefault();void change({action:'create',...Object.fromEntries(new FormData(e.target))});};
 document.querySelectorAll('.bind-account').forEach(form=>form.onsubmit=e=>{e.preventDefault();void change({id:form.dataset.id,action:'bindFeishu',...Object.fromEntries(new FormData(form))});});
 document.querySelectorAll('[data-search]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{const value=await jsonApi('/api/portal/accounts',{action:'searchFeishu',id:button.dataset.search});const box=[...document.querySelectorAll('.contact-candidates')].find(e=>e.dataset.for===button.dataset.search);box.replaceChildren();if(!value.candidates.length)box.textContent='未找到公司内账号，请核对姓名或手动填写 Open ID。';for(const candidate of value.candidates){const choose=document.createElement('button');choose.textContent=[candidate.name,candidate.email,candidate.department].filter(Boolean).join(' · ')+'（选择绑定）';choose.onclick=()=>void change({id:button.dataset.search,action:'bindFeishu',openId:candidate.openId});box.append(choose);}}catch(err){showError(err);}finally{button.disabled=false;}});
 document.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>void change({id:button.dataset.id,action:button.dataset.action}));
}
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
  if(!verifier)throw Error('登录验证已失效，请重新点击员工账号登录。');
  status.textContent='正在完成员工账号登录…';
  const response=await api('/auth/web/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket,verifier})});
  if(!response.ok)throw Error('登录验证已过期，请重新点击员工账号登录。');
  token=(await response.json()).token;sessionStorage.setItem(storageKey,token);
 }
 if(!token){try{const options=await jsonApi('/api/portal/options');registrationEnabled=options.emailRegistration;feishuRegistrationEnabled=options.feishuRegistration;}catch{}loginForm();return;}
 const identityResponse=await api('/api/me');if(identityResponse.ok){const actor=await identityResponse.json();if(actor.provider==='feishu'&&actor.role!=='admin'){activateFeishu(actor);return;}}
 if(mode==='admin'){const me=await api('/api/me');if(!me.ok||(await me.json()).role!=='admin'){sessionStorage.removeItem(storageKey);token='';loginForm();return;}}
 if(new URLSearchParams(location.search).get('panel')==='accounts'){await manageAccounts();return;}
 status.textContent='正在连接库管系统…';
 const response=await api('/api/frontend');
 if(response.status===401){sessionStorage.removeItem(storageKey);token='';loginForm();showError(Error('登录已过期，请重新登录'));return;}
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
