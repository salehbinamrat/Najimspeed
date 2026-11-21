/* Najm Net HTTP-CHAP helper. Dependency-free ES5 byte-exact MD5, RFC 1321.
   The router provides arbitrary challenge octets; do not decode them as UTF-8. */
(function (w) {
'use strict';
function bytesFromRouterEscaped(source) {
  /* RouterOS publishes CHAP bytes as octal strings (\\371, etc).
     $(chap-id-esc) URL-escapes the backslash: %5C371, not %F9.
     Decode URL escapes first and then RouterOS octal. Both forms are valid. */
  if (typeof source !== 'string' || !source || source.length > 1024) return null;
  var encoded = [], out = [], i = 0, ch, byte, oct;
  while (i < source.length) {
    ch = source.charAt(i);
    if (ch === '%') {
      if (!/^[0-9a-fA-F]{2}$/.test(source.substr(i + 1, 2))) return null;
      byte = parseInt(source.substr(i + 1, 2), 16); i += 3;
    } else if (ch === '+') { byte = 32; i++;
    } else {
      byte = source.charCodeAt(i++);
      if (byte < 32 || byte > 126) return null;
    }
    encoded.push(byte);
  }
  for (i = 0; i < encoded.length;) {
    if (encoded[i] === 92) {
      /* Some intermediary encoders double-escape the RouterOS octal slash. */
      if (encoded[i+1] === 92 && i+4 < encoded.length &&
          encoded[i+2] >= 48 && encoded[i+2] <= 55 &&
          encoded[i+3] >= 48 && encoded[i+3] <= 55 &&
          encoded[i+4] >= 48 && encoded[i+4] <= 55) i++;
      if (i + 3 >= encoded.length ||
          encoded[i+1] < 48 || encoded[i+1] > 55 ||
          encoded[i+2] < 48 || encoded[i+2] > 55 ||
          encoded[i+3] < 48 || encoded[i+3] > 55) return null;
      oct = (encoded[i+1]-48)*64 + (encoded[i+2]-48)*8 + encoded[i+3]-48;
      if (oct > 255) return null;
      out.push(oct); i += 4;
    } else { out.push(encoded[i]); i++; }
  }
  return out;
}
function utf8Bytes(value) {
  var out = [], i, n, next, cp;
  for (i = 0; i < value.length; i++) {
    n = value.charCodeAt(i);
    if (n < 0x80) out.push(n);
    else if (n < 0x800) { out.push(0xc0 | (n >> 6)); out.push(0x80 | (n & 63)); }
    else if (n >= 0xd800 && n <= 0xdbff && i + 1 < value.length &&
      (next = value.charCodeAt(i + 1)) >= 0xdc00 && next <= 0xdfff) {
      cp = 0x10000 + ((n - 0xd800) << 10) + (next - 0xdc00); i++;
      out.push(0xf0 | (cp >> 18)); out.push(0x80 | ((cp >> 12) & 63));
      out.push(0x80 | ((cp >> 6) & 63)); out.push(0x80 | (cp & 63));
    } else {
      out.push(0xe0 | (n >> 12)); out.push(0x80 | ((n >> 6) & 63)); out.push(0x80 | (n & 63));
    }
  }
  return out;
}
function md5(bytes) {
  var input = bytes.slice(0), bitlen = bytes.length * 8, a0 = 0x67452301,
    b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476,
    shifts = [7,12,17,22, 5,9,14,20, 4,11,16,23, 6,10,15,21],
    K = [], i, j, block, M, a, b, c, d, f, g, tmp, n, v, out = '';
  input.push(128);
  while ((input.length % 64) !== 56) input.push(0);
  for (i = 0; i < 8; i++) input.push(Math.floor(bitlen / Math.pow(256, i)) & 255);
  for (i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  for (block = 0; block < input.length; block += 64) {
    M = [];
    for (i = 0; i < 16; i++) {
      j = block + i * 4;
      M[i] = (input[j] | (input[j+1] << 8) | (input[j+2] << 16) | (input[j+3] << 24)) >>> 0;
    }
    a = a0; b = b0; c = c0; d = d0;
    for (i = 0; i < 64; i++) {
      if (i < 16) { f = (b & c) | (~b & d); g = i; j = shifts[i % 4]; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5*i + 1) % 16; j = shifts[4 + i % 4]; }
      else if (i < 48) { f = b ^ c ^ d; g = (3*i + 5) % 16; j = shifts[8 + i % 4]; }
      else { f = c ^ (b | ~d); g = (7*i) % 16; j = shifts[12 + i % 4]; }
      v = (a + f + K[i] + M[g]) >>> 0;
      tmp = d; d = c; c = b;
      b = (b + ((v << j) | (v >>> (32 - j)))) >>> 0;
      a = tmp;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  var words = [a0,b0,c0,d0];
  for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) {
    n = (words[i] >>> (8 * j)) & 255;
    out += (n < 16 ? '0' : '') + n.toString(16);
  }
  return out;
}
function challengeResponse(idEsc, challengeEsc, password) {
  var id = bytesFromRouterEscaped(idEsc), challenge = bytesFromRouterEscaped(challengeEsc);
  if (!id || id.length !== 1 || !challenge || challenge.length !== 16 || typeof password !== 'string') return null;
  return md5(id.concat(utf8Bytes(password), challenge));
}
/* Canonical MikroTik HTML uses JS string literals containing RouterOS octal
   sequences (for example '\\371'); JavaScript decodes those into Latin-1
   characters before this function receives them. Never UTF-8 encode the nonce. */
function challengeResponseRaw(idRaw, challengeRaw, password) {
  if (typeof idRaw !== 'string' || idRaw.length !== 1 ||
      typeof challengeRaw !== 'string' || challengeRaw.length !== 16 ||
      typeof password !== 'string') return null;
  var values = [], i, code;
  var combined = idRaw + challengeRaw;
  for (i = 0; i < combined.length; i++) {
    code = combined.charCodeAt(i);
    if (code > 255) return null;
    values.push(code);
  }
  return md5([values[0]].concat(utf8Bytes(password), values.slice(1)));
}
w.NajmChap = {response:challengeResponse, responseRaw:challengeResponseRaw};
})(window);
