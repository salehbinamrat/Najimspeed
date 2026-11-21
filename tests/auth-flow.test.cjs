'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root=path.join(__dirname,'..');
const chap=fs.readFileSync(path.join(root,'js/chap.md5.js'),'utf8');
const core=fs.readFileSync(path.join(root,'js/portal.core.js'),'utf8');
const raw='%EF%0D%D8%0B%11%9C%65%A5%C3%AB%62%A6%5B%7D%FD%CE';
function mock(mode) {
  const calls=[], signals=[], callbacks={}, elems={}, storage=new Map(), timers=new Set();
  const timer=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn()},ms);timers.add(id);return id};
  const untimer=id=>{clearTimeout(id);timers.delete(id)};
  const makeNode=() => ({style:{},className:'',textContent:'',value:'',disabled:false,addEventListener(){},setAttribute(){},querySelectorAll(){return []},focus(){}});
  for(const id of ['login','status','error','speedConfirmation','speed_choice','username','remain_bytes_total','session_time_left','uptime','bytes_in','bytes_out','gregorianDate','hijriDate']) elems[id]=makeNode();
  const username=makeNode();username.value='123456';
  const form={username,addEventListener:(type,fn)=>{callbacks[type]=fn}};
  const submit=makeNode();
  const radio=[{value:'hotspot',checked:false,addEventListener(){}},{value:'najm-speed-4m',checked:true,addEventListener(){}}];
  const doc={
    readyState:'loading',hidden:false,body:makeNode(),documentElement:makeNode(),forms:{login:form},
    addEventListener:(type,fn)=>{callbacks[type]=fn},
    getElementById:id=>elems[id]||null,
    querySelector:s=>s==='.login-submit'?submit:null,
    querySelectorAll:()=>[],getElementsByName:()=>radio
  };
  const local={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  const win={PORTAL_CONFIG:{site:'najm',passwordRequired:false,speedPorts:{'najm-speed-4m':62022},speedNames:{'hotspot':'افتراضية','najm-speed-4m':'متوسطة'}},
    location:{search:'',protocol:'http:',hostname:'hotspot.test'},navigator:{userAgent:'Mozilla/5.0'},localStorage:local,sessionStorage:local,
    Image:function(){Object.defineProperty(this,'src',{set:v=>signals.push(v)})}};
  function XHR() { const self=this; self.status=200;
    self.open=(method,url)=>{self.method=method;self.url=url};
    self.setRequestHeader=()=>{};
    self.send=body=>{
      calls.push({method:self.method,url:self.url,body});
      setTimeout(()=>{
        if(self.url.includes('var=najmChap')) self.responseText=JSON.stringify({action:'onChapChallenge',enabled:mode!=='pap',id:'%F9',challenge:mode==='invalid'?'%01':raw});
        else if(self.url.includes('var=callBack')) self.responseText=JSON.stringify({action:'onLoggedIn',logged_in:'yes'});
        else self.responseText=JSON.stringify({action:'onStatusQuery',logged_in:'no'});
        self.readyState=4;
        if(self.onreadystatechange) self.onreadystatechange();
      },0);
    };
    self.abort=()=>{};
  }
  const context={window:win,document:doc,XMLHttpRequest:XHR,Image:win.Image,setTimeout:timer,clearTimeout:untimer,console};
  vm.runInNewContext(chap,context,{filename:'chap.md5.js'});
  vm.runInNewContext(core,context,{filename:'portal.core.js'});
  callbacks.DOMContentLoaded();
  return {submit:()=>callbacks.submit({preventDefault(){}}), dispose:()=>{for(const id of timers) clearTimeout(id);timers.clear()}, calls,signals,elems,win};
}
for(const mode of ['pap','chap','invalid']) test('login request flow '+mode,async()=>{
  const h=mock(mode);h.submit();
  await new Promise(resolve=>setTimeout(resolve,820));
  const chal=h.calls.filter(c=>c.url.startsWith('/login?var=najmChap'));
  const post=h.calls.filter(c=>c.method==='POST');
  assert.equal(chal.length,1);
  assert.equal(post.length,mode==='invalid'?0:1);
  if(post.length){
    assert.match(post[0].body,/username=123456/);
    assert.match(post[0].body,/domain=najm-speed-4m/);
    if(mode==='chap'){
      const bytes=Buffer.from([0xef,0x0d,0xd8,0x0b,0x11,0x9c,0x65,0xa5,0xc3,0xab,0x62,0xa6,0x5b,0x7d,0xfd,0xce]);
      assert.ok(post[0].body.includes('password='+crypto.createHash('md5').update(Buffer.concat([Buffer.from([0xf9]),bytes])).digest('hex')));
    }else assert.ok(!post[0].body.includes('password='));
  }
  if(mode==='invalid') assert.match(h.elems.error.textContent,/تحدي المصادقة/);
  h.dispose();
});
