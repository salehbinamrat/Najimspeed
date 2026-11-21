'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const chap=fs.readFileSync(path.join(root,'js/chap.md5.js'),'utf8'),core=fs.readFileSync(path.join(root,'js/portal.core.js'),'utf8');
function setup(mode){
 const ts=new Set(),hooks={},nodes={}; let posts=0,lookups=0;
 const delay=(fn,ms)=>{let n=setTimeout(()=>{ts.delete(n);fn()},ms);ts.add(n);return n};
 const cancel=n=>{clearTimeout(n);ts.delete(n)};
 const node=()=>({className:'',textContent:'',value:'',style:{},disabled:false,addEventListener(){},querySelectorAll(){return []},setAttribute(){},focus(){}});
 for(const id of ['login','status','error','speedConfirmation','speed_choice','username','remain_bytes_total','session_time_left','uptime','bytes_in','bytes_out','gregorianDate','hijriDate'])nodes[id]=node();
 const username=node();username.value='202020';const form={username,addEventListener(n,fn){hooks[n]=fn}},submit=node();
 const radios=[{value:'hotspot',checked:true,addEventListener(){}}];
 const doc={readyState:'loading',hidden:false,body:node(),documentElement:node(),forms:{login:form},
 addEventListener(n,fn){hooks[n]=fn},getElementById:n=>nodes[n]||null,querySelector:s=>s==='.login-submit'?submit:null,querySelectorAll(){return []},getElementsByName(){return radios}};
 const storage={getItem(){return null},setItem(){},removeItem(){}};
 const win={PORTAL_CONFIG:{site:'najm',passwordRequired:false,cardPasswordMode:'empty'},
 location:{search:'',hostname:'router.test',protocol:'http:'},navigator:{userAgent:'Mozilla/5.0'},localStorage:storage,sessionStorage:storage,
 Image:function(){Object.defineProperty(this,'src',{set(){}})}};
 function XHR(){this.status=200;this.open=(m,u)=>{this.method=m;this.url=u};this.setRequestHeader=()=>{};
 this.send=()=>{if(this.method==='POST')posts++;delay(()=>{const u=this.url;
 if(u.indexOf('var=najmChap')>=0)this.responseText='{"action":"onChapChallenge","enabled":false}';
 else if(u.indexOf('/login?')>=0)this.responseText=mode==='reject'?'{"action":"onLoginError","error_orig":"user%20not%20found"}':'<html>redirect</html>';
 else if(u.indexOf('/status?')>=0){lookups++;let logged=posts>0&&mode!=='no',user=mode==='other'?'999999':'202020';
 this.responseText=JSON.stringify({action:'onStatusQuery',logged_in:logged?'yes':'no',username:logged?user:''});}
 this.readyState=4;if(this.onreadystatechange)this.onreadystatechange();},0)};
 this.abort=()=>{};
 }
 const context={window:win,document:doc,XMLHttpRequest:XHR,Image:win.Image,setTimeout:delay,clearTimeout:cancel};
 vm.runInNewContext(chap,context);vm.runInNewContext(core,context);hooks.DOMContentLoaded();
 return {go(){hooks.submit({preventDefault(){}})},get state(){return {posts,lookups,error:nodes.error.textContent,status:nodes.status.style.display,disabled:submit.disabled}},close(){for(const t of ts)clearTimeout(t)}};
}
for(const mode of ['html','other','no','reject'])test('Ambiguous POST login verification: '+mode,async()=>{
 const h=setup(mode);try{h.go();await new Promise(r=>setTimeout(r,mode==='html'||mode==='reject'?1200:2200));
 const s=h.state;assert.equal(s.posts,1,'POST must never repeat');
 if(mode==='html'){assert.equal(s.status,'block');assert.equal(s.error,'');assert.ok(s.lookups>=2);}
 else if(mode==='reject'){assert.match(s.error,/غير موجود/);assert.equal(s.lookups,1);}
 else{assert.notEqual(s.status,'block');assert.match(s.error,/تعذر تأكيد حالة الدخول/);assert.equal(s.disabled,false);}
 }finally{h.close()}
});
test('Native fallback, camera and speed profiles remain untouched',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(html.includes('js/portal.core.js?v=authverify-20261121-1'));
 for(const [v,p]of Object.entries({'najm-speed-2m':62021,'najm-speed-4m':62022,'najm-speed-10m':62023,'najm-speed-open':62024}))assert.ok(html.includes("'"+v+"':"+p));
 assert.match(fs.readFileSync(path.join(root,'login.html'),'utf8'),/\$\(if var == "najmNative"\)/);
});
