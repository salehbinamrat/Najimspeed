'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(root,'js/chap.md5.js'),'utf8');
const window={};
vm.runInNewContext(code,{window,Math});
const bytes=Buffer.from([0xef,0x0d,0xd8,0x0b,0x11,0x9c,0x65,0xa5,0xc3,0xab,0x62,0xa6,0x5b,0x7d,0xfd,0xce]);
function expected(pass){return crypto.createHash('md5').update(Buffer.concat([Buffer.from([0xf9]),Buffer.from(pass,'utf8'),bytes])).digest('hex');}
test('canonical RouterOS raw octal-unescaped JS CHAP is byte accurate',()=>{
  const raw=String.fromCharCode(...bytes);
  assert.equal(window.NajmChap.responseRaw(String.fromCharCode(0xf9),raw,''),expected(''));
  assert.equal(window.NajmChap.responseRaw(String.fromCharCode(0xf9),raw,'اختبار'),expected('اختبار'));
});
test('native raw response fails closed on missing, malformed or Unicode nonce',()=>{
  assert.equal(window.NajmChap.responseRaw('','1234567890123456',''),null);
  assert.equal(window.NajmChap.responseRaw(String.fromCharCode(0xf9),'short',''),null);
  assert.equal(window.NajmChap.responseRaw(String.fromCharCode(0xf9),'𐍈'.repeat(8),''),null);
});
test('doubly escaped octal markers do not cause avoidable rejection',()=>{
  const oct=Array.from(bytes,b=>'%5C%5C'+b.toString(8).padStart(3,'0')).join('');
  assert.equal(window.NajmChap.response('%5C%5C371',oct,''),expected(''));
});
test('native MikroTik fallback is a real CHAP form, not plaintext downgrade',()=>{
  for(const name of ['login.html','flogin.html']){
    const source=fs.readFileSync(path.join(root,name),'utf8');
    assert.match(source,/\$\(if var == "najmNative"\)/);
    assert.match(source,/\$\(if chap-id\)/);
    assert.match(source,/responseRaw\('\$\(chap-id\)','\$\(chap-challenge\)'/);
    assert.match(source,/action="\$\(link-login-only\)"/);
    assert.match(source,/name="domain"/);
    assert.match(source,/name="password" type="hidden"/);
    assert.match(source,/sessionStorage\.removeItem\('najm_native_login_v1'\)/);
    const count=s=>(source.match(new RegExp(s,'g'))||[]).length;
    assert.equal(count('\\$\\(if '),count('\\$\\(endif\\)'));
  }
  const core=fs.readFileSync(path.join(root,'js/portal.core.js'),'utf8');
  assert.match(core,/w\.location\.href\s*=\s*'\/login\?var=najmNative'/);
  assert.match(core,/storageSet\(safeSession\(\), 'najm_native_login_v1'/);
  assert.match(core,/never send plaintext|Never send plaintext/);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/js\/chap\.md5\.js\?v=chap-native-20261121-1/);
  assert.match(html,/js\/portal\.core\.js\?v=chap-native-20261121-1/);
  for(const [key,port] of Object.entries({'najm-speed-2m':62021,'najm-speed-4m':62022,'najm-speed-10m':62023,'najm-speed-open':62024})){
    assert.ok(html.includes(`'${key}':${port}`));
  }
});
