const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const acorn = require('acorn');
const dir = path.join(__dirname, 'artifacts');
fs.mkdirSync(dir, { recursive: true });
function check(relative, artifact, budget) {
  const html = fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');
  if (/<link\b/i.test(html)) throw Error(relative + ' contains a static <link> tag');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw Error(relative + ' has no inline application script');
  const script = match[1];
  const file = path.join(dir, artifact);
  fs.writeFileSync(file, script);
  cp.execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  acorn.parse(script, { ecmaVersion: 5 });
  const bytes = Buffer.byteLength(html);
  if (bytes > budget) throw Error(relative + ' exceeds the ' + budget + '-byte budget');
  console.log(relative + ': node --check PASS; ES5 PASS; ' + bytes + ' / ' + budget + ' bytes');
}
check('index.html', 'app.js', 430000);
check('data.html', 'data-app.js', 60000);
check('data/index.html', 'data-route-app.js', 60000);
if (fs.readFileSync(path.resolve(__dirname, '../data.html'), 'utf8') !== fs.readFileSync(path.resolve(__dirname, '../data/index.html'), 'utf8')) {
  throw Error('data.html and data/index.html must remain identical');
}
