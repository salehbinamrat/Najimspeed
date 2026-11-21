'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const source = fs.readFileSync(path.join(root,'js/chap.md5.js'),'utf8');
const window = {};
vm.runInNewContext(source,{window, Math});
function expected(id, password, challenge) {
  return crypto.createHash('md5').update(Buffer.concat([
    Buffer.from([id]), Buffer.from(password,'utf8'), Buffer.from(challenge)
  ])).digest('hex');
}
test('HTTP-CHAP MD5 matches Node crypto with binary challenge',()=>{
  const challenge=Buffer.from([0xef,0x0d,0xd8,0x0b,0x11,0x9c,0x65,0xa5,0xc3,0xab,0x62,0xa6,0x5b,0x7d,0xfd,0xce]);
  const a=window.NajmChap.response('%F9', [...challenge].map(b=>'%'+b.toString(16).padStart(2,'0')).join(''), '123456');
  assert.equal(a,expected(0xf9,'123456',challenge));
});
test('does not treat challenge octets as UTF-8 (supports RouterOS octal strings)',()=>{
  const challenge=Buffer.from([...Array(16).keys()].map(x=>x*17));
  const a=window.NajmChap.response('\\371', [...challenge].map(b=>'\\'+b.toString(8).padStart(3,'0')).join(''), '');
  assert.equal(a,expected(0xf9,'',challenge));
});
test('password UTF-8 bytes match the MD5 specification',()=>{
  const challenge=Buffer.alloc(16,0x80);
  assert.equal(window.NajmChap.response('%00','%80'.repeat(16),'اختبار١'), expected(0,'اختبار١',challenge));
});
test('rejects a malformed challenge rather than sending credentials as plaintext',()=>{
  assert.equal(window.NajmChap.response('', '%12'.repeat(16), ''), null);
  assert.equal(window.NajmChap.response('%F9','%11'.repeat(15),''),null);
  assert.equal(window.NajmChap.response('%F9','bad%GG%22','123'),null);
});
test('MikroTik templates request new challenge only through /login',()=>{
  for (const name of ['login.html','flogin.html']) {
    const file=fs.readFileSync(path.join(root,name),'utf8');
    assert.match(file,/\$\(if var == "najmChap"\)/);
    assert.match(file,/\$\(if chap-id\)/);
    assert.match(file,/\$\(chap-id-esc\)/);
    assert.match(file,/\$\(chap-challenge-esc\)/);
  }
  const core=fs.readFileSync(path.join(root,'js/portal.core.js'),'utf8');
  assert.match(core,/\/login\?var=najmChap/);
  assert.match(core,/w\.NajmChap\.response/);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.indexOf('js/chap.md5.js') < html.indexOf('js/portal.core.js'));
});
test('card speeds and camera files are unchanged',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for (let [speed,port] of Object.entries({'najm-speed-2m':62021,'najm-speed-4m':62022,'najm-speed-10m':62023,'najm-speed-open':62024})) {
    assert.ok(html.includes(`'${speed}':${port}`));
  }
  assert.ok(fs.existsSync(path.join(root,'js/cam.najm.js')));
});
