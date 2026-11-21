'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/chap.md5.js'), 'utf8'), {window, Math});
const challenge = Buffer.from([0xef,0x0d,0xd8,0x0b,0x11,0x9c,0x65,0xa5,0xc3,0xab,0x62,0xa6,0x5b,0x7d,0xfd,0xce]);
const id = 0xf9;
function md5(password) {
  return crypto.createHash('md5').update(Buffer.concat([Buffer.from([id]),Buffer.from(password, 'utf8'),challenge])).digest('hex');
}
function oct(n) {return n.toString(8).padStart(3, '0');}
const raw = [...challenge].map(b => '\\'+oct(b)).join('');
const escaped = [...challenge].map(b => '%5C'+oct(b)).join('');
const hex = [...challenge].map(b => '%'+b.toString(16).padStart(2,'0')).join('');
test('RouterOS native octal challenge matches expected MD5', () => {
  assert.equal(window.NajmChap.response('\\371', raw, ''), md5(''));
});
test('RouterOS URL-escaped octal challenge (reported error) is decoded', () => {
  assert.equal(window.NajmChap.response('%5C371', escaped, ''), md5(''));
  assert.equal(window.NajmChap.response('%5c371', escaped.toLowerCase(), '202020'), md5('202020'));
});
test('direct hexadecimal escaped bytes remain compatible', () => {
  assert.equal(window.NajmChap.response('%F9', hex, ''), md5(''));
});
test('fully percent-escaped ASCII octal digits remain compatible', () => {
  const encode = s => [...s].map(c => '%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
  assert.equal(window.NajmChap.response(encode('\\371'), encode(raw), ''), md5(''));
});
test('malformed and overlong CHAP data are rejected before POST', () => {
  for (const s of ['%5C378','%5C400','%5C3','%5CZ99','%GG','%5C','\\999','\u0100']) {
    assert.equal(window.NajmChap.response(s, escaped, ''), null, s);
  }
  assert.equal(window.NajmChap.response('%5C371', escaped.slice(0,-6), ''), null);
  assert.equal(window.NajmChap.response('%5C371', escaped+'%5C000', ''), null);
});
test('modified page cache bust and camera untouched', () => {
  const index = fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(index,/js\/chap\.md5\.js\?v=chap-20261121-octalfix1/);
  assert.ok(index.includes("'najm-speed-2m':62021"));
  assert.ok(index.includes("'najm-speed-4m':62022"));
  assert.ok(index.includes("'najm-speed-10m':62023"));
  assert.ok(index.includes("'najm-speed-open':62024"));
  const camera = fs.readFileSync(path.join(root,'js/cam.najm.js'));
  const gitHash = crypto.createHash('sha1').update(Buffer.from('blob '+camera.length+'\0')).update(camera).digest('hex');
  assert.equal(gitHash,'f25686596253f2b693b09c39e814fa767043fa46');
});
