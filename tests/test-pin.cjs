'use strict';
/* The requested default is a public convenience lock, not server-side security. */
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const salt = html.match(/pinSalt\s*=\s*"([a-f0-9]+)"/)[1];
const hash = html.match(/pinHash\s*=\s*"([a-f0-9]+)"/)[1];
const pin = '78987898';
if (createHash('sha256').update('sdp.v1:' + salt + ':' + pin).digest('hex') !== hash) throw Error('The default PIN verifier does not match v44');
module.exports = pin;
