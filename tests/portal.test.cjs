'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const source = read('js/portal.core.js');
const win = {PORTAL_CONFIG:{site:'najm',passwordRequired:false}};
const doc = {readyState:'loading',addEventListener:()=>{}};
vm.runInNewContext(source,{window:win,document:doc,setTimeout,clearTimeout,XMLHttpRequest:function(){},Image:function(){}},{filename:'portal.core.js'});
const diag=win.PortalDiagnostics;
const classify=s=>diag.classifyHotspotError(s,false);
test('classifies confirmed MikroTik messages without inventing a cause',()=>{
  assert.equal(classify('user not found').code,'USER_NOT_FOUND');
  assert.equal(classify('already logged in').code,'SESSION_LIMIT');
  assert.equal(classify('transfer limit reached').code,'DATA_LIMIT');
  assert.equal(classify('uptime limit').code,'TIME_LIMIT');
  assert.equal(classify('account expired').code,'EXPIRED');
  assert.equal(classify('Radius server is not responding').code,'AUTH_SERVER_UNAVAILABLE');
  assert.equal(classify('no valid profile').code,'NO_VALID_PROFILE');
  assert.equal(classify('RADIUS reject').code,'AUTH_REJECTED');
  assert.match(classify('RADIUS reject').message,/خادم المصادقة/);
  assert.equal(classify('unrecognized router response').code,'UNKNOWN');
  assert.match(classify('unrecognized router response').message,/تعذر تحديد سبب/);
});
test('decodes percent escapes, plus and Arabic messages',()=>{
  assert.equal(classify('user+not+found').code,'USER_NOT_FOUND');
  assert.equal(classify('user%20not%20found').code,'USER_NOT_FOUND');
  assert.equal(classify('الكرت مستخدم على جهاز آخر').code,'SESSION_LIMIT');
  assert.equal(classify('%D8%A7%D9%86%D8%AA%D9%87%D9%89+%D8%A7%D9%84%D8%B1%D8%B5%D9%8A%D8%AF').code,'NO_CREDIT');
});
test('normalizes card numbers while keeping ASCII input',()=>{
  assert.equal(diag.normalize('٠١٢۳۴٥٦ ٧٨٩',true),'0123456789');
  assert.equal(diag.normalize('A B 123',true),'AB123');
});
test('preserves every original speed selector and signal port',()=>{
  const html=read('index.html');
  for(const [speed,port] of Object.entries({'najm-speed-2m':62021,'najm-speed-4m':62022,'najm-speed-10m':62023,'najm-speed-open':62024})){
    assert.ok(html.includes('value="'+speed+'"'));
    assert.ok(html.includes("'"+speed+"':"+port));
  }
  assert.ok(html.includes('value="hotspot"'));
  assert.ok(source.includes("body += '&domain='"));
  assert.ok(source.includes("'/najm-speed.gif?t='"));
});
test('keeps MikroTik templates and error handoff intact',()=>{
  const html=read('index.html');
  assert.ok(html.includes('action="$(link-login-only)"'));
  assert.ok(html.includes('name="username"'));
  for(const name of ['login.html','flogin.html']){
    const data=read(name);
    assert.ok(data.includes('$(error-orig-esc)'));
    assert.ok(data.includes('"action":"onLoginError"'));
    assert.ok(data.includes('encodeURIComponent(error)'));
  }
  assert.ok(read('status.html').includes('"action":"onStatusQuery"'));
  assert.ok(read('alogin.html').includes('"action":"onLoggedIn"'));
  assert.ok(read('logout.html').includes('"action":"onLoggedOut"'));
});
test('keeps assets and legacy logo fallback complete',()=>{
  for(const name of ['css/style.css','font/Almarai.woff2','font/fontello-used.woff','img/najm-logo.webp','img/najm-logo.png','js/portal.core.js','js/cam.najm.js'])
    assert.ok(fs.statSync(path.join(root,name)).size>0);
  const html=read('index.html');
  assert.ok(html.includes('<picture class="brand-picture">'));
  assert.ok(html.includes('src="img/najm-logo.png"'));
});
